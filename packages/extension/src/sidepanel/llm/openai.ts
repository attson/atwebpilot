import type { ChatMessage, Json, ToolUsePart } from "@webpilot/shared/types";
import { formatLlmHttpError } from "./http-error";
import type { LlmClient, LlmStreamEvent } from "./types";

export async function* parseOpenAiStream(
  stream: ReadableStream<Uint8Array>
): AsyncIterable<LlmStreamEvent> {
  type Tc = { id?: string; name?: string; argsBuf: string; emittedStart: boolean };
  const tcs = new Map<number, Tc>();
  let usageIn = 0;
  let usageOut = 0;
  let finishReason: string | null = null;
  let messageEnded = false;

  for await (const data of readDataLines(stream)) {
    if (data === "[DONE]") {
      if (!messageEnded) {
        for (const tc of tcs.values()) {
          if (tc.id) {
            try {
              const input = tc.argsBuf ? (JSON.parse(tc.argsBuf) as Json) : ({} as Json);
              yield { type: "tool_use_end", id: tc.id, input };
            } catch (e) {
              yield {
                type: "error",
                error: `tool_use ${tc.id} arguments JSON parse failed: ${
                  e instanceof Error ? e.message : String(e)
                }`
              };
            }
          }
        }
        yield {
          type: "message_end",
          usage: { input_tokens: usageIn, output_tokens: usageOut },
          ...(finishReason ? { stop_reason: finishReason } : {})
        };
        messageEnded = true;
      }
      return;
    }
    let chunk: Record<string, unknown>;
    try {
      chunk = JSON.parse(data);
    } catch {
      continue;
    }
    const choices = chunk.choices as Array<{
      delta?: { content?: string; tool_calls?: Array<{
        index: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }> };
      finish_reason?: string | null;
    }> | undefined;
    const usage = chunk.usage as
      | { prompt_tokens?: number; completion_tokens?: number }
      | undefined;
    if (usage) {
      if (usage.prompt_tokens != null) usageIn = usage.prompt_tokens;
      if (usage.completion_tokens != null) usageOut = usage.completion_tokens;
    }
    if (!choices || choices.length === 0) continue;
    const c = choices[0];
    if (c.delta?.content) {
      yield { type: "text_delta", text: c.delta.content };
    }
    if (c.delta?.tool_calls) {
      for (const tc of c.delta.tool_calls) {
        const cur = tcs.get(tc.index) ?? { argsBuf: "", emittedStart: false };
        if (tc.id) cur.id = tc.id;
        if (tc.function?.name) cur.name = tc.function.name;
        if (tc.function?.arguments) cur.argsBuf += tc.function.arguments;
        if (!cur.emittedStart && cur.id && cur.name) {
          yield { type: "tool_use_start", id: cur.id, name: cur.name };
          cur.emittedStart = true;
        }
        if (cur.emittedStart && tc.function?.arguments && cur.id) {
          yield { type: "tool_use_input_delta", id: cur.id, partial_json: tc.function.arguments };
        }
        tcs.set(tc.index, cur);
      }
    }
    if (c.finish_reason) {
      finishReason = c.finish_reason;
    }
  }

  if (!messageEnded) {
    if (finishReason === "tool_calls") {
      for (const tc of tcs.values()) {
        if (tc.id) {
          try {
            const input = tc.argsBuf ? (JSON.parse(tc.argsBuf) as Json) : ({} as Json);
            yield { type: "tool_use_end", id: tc.id, input };
          } catch (e) {
            yield {
              type: "error",
              error: `tool_use ${tc.id} arguments JSON parse failed: ${
                e instanceof Error ? e.message : String(e)
              }`
            };
          }
        }
      }
    }
    yield {
      type: "message_end",
      usage: { input_tokens: usageIn, output_tokens: usageOut },
      ...(finishReason ? { stop_reason: finishReason } : {})
    };
  }
}

async function* readDataLines(stream: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (value) buf += decoder.decode(value, { stream: true });
    if (done) break;
    let nl = buf.indexOf("\n");
    while (nl >= 0) {
      const line = buf.slice(0, nl).trimEnd();
      buf = buf.slice(nl + 1);
      if (line.startsWith("data:")) yield line.slice(5).trimStart();
      nl = buf.indexOf("\n");
    }
  }
  buf += decoder.decode();
  for (const line of buf.split("\n")) {
    const t = line.trimEnd();
    if (t.startsWith("data:")) yield t.slice(5).trimStart();
  }
}

export const openaiClient: LlmClient = {
  async *stream(input) {
    const body = {
      model: input.model,
      max_tokens: input.maxTokens ?? 4096,
      messages: [
        { role: "system", content: input.system },
        ...input.messages.flatMap((m) => {
          const r = convertToOpenAiMessage(m);
          return Array.isArray(r) ? r : [r];
        })
      ],
      tools: input.tools.map((t) => ({
        type: "function" as const,
        function: { name: t.name, description: t.description, parameters: t.input_schema }
      })),
      stream: true,
      stream_options: { include_usage: true }
    };
    const base = input.endpoint?.trim() || "https://api.openai.com/v1";
    const url = base.replace(/\/+$/, "") + "/chat/completions";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(body),
      signal: input.abortSignal
    });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "<no body>");
      yield {
        type: "error",
        error: formatLlmHttpError("OpenAI", res.status, bodyText)
      };
      return;
    }
    if (!res.body) {
      yield { type: "error", error: "OpenAI: empty body" };
      return;
    }
    yield* parseOpenAiStream(res.body);
  }
};

function convertToOpenAiMessage(m: ChatMessage): unknown {
  if (m.role === "user") {
    if (typeof m.content === "string") return { role: "user", content: m.content };
    const out: unknown[] = [];
    const userParts: { type: "text"; text: string }[] = [];
    for (const part of m.content) {
      if (part.type === "tool_result") {
        out.push({
          role: "tool",
          tool_call_id: part.tool_use_id,
          content: part.content
        });
      } else if (part.type === "text") {
        userParts.push({ type: "text", text: part.text });
      }
    }
    if (userParts.length > 0) {
      out.unshift({ role: "user", content: userParts });
    }
    return out;
  }
  const text = m.content
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
  const toolCalls = m.content
    .filter((p): p is ToolUsePart => p.type === "tool_use")
    .map((p) => ({
      id: p.id,
      type: "function" as const,
      function: { name: p.name, arguments: JSON.stringify(p.input) }
    }));
  return {
    role: "assistant",
    content: text || null,
    ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {})
  };
}

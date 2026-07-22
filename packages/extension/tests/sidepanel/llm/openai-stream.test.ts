import { afterEach, describe, expect, it, vi } from "vitest";
import { openaiClient, parseOpenAiStream } from "@/sidepanel/llm/openai";
import type { LlmStreamEvent } from "@/sidepanel/llm/types";

async function collect(stream: AsyncIterable<LlmStreamEvent>): Promise<LlmStreamEvent[]> {
  const out: LlmStreamEvent[] = [];
  for await (const ev of stream) out.push(ev);
  return out;
}

function chunksFrom(text: string): ReadableStream<Uint8Array> {
  const enc = new TextEncoder().encode(text);
  return new ReadableStream({
    start(c) {
      for (let i = 0; i < enc.length; i += 32) {
        c.enqueue(enc.subarray(i, Math.min(i + 32, enc.length)));
      }
      c.close();
    }
  });
}

describe("parseOpenAiStream", () => {
  it("emits text_delta and message_end on text-only response", async () => {
    const sse = [
      `data: {"choices":[{"delta":{"role":"assistant","content":"Hi"}}]}`,
      ``,
      `data: {"choices":[{"delta":{"content":" there"}}]}`,
      ``,
      `data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":2}}`,
      ``,
      `data: [DONE]`,
      ``,
      ``
    ].join("\n");

    const events = await collect(parseOpenAiStream(chunksFrom(sse)));
    expect(events).toEqual([
      { type: "text_delta", text: "Hi" },
      { type: "text_delta", text: " there" },
      { type: "message_end", usage: { input_tokens: 5, output_tokens: 2 }, stop_reason: "stop" }
    ]);
  });

  it("emits tool_use sequence and parsed input", async () => {
    const sse = [
      `data: {"choices":[{"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"snapshotDOM","arguments":""}}]}}]}`,
      ``,
      `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"max"}}]}}]}`,
      ``,
      `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"Depth\\":3}"}}]}}]}`,
      ``,
      `data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":7,"completion_tokens":4}}`,
      ``,
      `data: [DONE]`,
      ``,
      ``
    ].join("\n");

    const events = await collect(parseOpenAiStream(chunksFrom(sse)));
    expect(events).toEqual([
      { type: "tool_use_start", id: "call_1", name: "snapshotDOM" },
      { type: "tool_use_input_delta", id: "call_1", partial_json: "{\"max" },
      { type: "tool_use_input_delta", id: "call_1", partial_json: "Depth\":3}" },
      { type: "tool_use_end", id: "call_1", input: { maxDepth: 3 } },
      { type: "message_end", usage: { input_tokens: 7, output_tokens: 4 }, stop_reason: "tool_calls" }
    ]);
  });

  it("emits error on malformed JSON arguments", async () => {
    const sse = [
      `data: {"choices":[{"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"x","arguments":"{not"}}]}}]}`,
      ``,
      `data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}`,
      ``,
      `data: [DONE]`,
      ``
    ].join("\n");

    const events = await collect(parseOpenAiStream(chunksFrom(sse)));
    expect(events.find((e) => e.type === "error")).toBeTruthy();
  });
});

describe("openaiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("truncates large non-JSON error bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<!DOCTYPE html><html>".repeat(200), { status: 520 }))
    );

    const events = await collect(
      openaiClient.stream({
        apiKey: "sk-test",
        model: "gpt-test",
        system: "system",
        messages: [{ role: "user", content: "hello" }],
        tools: []
      })
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "error" });
    const error = events[0]?.type === "error" ? events[0].error : "";
    expect(error).toContain("OpenAI 520");
    expect(error).toContain("truncated");
    expect(error.length).toBeLessThan(700);
  });

  it("parses non-streaming JSON responses from OpenAI-compatible endpoints", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              choices: [{ message: { role: "assistant", content: "pong" }, finish_reason: "stop" }],
              usage: { prompt_tokens: 3, completion_tokens: 1 }
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
      )
    );

    const events = await collect(
      openaiClient.stream({
        apiKey: "sk-test",
        model: "gpt-test",
        system: "system",
        messages: [{ role: "user", content: "ping" }],
        tools: []
      })
    );

    expect(events).toEqual([
      { type: "text_delta", text: "pong" },
      { type: "message_end", usage: { input_tokens: 3, output_tokens: 1 }, stop_reason: "stop" }
    ]);
  });

  it("reports an error when a 200 response is neither SSE nor JSON chat completion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("upstream rejected max_tokens", { status: 200 }))
    );

    const events = await collect(
      openaiClient.stream({
        apiKey: "sk-test",
        model: "gpt-test",
        system: "system",
        messages: [{ role: "user", content: "ping" }],
        tools: []
      })
    );

    expect(events[0]).toMatchObject({
      type: "error",
      error: expect.stringContaining("did not contain any SSE data")
    });
    expect(events[0]).toMatchObject({
      type: "error",
      error: expect.stringContaining("upstream rejected max_tokens")
    });
  });
});

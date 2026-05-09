import { describe, expect, it } from "vitest";
import { parseAnthropicStream } from "@/sidepanel/llm/anthropic";
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
      for (let i = 0; i < enc.length; i += 64) {
        c.enqueue(enc.subarray(i, Math.min(i + 64, enc.length)));
      }
      c.close();
    }
  });
}

describe("parseAnthropicStream", () => {
  it("emits text_delta and message_end on text-only response", async () => {
    const sse = [
      `event: message_start`,
      `data: {"type":"message_start","message":{"id":"m1","usage":{"input_tokens":5,"output_tokens":0}}}`,
      ``,
      `event: content_block_start`,
      `data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}`,
      ``,
      `event: content_block_delta`,
      `data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi"}}`,
      ``,
      `event: content_block_delta`,
      `data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" there"}}`,
      ``,
      `event: content_block_stop`,
      `data: {"type":"content_block_stop","index":0}`,
      ``,
      `event: message_delta`,
      `data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":3}}`,
      ``,
      `event: message_stop`,
      `data: {"type":"message_stop"}`,
      ``,
      ``
    ].join("\n");

    const events = await collect(parseAnthropicStream(chunksFrom(sse)));
    expect(events).toEqual([
      { type: "text_delta", text: "Hi" },
      { type: "text_delta", text: " there" },
      { type: "message_end", usage: { input_tokens: 5, output_tokens: 3 } }
    ]);
  });

  it("emits tool_use sequence with parsed input", async () => {
    const sse = [
      `event: message_start`,
      `data: {"type":"message_start","message":{"id":"m1","usage":{"input_tokens":7,"output_tokens":0}}}`,
      ``,
      `event: content_block_start`,
      `data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"t1","name":"snapshotDOM","input":{}}}`,
      ``,
      `event: content_block_delta`,
      `data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"max"}}`,
      ``,
      `event: content_block_delta`,
      `data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"Depth\\":3}"}}`,
      ``,
      `event: content_block_stop`,
      `data: {"type":"content_block_stop","index":0}`,
      ``,
      `event: message_delta`,
      `data: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":4}}`,
      ``,
      `event: message_stop`,
      `data: {"type":"message_stop"}`,
      ``,
      ``
    ].join("\n");

    const events = await collect(parseAnthropicStream(chunksFrom(sse)));
    expect(events).toEqual([
      { type: "tool_use_start", id: "t1", name: "snapshotDOM" },
      { type: "tool_use_input_delta", id: "t1", partial_json: "{\"max" },
      { type: "tool_use_input_delta", id: "t1", partial_json: "Depth\":3}" },
      { type: "tool_use_end", id: "t1", input: { maxDepth: 3 } },
      { type: "message_end", usage: { input_tokens: 7, output_tokens: 4 } }
    ]);
  });

  it("emits error event on malformed JSON in input", async () => {
    const sse = [
      `event: content_block_start`,
      `data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"t1","name":"x","input":{}}}`,
      ``,
      `event: content_block_delta`,
      `data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{not json"}}`,
      ``,
      `event: content_block_stop`,
      `data: {"type":"content_block_stop","index":0}`,
      ``
    ].join("\n");

    const events = await collect(parseAnthropicStream(chunksFrom(sse)));
    expect(events.find((e) => e.type === "error")).toBeTruthy();
  });
});

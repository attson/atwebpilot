import { describe, expect, it, vi } from "vitest";
import { runChatSession } from "@/sidepanel/chat/run-session";
import { Approver } from "@/sidepanel/chat/approval";
import type { LlmClient, LlmStreamEvent } from "@/sidepanel/llm/types";
import type { ToolRunner } from "@/sidepanel/chat/tool-runner";
import type { Json, Step } from "@/shared/types";

function streamFrom(events: LlmStreamEvent[]): AsyncIterable<LlmStreamEvent> {
  return (async function* () {
    for (const e of events) yield e;
  })();
}

function makeClient(rounds: LlmStreamEvent[][]): LlmClient {
  let i = 0;
  return {
    stream() {
      const events = rounds[i++] ?? [{ type: "message_end", usage: { input_tokens: 0, output_tokens: 0 } }];
      return streamFrom(events);
    }
  };
}

function makeRunner(handler: (step: Step) => Promise<Json>): ToolRunner {
  return { async runStep(step) { return handler(step); } };
}

describe("runChatSession", () => {
  it("auto-approves safe tool, retrieves output, terminates after assistant final text", async () => {
    const client = makeClient([
      [
        { type: "tool_use_start", id: "t1", name: "snapshotDOM" },
        { type: "tool_use_input_delta", id: "t1", partial_json: "{}" },
        { type: "tool_use_end", id: "t1", input: {} },
        { type: "message_end", usage: { input_tokens: 5, output_tokens: 10 } }
      ],
      [
        { type: "text_delta", text: "done." },
        { type: "message_end", usage: { input_tokens: 12, output_tokens: 5 } }
      ]
    ]);
    const runner = makeRunner(async () => ({ tag: "html" }));
    const approver = new Approver();
    const rpc = {
      startSession: vi.fn().mockResolvedValue({ id: "run-1" }),
      appendStepLog: vi.fn().mockResolvedValue(null),
      finalizeSession: vi.fn().mockResolvedValue(null)
    };

    const result = await runChatSession({
      client,
      runner,
      approver,
      rpc,
      input: { userPrompt: "go", tabId: 7, url: "https://x/" },
      settings: { provider: "anthropic", model: "m", apiKey: "k", apiKeyMode: "session", maxRounds: 5, autoApproveDangerous: [] },
      systemPrompt: "sys",
      tools: [],
      approveAllSafe: true
    });

    expect(result.status).toBe("done");
    expect(result.runRecordId).toBe("run-1");
    expect(rpc.appendStepLog).toHaveBeenCalledTimes(1);
    expect(rpc.finalizeSession).toHaveBeenCalledWith("run-1", "ok", expect.anything());
  });

  it("waits for approval on dangerous tool and aborts on deny", async () => {
    const client = makeClient([
      [
        { type: "tool_use_start", id: "t1", name: "readStorage" },
        { type: "tool_use_input_delta", id: "t1", partial_json: '{"store":"local","key":"k"}' },
        { type: "tool_use_end", id: "t1", input: { store: "local", key: "k" } },
        { type: "message_end" }
      ]
    ]);
    const runner = makeRunner(async () => null);
    const approver = new Approver();

    const promise = runChatSession({
      client,
      runner,
      approver,
      rpc: {
        startSession: vi.fn().mockResolvedValue({ id: "r" }),
        appendStepLog: vi.fn(),
        finalizeSession: vi.fn().mockResolvedValue(null)
      },
      input: { userPrompt: "x", tabId: 1, url: "u" },
      settings: { provider: "anthropic", model: "m", apiKey: "k", apiKeyMode: "session", maxRounds: 5, autoApproveDangerous: [] },
      systemPrompt: "sys",
      tools: [],
      approveAllSafe: true
    });

    await new Promise((r) => setTimeout(r, 10));
    approver.resolve("t1", { kind: "deny" });
    const result = await promise;

    expect(result.status).toBe("aborted");
  });

  it("recovers from step error by feeding back tool_result with is_error and continues", async () => {
    const client = makeClient([
      [
        { type: "tool_use_start", id: "t1", name: "extractText" },
        { type: "tool_use_input_delta", id: "t1", partial_json: '{"selector":"x"}' },
        { type: "tool_use_end", id: "t1", input: { selector: "x" } },
        { type: "message_end" }
      ],
      [
        { type: "text_delta", text: "ok" },
        { type: "message_end" }
      ]
    ]);
    let calls = 0;
    const runner = makeRunner(async () => {
      calls++;
      if (calls === 1) throw new Error("selector miss");
      return [];
    });
    const approver = new Approver();

    const result = await runChatSession({
      client,
      runner,
      approver,
      rpc: {
        startSession: vi.fn().mockResolvedValue({ id: "r" }),
        appendStepLog: vi.fn(),
        finalizeSession: vi.fn().mockResolvedValue(null)
      },
      input: { userPrompt: "x", tabId: 1, url: "u" },
      settings: { provider: "anthropic", model: "m", apiKey: "k", apiKeyMode: "session", maxRounds: 5, autoApproveDangerous: [] },
      systemPrompt: "sys",
      tools: [],
      approveAllSafe: true
    });

    expect(result.status).toBe("done");
  });

  it("stops at maxRounds", async () => {
    const oneRound: LlmStreamEvent[] = [
      { type: "tool_use_start", id: "t1", name: "snapshotDOM" },
      { type: "tool_use_input_delta", id: "t1", partial_json: "{}" },
      { type: "tool_use_end", id: "t1", input: {} },
      { type: "message_end" }
    ];
    const client = makeClient([oneRound, oneRound, oneRound]);
    const runner = makeRunner(async () => null);
    const approver = new Approver();

    const result = await runChatSession({
      client,
      runner,
      approver,
      rpc: {
        startSession: vi.fn().mockResolvedValue({ id: "r" }),
        appendStepLog: vi.fn(),
        finalizeSession: vi.fn().mockResolvedValue(null)
      },
      input: { userPrompt: "x", tabId: 1, url: "u" },
      settings: { provider: "anthropic", model: "m", apiKey: "k", apiKeyMode: "session", maxRounds: 2, autoApproveDangerous: [] },
      systemPrompt: "sys",
      tools: [],
      approveAllSafe: true
    });

    expect(result.status).toBe("max_rounds");
  });
});

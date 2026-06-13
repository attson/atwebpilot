import { describe, expect, it, vi } from "vitest";
import { runChatSession, type SessionEvent } from "@/sidepanel/chat/run-session";
import { Approver } from "@/sidepanel/chat/approval";
import type { LlmClient, LlmStreamEvent } from "@/sidepanel/llm/types";
import type { ToolRunner } from "@/sidepanel/chat/tool-runner";
import type { Json, Step } from "@atwebpilot/shared/types";

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
      settings: { provider: "anthropic", model: "m", apiKey: "k", apiKeyMode: "session", maxRounds: 5, trustedDangerTools: [], defaultPermissionMode: "default", },
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
      settings: { provider: "anthropic", model: "m", apiKey: "k", apiKeyMode: "session", maxRounds: 5, trustedDangerTools: [], defaultPermissionMode: "default", },
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
      settings: { provider: "anthropic", model: "m", apiKey: "k", apiKeyMode: "session", maxRounds: 5, trustedDangerTools: [], defaultPermissionMode: "default", },
      systemPrompt: "sys",
      tools: [],
      approveAllSafe: true
    });

    expect(result.status).toBe("done");
  });

  it("dangerous tool with allowlist auto-approves", async () => {
    const client = makeClient([
      [
        { type: "tool_use_start", id: "t1", name: "submitForm" },
        { type: "tool_use_input_delta", id: "t1", partial_json: '{"selector":"form"}' },
        { type: "tool_use_end", id: "t1", input: { selector: "form" } },
        { type: "message_end" }
      ],
      [
        { type: "text_delta", text: "submitted" },
        { type: "message_end" }
      ]
    ]);
    let ran = 0;
    const runner = makeRunner(async () => {
      ran++;
      return { ok: true };
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
      input: { userPrompt: "go", tabId: 1, url: "u" },
      settings: {
        provider: "anthropic",
        model: "m",
        apiKey: "k",
        apiKeyMode: "session",
        maxRounds: 5,
        trustedDangerTools: ["submitForm"], defaultPermissionMode: "default",
      },
      systemPrompt: "sys",
      tools: [],
      approveAllSafe: false
    });

    expect(result.status).toBe("done");
    expect(ran).toBe(1);
  });

  describe("control-plane tools", () => {
    it("listTabs is handled by tabsRpc and does not go to runner", async () => {
      let runnerCalls = 0;
      let listTabsCalls = 0;

      const client = makeClient([
        [
          { type: "tool_use_start", id: "u1", name: "listTabs" },
          { type: "tool_use_input_delta", id: "u1", partial_json: "{}" },
          { type: "tool_use_end", id: "u1", input: {} },
          { type: "message_end", usage: { input_tokens: 0, output_tokens: 0 } }
        ],
        [
          { type: "text_delta", text: "done" },
          { type: "message_end", usage: { input_tokens: 0, output_tokens: 0 } }
        ]
      ]);
      const runner = makeRunner(async () => {
        runnerCalls++;
        return null;
      });
      const approver = new Approver();
      const rpc = {
        startSession: vi.fn().mockResolvedValue({ id: "run-1" }),
        appendStepLog: vi.fn().mockResolvedValue(null),
        finalizeSession: vi.fn().mockResolvedValue(null)
      };
      const tabsRpc = {
        listTabs: vi.fn(async () => {
          listTabsCalls++;
          return { tabs: [{ tabId: 1, windowId: 1, url: "u", title: "t" }] };
        }),
        openTab: vi.fn()
      };
      const result = await runChatSession({
        client,
        runner,
        approver,
        rpc,
        input: { userPrompt: "go", tabId: 7, url: "https://x/" },
        settings: {
          provider: "anthropic",
          model: "m",
          apiKey: "k",
          apiKeyMode: "session",
          maxRounds: 5,
          trustedDangerTools: ["listTabs"], defaultPermissionMode: "default",
        },
        systemPrompt: "sys",
        tools: [],
        approveAllSafe: true,
        getAttachedTabIds: () => [],
        tabsRpc
      });

      expect(result.status).toBe("done");
      expect(runnerCalls).toBe(0);
      expect(listTabsCalls).toBe(1);
    });

    it("openTab calls tabsRpc.openTab and emits onCrossTabResult", async () => {
      const client = makeClient([
        [
          { type: "tool_use_start", id: "u2", name: "openTab" },
          { type: "tool_use_input_delta", id: "u2", partial_json: '{"url":"https://new"}' },
          { type: "tool_use_end", id: "u2", input: { url: "https://new" } },
          { type: "message_end" }
        ],
        [
          { type: "text_delta", text: "ok" },
          { type: "message_end" }
        ]
      ]);
      const runner = makeRunner(async () => null);
      const approver = new Approver();
      const rpc = {
        startSession: vi.fn().mockResolvedValue({ id: "run-2" }),
        appendStepLog: vi.fn().mockResolvedValue(null),
        finalizeSession: vi.fn().mockResolvedValue(null)
      };
      const tabsRpc = {
        listTabs: vi.fn(),
        openTab: vi.fn(async () => ({ tabId: 99, url: "https://new", title: "" }))
      };
      const events: unknown[] = [];

      await runChatSession({
        client,
        runner,
        approver,
        rpc,
        input: { userPrompt: "go", tabId: 7, url: "https://x/" },
        settings: {
          provider: "anthropic",
          model: "m",
          apiKey: "k",
          apiKeyMode: "session",
          maxRounds: 5,
          trustedDangerTools: ["openTab"], defaultPermissionMode: "default",
        },
        systemPrompt: "sys",
        tools: [],
        approveAllSafe: true,
        getAttachedTabIds: () => [],
        tabsRpc,
        onCrossTabResult: (r) => events.push(r)
      });

      expect(tabsRpc.openTab).toHaveBeenCalledWith("https://new", undefined);
      expect(events).toContainEqual({ kind: "opened", tabId: 99, url: "https://new", title: "" });
    });
  });

  describe("continuation guard", () => {
    const baseSettings = {
      provider: "anthropic" as const,
      model: "m",
      apiKey: "k",
      apiKeyMode: "session" as const,
      maxRounds: 20,
      trustedDangerTools: [] as string[],
      defaultPermissionMode: "default" as const
    };

    it("nudges when the model stops with text-only, then continues when it resumes calling tools", async () => {
      const client = makeClient([
        // round 0: premature text-only stop
        [{ type: "text_delta", text: "我先看了前 10 条评论。" }, { type: "message_end" }],
        // round 1: after the nudge the model resumes and calls a tool
        [
          { type: "tool_use_start", id: "t1", name: "snapshotDOM" },
          { type: "tool_use_input_delta", id: "t1", partial_json: "{}" },
          { type: "tool_use_end", id: "t1", input: {} },
          { type: "message_end" }
        ],
        // round 2: final text-only
        [{ type: "text_delta", text: "全部完成。" }, { type: "message_end" }]
      ]);
      let runnerCalls = 0;
      const runner = makeRunner(async () => {
        runnerCalls++;
        return { ok: true };
      });
      const approver = new Approver();
      const events: SessionEvent[] = [];

      const result = await runChatSession({
        client,
        runner,
        approver,
        rpc: {
          startSession: vi.fn().mockResolvedValue({ id: "r" }),
          appendStepLog: vi.fn().mockResolvedValue(null),
          finalizeSession: vi.fn().mockResolvedValue(null)
        },
        input: { userPrompt: "采集所有评论", tabId: 1, url: "u" },
        settings: { ...baseSettings, maxContinuationNudges: 1 },
        systemPrompt: "sys",
        tools: [],
        approveAllSafe: true,
        onEvent: (e) => events.push(e)
      });

      expect(result.status).toBe("done");
      // the premature text-only round did NOT end the session — the nudge made it resume
      expect(runnerCalls).toBe(1);
      expect(events.some((e) => e.type === "continuation_nudge")).toBe(true);
    });

    it("does not nudge when maxContinuationNudges is 0 (legacy immediate stop)", async () => {
      const client = makeClient([
        [
          { type: "tool_use_start", id: "t1", name: "snapshotDOM" },
          { type: "tool_use_input_delta", id: "t1", partial_json: "{}" },
          { type: "tool_use_end", id: "t1", input: {} },
          { type: "message_end" }
        ],
        [{ type: "text_delta", text: "done" }, { type: "message_end" }]
      ]);
      let runnerCalls = 0;
      const runner = makeRunner(async () => {
        runnerCalls++;
        return null;
      });
      const approver = new Approver();
      const events: SessionEvent[] = [];

      const result = await runChatSession({
        client,
        runner,
        approver,
        rpc: {
          startSession: vi.fn().mockResolvedValue({ id: "r" }),
          appendStepLog: vi.fn().mockResolvedValue(null),
          finalizeSession: vi.fn().mockResolvedValue(null)
        },
        input: { userPrompt: "x", tabId: 1, url: "u" },
        settings: { ...baseSettings, maxContinuationNudges: 0 },
        systemPrompt: "sys",
        tools: [],
        approveAllSafe: true,
        onEvent: (e) => events.push(e)
      });

      expect(result.status).toBe("done");
      expect(runnerCalls).toBe(1);
      expect(events.some((e) => e.type === "continuation_nudge")).toBe(false);
    });

    it("does not re-nudge when the model alternates text-only with verification tool calls", async () => {
      // Regression for "确认完成有好多遍": before the fix, any tool call reset
      // the nudge budget, so a model in a "claim done → verify → claim done" loop
      // got nudged every other round until maxRounds.
      const client = makeClient([
        // R0: premature text-only "done"
        [{ type: "text_delta", text: "采集完成 152 条。" }, { type: "message_end" }],
        // R1: nudged → runs one verification tool
        [
          { type: "tool_use_start", id: "t1", name: "httpRequest" },
          { type: "tool_use_input_delta", id: "t1", partial_json: "{}" },
          { type: "tool_use_end", id: "t1", input: {} },
          { type: "message_end" }
        ],
        // R2: text-only "done" again — this MUST terminate, not trigger another nudge
        [{ type: "text_delta", text: "确认已完成。" }, { type: "message_end" }],
        // sentinel: if the loop wrongly continues, it'd consume more rounds
        [{ type: "text_delta", text: "再次确认。" }, { type: "message_end" }],
        [{ type: "text_delta", text: "三次确认。" }, { type: "message_end" }]
      ]);
      let runnerCalls = 0;
      const runner = makeRunner(async () => {
        runnerCalls++;
        return { ok: true };
      });
      const approver = new Approver();
      const events: SessionEvent[] = [];

      const result = await runChatSession({
        client,
        runner,
        approver,
        rpc: {
          startSession: vi.fn().mockResolvedValue({ id: "r" }),
          appendStepLog: vi.fn().mockResolvedValue(null),
          finalizeSession: vi.fn().mockResolvedValue(null)
        },
        input: { userPrompt: "采集所有评论", tabId: 1, url: "u" },
        settings: { ...baseSettings, maxContinuationNudges: 1 },
        systemPrompt: "sys",
        tools: [],
        approveAllSafe: true,
        onEvent: (e) => events.push(e)
      });

      expect(result.status).toBe("done");
      // exactly one nudge across the whole session, even though a tool ran between text-only turns
      expect(events.filter((e) => e.type === "continuation_nudge").length).toBe(1);
      expect(runnerCalls).toBe(1);
    });

    it("stops after exhausting the nudge budget when the model keeps returning text only", async () => {
      const textOnly: import("@/sidepanel/llm/types").LlmStreamEvent[] = [
        { type: "text_delta", text: "我觉得差不多了" },
        { type: "message_end" }
      ];
      const client = makeClient([textOnly, textOnly, textOnly, textOnly, textOnly]);
      const runner = makeRunner(async () => null);
      const approver = new Approver();
      const events: SessionEvent[] = [];

      const result = await runChatSession({
        client,
        runner,
        approver,
        rpc: {
          startSession: vi.fn().mockResolvedValue({ id: "r" }),
          appendStepLog: vi.fn().mockResolvedValue(null),
          finalizeSession: vi.fn().mockResolvedValue(null)
        },
        input: { userPrompt: "x", tabId: 1, url: "u" },
        settings: { ...baseSettings, maxRounds: 20, maxContinuationNudges: 1 },
        systemPrompt: "sys",
        tools: [],
        approveAllSafe: true,
        onEvent: (e) => events.push(e)
      });

      // exactly one nudge, then accept done — must NOT run to maxRounds
      expect(result.status).toBe("done");
      expect(events.filter((e) => e.type === "continuation_nudge").length).toBe(1);
    });
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
      settings: { provider: "anthropic", model: "m", apiKey: "k", apiKeyMode: "session", maxRounds: 2, trustedDangerTools: [], defaultPermissionMode: "default", },
      systemPrompt: "sys",
      tools: [],
      approveAllSafe: true
    });

    expect(result.status).toBe("max_rounds");
  });
});

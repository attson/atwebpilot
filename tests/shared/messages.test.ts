import { describe, expect, it } from "vitest";
import { RpcRequest, ToolDraftSchema, ToolSchema } from "@/shared/messages";

const base = {
  id: "tool-1",
  name: "采集商品",
  urlPatterns: ["https://example.com/**"],
  description: "采集当前页面",
  createdAt: 1,
  updatedAt: 1,
  stats: { runs: 0 }
};

describe("tool schemas", () => {
  it("accepts prompt tool drafts", () => {
    const parsed = ToolDraftSchema.parse({
      kind: "prompt",
      name: "智能采集",
      urlPatterns: ["https://example.com/**"],
      description: "让 AI 根据当前页面采集",
      prompt: "请读取当前页面并返回 JSON"
    });
    expect(parsed.kind).toBe("prompt");
    if (parsed.kind !== "prompt") throw new Error("expected prompt draft");
    expect(parsed.prompt).toContain("JSON");
  });

  it("accepts steps tool drafts", () => {
    const parsed = ToolDraftSchema.parse({
      kind: "steps",
      name: "固定采集",
      urlPatterns: ["https://example.com/**"],
      description: "固定提取 h1",
      steps: [{ kind: "tool", tool: "extractText", args: { selector: "h1" } }],
      outputSchema: {}
    });
    expect(parsed.kind).toBe("steps");
    if (parsed.kind !== "steps") throw new Error("expected steps draft");
    expect(parsed.steps).toHaveLength(1);
  });

  it("rejects old drafts without kind", () => {
    expect(() =>
      ToolDraftSchema.parse({
        name: "旧工具",
        urlPatterns: ["https://example.com/**"],
        description: "old",
        steps: [{ kind: "tool", tool: "snapshotDOM", args: {} }],
        outputSchema: {}
      })
    ).toThrow();
  });

  it("accepts prompt and steps persisted tools", () => {
    expect(
      ToolSchema.parse({
        ...base,
        kind: "prompt",
        prompt: "请总结当前页",
        versions: [{ version: 1, kind: "prompt", prompt: "请总结当前页", createdAt: 1 }]
      }).kind
    ).toBe("prompt");

    expect(
      ToolSchema.parse({
        ...base,
        kind: "steps",
        steps: [{ kind: "js", source: "return { ok: true };" }],
        outputSchema: {},
        versions: [
          {
            version: 1,
            kind: "steps",
            steps: [{ kind: "js", source: "return { ok: true };" }],
            outputSchema: {},
            createdAt: 1
          }
        ]
      }).kind
    ).toBe("steps");
  });
});

describe("multi-tab RPC variants", () => {
  it("tabs.list with optional windowId", () => {
    expect(RpcRequest.safeParse({ type: "tabs.list" }).success).toBe(true);
    expect(RpcRequest.safeParse({ type: "tabs.list", windowId: 1 }).success).toBe(true);
  });

  it("tabs.open requires url", () => {
    expect(RpcRequest.safeParse({ type: "tabs.open", url: "https://x.com" }).success).toBe(true);
    expect(RpcRequest.safeParse({ type: "tabs.open" }).success).toBe(false);
    expect(RpcRequest.safeParse({ type: "tabs.open", url: "https://x", active: true }).success).toBe(true);
  });

  it("runs.runOneStep accepts attachedTabIds (defaults to [])", () => {
    const ok = RpcRequest.safeParse({
      type: "runs.runOneStep",
      step: { kind: "tool", tool: "snapshotDOM", args: {} },
      tabId: 1
    });
    expect(ok.success).toBe(true);
    if (!ok.success) throw new Error("expected success");
    if (ok.data.type !== "runs.runOneStep") throw new Error("expected runs.runOneStep");
    expect(ok.data.attachedTabIds).toEqual([]);
    const ok2 = RpcRequest.safeParse({
      type: "runs.runOneStep",
      step: { kind: "tool", tool: "snapshotDOM", args: {} },
      tabId: 1,
      attachedTabIds: [167]
    });
    expect(ok2.success).toBe(true);
  });
});

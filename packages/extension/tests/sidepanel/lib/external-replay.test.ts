import { describe, expect, it } from "vitest";
import { parseReplayPayload } from "@/sidepanel/lib/external-replay";

const SRC = "https://example.com/page";

describe("parseReplayPayload", () => {
  it("rejects non-objects", () => {
    expect(parseReplayPayload(null, SRC)).toBeNull();
    expect(parseReplayPayload("hi", SRC)).toBeNull();
    expect(parseReplayPayload(42, SRC)).toBeNull();
  });

  it("rejects missing prompt", () => {
    expect(parseReplayPayload({}, SRC)).toBeNull();
    expect(parseReplayPayload({ prompt: "" }, SRC)).toBeNull();
    expect(parseReplayPayload({ prompt: "   " }, SRC)).toBeNull();
  });

  it("accepts minimal prompt-only payload", () => {
    const r = parseReplayPayload({ prompt: "do thing" }, SRC);
    expect(r).not.toBeNull();
    expect(r!.prompt).toBe("do thing");
    expect(r!.sourceUrl).toBe(SRC);
    expect(r!.steps).toBeUndefined();
    expect(r!.title).toBeUndefined();
  });

  it("preserves optional fields", () => {
    const r = parseReplayPayload(
      { prompt: "p", title: "Example", steps: [{ kind: "tool", tool: "snapshotDOM", args: {} }] },
      SRC
    );
    expect(r!.title).toBe("Example");
    expect(r!.steps).toHaveLength(1);
  });

  it("stamps ts with current time", () => {
    const before = Date.now();
    const r = parseReplayPayload({ prompt: "go" }, SRC);
    const after = Date.now();
    expect(r!.ts).toBeGreaterThanOrEqual(before);
    expect(r!.ts).toBeLessThanOrEqual(after);
  });
});

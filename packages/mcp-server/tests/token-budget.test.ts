import { describe, it, expect } from "vitest";
import { buildToolList, createToolState } from "../src/mcp-server";

/**
 * Measured at introduction: core ≈16.4k, full ≈24.9k chars. Roughly 4.5k /
 * 7k tokens. Loose on purpose — they catch a description drifting back to
 * the example-heavy side-panel style, not an exact number. Raise
 * deliberately, with a note in the commit.
 */
const CORE_MAX_CHARS = 18_000;
const FULL_MAX_CHARS = 27_000;

describe("tools/list size budget", () => {
  it("pre-pairing core stays far below the connected ceiling", () => {
    const json = JSON.stringify(buildToolList(undefined, createToolState("core")));
    expect(json.length, `pre-pair list is ${json.length} chars`).toBeLessThanOrEqual(4_500);
  });
  it("connected full stays under the ceiling", () => {
    const state = createToolState("full");
    state.browserSurfaceVisible = true;
    const json = JSON.stringify(buildToolList(undefined, state));
    expect(json.length, `full list is ${json.length} chars`).toBeLessThanOrEqual(FULL_MAX_CHARS);
  });

  it("connected core stays under the existing ceiling", () => {
    const state = createToolState("core");
    state.browserSurfaceVisible = true;
    const json = JSON.stringify(buildToolList(undefined, state));
    expect(json.length, `core list is ${json.length} chars`).toBeLessThanOrEqual(CORE_MAX_CHARS);
  });
});

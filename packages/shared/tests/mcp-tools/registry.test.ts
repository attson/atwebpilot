import { describe, it, expect } from "vitest";
import {
  CONTROL_PLANE_TOOLS,
  CONTROL_PLANE_TOOL_NAMES
} from "../../src/mcp-tools/registry";
import {
  buildExploreInputSchema,
  exploreToolName
} from "../../src/mcp-tools/explore-builder";

describe("CONTROL_PLANE_TOOLS", () => {
  it("has exactly 6 control-plane tools", () => {
    expect(CONTROL_PLANE_TOOLS).toHaveLength(6);
  });
  it("includes the 6 expected names", () => {
    expect(new Set(CONTROL_PLANE_TOOL_NAMES)).toEqual(
      new Set([
        "open_session",
        "close_session",
        "list_tools",
        "run_tool",
        "get_quota",
        "list_tabs"
      ])
    );
  });
  it("each tool has a non-empty description and an inputSchema", () => {
    for (const t of CONTROL_PLANE_TOOLS) {
      expect(t.description.length).toBeGreaterThan(0);
      expect(t.inputSchema).toBeTruthy();
      expect((t.inputSchema as { type?: string }).type).toBe("object");
    }
  });
});

describe("buildExploreInputSchema", () => {
  it("wraps the inner args schema under args, with required session_id", () => {
    const inner = { type: "object", properties: { selector: { type: "string" } } };
    const out = buildExploreInputSchema(inner);
    expect((out as { type: string }).type).toBe("object");
    expect((out as { required: string[] }).required).toEqual(["session_id"]);
    expect(
      ((out as { properties: { args: unknown } }).properties.args as unknown)
    ).toEqual(inner);
  });
});

describe("exploreToolName", () => {
  it("prefixes with explore_", () => {
    expect(exploreToolName("snapshotDOM")).toBe("explore_snapshotDOM");
    expect(exploreToolName("submitForm")).toBe("explore_submitForm");
  });
});

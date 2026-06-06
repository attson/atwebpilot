import { describe, it, expect } from "vitest";
import { generateBrowserTools, EXEC_TOOL_NAMES } from "../src/tool-gen";

describe("generateBrowserTools", () => {
  const tools = generateBrowserTools();

  it("generates exactly the 19 exec builtin tools, prefixed browser_", () => {
    expect(tools.length).toBe(19);
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(EXEC_TOOL_NAMES.map((n) => `browser_${n}`).sort());
  });

  it("does NOT generate runJS or tab-control tools", () => {
    const names = new Set(tools.map((t) => t.name));
    for (const n of ["browser_runJS", "browser_listTabs", "browser_openTab", "browser_attachTab", "browser_detachTab"]) {
      expect(names.has(n)).toBe(false);
    }
  });

  it("injects required session_id and strips inner tabId", () => {
    const click = tools.find((t) => t.name === "browser_click")!;
    const props = click.inputSchema.properties as Record<string, unknown>;
    expect(props.session_id).toBeTruthy();
    expect(props.tabId).toBeUndefined();
    expect((click.inputSchema.required as string[]).includes("session_id")).toBe(true);
    expect((click.inputSchema.required as string[]).includes("selector")).toBe(true);
  });

  it("records the underlying builtin tool name", () => {
    const click = tools.find((t) => t.name === "browser_click")!;
    expect(click.builtinTool).toBe("click");
  });
});

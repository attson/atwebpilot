import { describe, expect, it } from "vitest";
import { TOOL_DEFS } from "@/sidepanel/llm/tool-schema";

describe("TOOL_DEFS", () => {
  it("has every existing tool's input_schema.properties.tabId optional integer", () => {
    const namesNeeded = [
      "snapshotDOM",
      "querySelector",
      "querySelectorAll",
      "extractText",
      "extractImages",
      "scroll",
      "waitFor",
      "click",
      "httpRequest",
      "readStorage",
      "fillInput",
      "setCheckbox",
      "selectOption",
      "submitForm",
      "hover",
      "focus",
      "uploadFile",
      "getValue",
      "extractFormState",
      "runJS"
    ];
    for (const name of namesNeeded) {
      const def = TOOL_DEFS.find((d) => d.name === name);
      expect(def, `missing tool ${name}`).toBeDefined();
      const props = (def!.input_schema as { properties?: Record<string, unknown> }).properties ?? {};
      expect(props.tabId, `${name} missing tabId`).toBeDefined();
      expect((props.tabId as { type: string }).type).toBe("integer");
      const required = (def!.input_schema as { required?: string[] }).required ?? [];
      expect(required.includes("tabId")).toBe(false);
    }
  });

  it("declares the 4 control-plane tools", () => {
    for (const n of ["listTabs", "openTab", "attachTab", "detachTab"]) {
      expect(TOOL_DEFS.some((d) => d.name === n), `missing ${n}`).toBe(true);
    }
  });

  it("openTab requires url; attachTab/detachTab require tabId", () => {
    const openTab = TOOL_DEFS.find((d) => d.name === "openTab")!;
    expect((openTab.input_schema as { required: string[] }).required).toEqual(["url"]);
    const attachTab = TOOL_DEFS.find((d) => d.name === "attachTab")!;
    expect((attachTab.input_schema as { required: string[] }).required).toEqual(["tabId"]);
    const detachTab = TOOL_DEFS.find((d) => d.name === "detachTab")!;
    expect((detachTab.input_schema as { required: string[] }).required).toEqual(["tabId"]);
  });
});

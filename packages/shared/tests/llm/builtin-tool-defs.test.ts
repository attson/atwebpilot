import { describe, it, expect } from "vitest";
import { TOOL_DEFS } from "../../src/llm";

describe("TOOL_DEFS (hoisted to shared)", () => {
  it("includes the 19 builtin exec tools by name", () => {
    const names = new Set(TOOL_DEFS.map((t) => t.name));
    for (const n of [
      "snapshotDOM", "querySelector", "querySelectorAll", "extractText", "extractImages",
      "getValue", "extractFormState", "hover", "focus", "scroll", "waitFor",
      "click", "fillInput", "setCheckbox", "selectOption", "httpRequest",
      "submitForm", "uploadFile", "readStorage"
    ]) {
      expect(names.has(n)).toBe(true);
    }
  });

  it("each def has name/description/input_schema", () => {
    for (const t of TOOL_DEFS) {
      expect(typeof t.name).toBe("string");
      expect(typeof t.description).toBe("string");
      expect(t.input_schema).toBeTruthy();
    }
  });
});

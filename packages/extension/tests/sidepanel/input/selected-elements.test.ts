import { describe, expect, it } from "vitest";
import { buildPromptWithSelectedElements } from "@/sidepanel/input/selected-elements";

describe("buildPromptWithSelectedElements", () => {
  it("adds selected CSS selectors as hidden task context", () => {
    expect(
      buildPromptWithSelectedElements("提取标题", [
        "body > main > h1",
        "button[data-testid=\"buy\"]"
      ])
    ).toBe(
      [
        "=== Selected page elements ===",
        "The user selected these CSS selectors on the current page:",
        "1. `body > main > h1`",
        "2. `button[data-testid=\"buy\"]`",
        "",
        "=== User request ===",
        "提取标题"
      ].join("\n")
    );
  });

  it("returns the original prompt when no selectors are staged", () => {
    expect(buildPromptWithSelectedElements("总结页面", [])).toBe("总结页面");
  });
});

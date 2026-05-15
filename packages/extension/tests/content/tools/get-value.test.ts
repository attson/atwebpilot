import { describe, expect, it } from "vitest";
import { getValue } from "@/content/tools/get-value";

describe("getValue", () => {
  it("reads input value", async () => {
    document.body.innerHTML = `<input id="x" value="hi" />`;
    expect(await getValue({ selector: "#x" })).toBe("hi");
  });

  it("reads textarea value", async () => {
    document.body.innerHTML = `<textarea id="x">multi\nline</textarea>`;
    expect(await getValue({ selector: "#x" })).toBe("multi\nline");
  });

  it("reads select value", async () => {
    document.body.innerHTML = `<select id="x"><option value="a"></option><option value="b" selected></option></select>`;
    expect(await getValue({ selector: "#x" })).toBe("b");
  });

  it("reads contenteditable text", async () => {
    document.body.innerHTML = `<div id="x" contenteditable="true">edit me</div>`;
    expect(await getValue({ selector: "#x" })).toBe("edit me");
  });

  it("returns null when selector miss", async () => {
    document.body.innerHTML = "";
    expect(await getValue({ selector: "#x" })).toBeNull();
  });
});

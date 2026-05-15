import { beforeEach, describe, expect, it } from "vitest";
import { fillInput } from "@/content/tools/fill-input";

describe("fillInput", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("sets value and dispatches input + change on text input", async () => {
    document.body.innerHTML = `<input id="x" type="text" />`;
    const input = document.querySelector<HTMLInputElement>("#x")!;
    const events: string[] = [];
    input.addEventListener("input", () => events.push("input"));
    input.addEventListener("change", () => events.push("change"));

    const r = await fillInput({ selector: "#x", value: "hello" });
    expect(input.value).toBe("hello");
    expect(events).toEqual(["input", "change"]);
    expect((r as Record<string, unknown>).filled).toBe(true);
  });

  it("clears existing value when clear=true (default)", async () => {
    document.body.innerHTML = `<input id="x" type="text" value="old" />`;
    await fillInput({ selector: "#x", value: "new" });
    expect(document.querySelector<HTMLInputElement>("#x")!.value).toBe("new");
  });

  it("works on textarea", async () => {
    document.body.innerHTML = `<textarea id="x"></textarea>`;
    await fillInput({ selector: "#x", value: "multi\nline" });
    expect(document.querySelector<HTMLTextAreaElement>("#x")!.value).toBe("multi\nline");
  });

  it("works on contenteditable div via textContent + input event", async () => {
    document.body.innerHTML = `<div id="x" contenteditable="true"></div>`;
    const div = document.querySelector<HTMLDivElement>("#x")!;
    const events: string[] = [];
    div.addEventListener("input", () => events.push("input"));
    await fillInput({ selector: "#x", value: "ok" });
    expect(div.textContent).toBe("ok");
    expect(events).toEqual(["input"]);
  });

  it("throws when selector misses", async () => {
    await expect(fillInput({ selector: "#missing", value: "x" })).rejects.toThrow(/selector miss/);
  });

  it("throws when target is not input/textarea/contenteditable", async () => {
    document.body.innerHTML = `<div id="x"></div>`;
    await expect(fillInput({ selector: "#x", value: "x" })).rejects.toThrow(/not an input/);
  });

  it("appends when clear=false", async () => {
    document.body.innerHTML = `<input id="x" type="text" value="old" />`;
    await fillInput({ selector: "#x", value: "+more", clear: false });
    expect(document.querySelector<HTMLInputElement>("#x")!.value).toBe("old+more");
  });
});

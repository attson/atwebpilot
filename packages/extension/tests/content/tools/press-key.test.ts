import { beforeEach, describe, expect, it } from "vitest";
import { pressKey } from "@/content/tools/press-key";

describe("pressKey", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("dispatches keydown + keyup to selector target", async () => {
    document.body.innerHTML = `<input id="q" />`;
    const el = document.querySelector<HTMLInputElement>("#q")!;
    const seen: string[] = [];
    el.addEventListener("keydown", (e) => seen.push(`down:${e.key}`));
    el.addEventListener("keyup", (e) => seen.push(`up:${e.key}`));
    const r = await pressKey({ selector: "#q", key: "Enter" });
    expect(seen).toEqual(["down:Enter", "up:Enter"]);
    expect(r).toEqual({ ok: true, key: "Enter", dispatched: true });
  });

  it("dispatches keypress for printable chars", async () => {
    document.body.innerHTML = `<input id="q" />`;
    const el = document.querySelector<HTMLInputElement>("#q")!;
    const seen: string[] = [];
    el.addEventListener("keypress", (e) => seen.push(e.key));
    await pressKey({ selector: "#q", key: "a" });
    expect(seen).toEqual(["a"]);
  });

  it("does NOT dispatch keypress for non-printable keys", async () => {
    document.body.innerHTML = `<input id="q" />`;
    const el = document.querySelector<HTMLInputElement>("#q")!;
    let pressCount = 0;
    el.addEventListener("keypress", () => pressCount++);
    await pressKey({ selector: "#q", key: "Escape" });
    expect(pressCount).toBe(0);
  });

  it("infers KeyboardEvent.code for letters", async () => {
    document.body.innerHTML = `<input id="q" />`;
    const el = document.querySelector<HTMLInputElement>("#q")!;
    let code = "";
    el.addEventListener("keydown", (e) => {
      code = e.code;
    });
    await pressKey({ selector: "#q", key: "a" });
    expect(code).toBe("KeyA");
  });

  it("focuses HTMLElement target before dispatch", async () => {
    document.body.innerHTML = `<input id="q" /><input id="other" />`;
    const el = document.querySelector<HTMLInputElement>("#q")!;
    await pressKey({ selector: "#q", key: "Enter" });
    expect(document.activeElement).toBe(el);
  });

  it("falls back to document.body when no selector and no activeElement", async () => {
    let got = "";
    document.body.addEventListener("keydown", (e) => {
      got = e.key;
    });
    await pressKey({ key: "Escape" });
    expect(got).toBe("Escape");
  });

  it("throws when key is missing", async () => {
    await expect(pressKey({})).rejects.toThrow(/key required/);
  });

  it("throws when key is empty string", async () => {
    await expect(pressKey({ key: "" })).rejects.toThrow(/key required/);
  });

  it("throws when selector not found", async () => {
    await expect(pressKey({ key: "Enter", selector: "#nope" })).rejects.toThrow(/not found/);
  });
});

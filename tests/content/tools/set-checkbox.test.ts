import { describe, expect, it } from "vitest";
import { setCheckbox } from "@/content/tools/set-checkbox";

describe("setCheckbox", () => {
  it("sets checked from false to true and dispatches change", async () => {
    document.body.innerHTML = `<input id="x" type="checkbox" />`;
    const cb = document.querySelector<HTMLInputElement>("#x")!;
    let changed = 0;
    cb.addEventListener("change", () => changed++);
    const r = await setCheckbox({ selector: "#x", checked: true });
    expect(cb.checked).toBe(true);
    expect(changed).toBe(1);
    expect((r as Record<string, unknown>).checked).toBe(true);
  });

  it("noop when already in target state", async () => {
    document.body.innerHTML = `<input id="x" type="checkbox" checked />`;
    const cb = document.querySelector<HTMLInputElement>("#x")!;
    let changed = 0;
    cb.addEventListener("change", () => changed++);
    await setCheckbox({ selector: "#x", checked: true });
    expect(changed).toBe(0);
  });

  it("throws when target is not a checkbox", async () => {
    document.body.innerHTML = `<input id="x" type="text" />`;
    await expect(setCheckbox({ selector: "#x", checked: true })).rejects.toThrow(/not a checkbox/);
  });
});

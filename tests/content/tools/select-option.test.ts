import { beforeEach, describe, expect, it } from "vitest";
import { selectOption } from "@/content/tools/select-option";

describe("selectOption", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <select id="x">
        <option value="a">Apple</option>
        <option value="b">Banana</option>
        <option value="c">Cherry</option>
      </select>
    `;
  });

  it("selects by value", async () => {
    const r = await selectOption({ selector: "#x", value: "b" });
    expect(document.querySelector<HTMLSelectElement>("#x")!.value).toBe("b");
    expect((r as Record<string, unknown>).value).toBe("b");
  });

  it("selects by label", async () => {
    await selectOption({ selector: "#x", label: "Cherry" });
    expect(document.querySelector<HTMLSelectElement>("#x")!.value).toBe("c");
  });

  it("value wins when both given", async () => {
    await selectOption({ selector: "#x", value: "a", label: "Cherry" });
    expect(document.querySelector<HTMLSelectElement>("#x")!.value).toBe("a");
  });

  it("dispatches change", async () => {
    const sel = document.querySelector<HTMLSelectElement>("#x")!;
    let changed = 0;
    sel.addEventListener("change", () => changed++);
    await selectOption({ selector: "#x", value: "b" });
    expect(changed).toBe(1);
  });

  it("throws when option not found", async () => {
    await expect(selectOption({ selector: "#x", value: "z" })).rejects.toThrow(/option not found/);
  });

  it("throws when target is not a <select>", async () => {
    document.body.innerHTML = `<input id="x" />`;
    await expect(selectOption({ selector: "#x", value: "a" })).rejects.toThrow(/not a select/);
  });
});

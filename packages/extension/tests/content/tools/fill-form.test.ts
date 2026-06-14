import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fillForm } from "@/content/tools/fill-form";
import { resetUidCache } from "@/content/tools/uid-cache";

beforeEach(() => {
  resetUidCache();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("fillForm", () => {
  it("fills multiple selector-based fields and returns count", async () => {
    document.body.innerHTML = `
      <form>
        <input name="name">
        <input name="phone">
        <textarea name="msg"></textarea>
      </form>
    `;
    const out = (await fillForm({
      fields: [
        { selector: "input[name=name]", value: "张三" },
        { selector: "input[name=phone]", value: "13800000000" },
        { selector: "textarea[name=msg]", value: "你好" }
      ]
    })) as { filled: number; failed: unknown[] };
    expect(out.filled).toBe(3);
    expect(out.failed).toEqual([]);
    expect((document.querySelector("input[name=name]") as HTMLInputElement).value).toBe("张三");
  });

  it("collects per-field errors without aborting the batch", async () => {
    document.body.innerHTML = `<input name="ok">`;
    const out = (await fillForm({
      fields: [
        { selector: "input[name=ok]", value: "yes" },
        { selector: "input[name=missing]", value: "x" }
      ]
    })) as { filled: number; failed: Array<{ at: number; error: string }> };
    expect(out.filled).toBe(1);
    expect(out.failed.length).toBe(1);
    expect(out.failed[0].at).toBe(1);
  });

  it("rejects when fields is not an array", async () => {
    await expect(fillForm({})).rejects.toThrow(/fields array/);
  });
});

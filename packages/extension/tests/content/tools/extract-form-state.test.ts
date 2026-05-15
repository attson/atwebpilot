import { beforeEach, describe, expect, it } from "vitest";
import { extractFormState } from "@/content/tools/extract-form-state";

describe("extractFormState", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("reads named text inputs and textarea", async () => {
    document.body.innerHTML = `
      <form>
        <input name="user" value="alice" />
        <input name="email" value="a@b.com" />
        <textarea name="note">hi</textarea>
      </form>
    `;
    const r = (await extractFormState({})) as Record<string, unknown>;
    expect(r).toEqual({ user: "alice", email: "a@b.com", note: "hi" });
  });

  it("captures radio (selected value) and checkbox (boolean or array)", async () => {
    document.body.innerHTML = `
      <form>
        <input type="radio" name="g" value="m" />
        <input type="radio" name="g" value="f" checked />
        <input type="checkbox" name="terms" checked />
        <input type="checkbox" name="tag" value="a" checked />
        <input type="checkbox" name="tag" value="b" />
        <input type="checkbox" name="tag" value="c" checked />
      </form>
    `;
    const r = (await extractFormState({})) as Record<string, unknown>;
    expect(r.g).toBe("f");
    expect(r.terms).toBe(true);
    expect(r.tag).toEqual(["a", "c"]);
  });

  it("scopes to selector", async () => {
    document.body.innerHTML = `
      <form id="a"><input name="x" value="1" /></form>
      <form id="b"><input name="x" value="2" /></form>
    `;
    const r = (await extractFormState({ selector: "#b" })) as Record<string, unknown>;
    expect(r.x).toBe("2");
  });

  it("throws when form not found", async () => {
    document.body.innerHTML = `<div></div>`;
    await expect(extractFormState({ selector: "#missing" })).rejects.toThrow(/form not found/);
  });
});

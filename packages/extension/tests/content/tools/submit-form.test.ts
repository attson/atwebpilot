import { describe, expect, it, vi } from "vitest";
import { submitForm } from "@/content/tools/submit-form";

describe("submitForm", () => {
  it("dispatches submit event on form", async () => {
    document.body.innerHTML = `<form id="f"><input name="a" /></form>`;
    const f = document.querySelector<HTMLFormElement>("#f")!;
    let submitted = false;
    f.addEventListener("submit", (e) => {
      submitted = true;
      e.preventDefault();
    });
    const r = await submitForm({ selector: "#f" });
    expect(submitted).toBe(true);
    expect((r as Record<string, unknown>).submitted).toBe(true);
  });

  it("falls back to form.submit() when listener does not preventDefault", async () => {
    document.body.innerHTML = `<form id="f"><input name="a" /></form>`;
    const f = document.querySelector<HTMLFormElement>("#f")!;
    const submitSpy = vi.spyOn(f, "submit").mockImplementation(() => {});
    await submitForm({ selector: "#f" });
    expect(submitSpy).toHaveBeenCalled();
  });

  it("uses default 'form' selector when not given", async () => {
    document.body.innerHTML = `<form><input name="a" /></form>`;
    const f = document.querySelector<HTMLFormElement>("form")!;
    let submitted = false;
    f.addEventListener("submit", (e) => {
      submitted = true;
      e.preventDefault();
    });
    await submitForm({});
    expect(submitted).toBe(true);
  });

  it("throws when no form", async () => {
    document.body.innerHTML = `<div></div>`;
    await expect(submitForm({})).rejects.toThrow(/form not found/);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { navigate } from "@/content/tools/navigate";

describe("navigate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls history.back() and returns { ok, action }", async () => {
    const spy = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const r = await navigate({ action: "back" });
    expect(spy).toHaveBeenCalledOnce();
    expect(r).toEqual({ ok: true, action: "back" });
  });

  it("calls history.forward()", async () => {
    const spy = vi.spyOn(window.history, "forward").mockImplementation(() => {});
    const r = await navigate({ action: "forward" });
    expect(spy).toHaveBeenCalledOnce();
    expect(r).toEqual({ ok: true, action: "forward" });
  });

  it("calls location.reload()", async () => {
    const spy = vi.spyOn(window.location, "reload").mockImplementation(() => {});
    const r = await navigate({ action: "reload" });
    expect(spy).toHaveBeenCalledOnce();
    expect(r).toEqual({ ok: true, action: "reload" });
  });

  it("calls location.assign() for goto with https URL", async () => {
    const spy = vi.spyOn(window.location, "assign").mockImplementation(() => {});
    const r = await navigate({ action: "goto", url: "https://example.com/page" });
    expect(spy).toHaveBeenCalledWith("https://example.com/page");
    expect(r).toEqual({ ok: true, action: "goto", url: "https://example.com/page" });
  });

  it("allows http/file/ftp schemes for goto", async () => {
    const spy = vi.spyOn(window.location, "assign").mockImplementation(() => {});
    await navigate({ action: "goto", url: "http://x.test/" });
    await navigate({ action: "goto", url: "file:///tmp/x.html" });
    await navigate({ action: "goto", url: "ftp://x.test/y" });
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("throws on goto without url", async () => {
    await expect(navigate({ action: "goto" })).rejects.toThrow(/url required/);
  });

  it("throws on disallowed scheme", async () => {
    await expect(navigate({ action: "goto", url: "javascript:alert(1)" })).rejects.toThrow(
      /scheme not allowed/
    );
    await expect(navigate({ action: "goto", url: "data:text/html,x" })).rejects.toThrow(
      /scheme not allowed/
    );
  });

  it("throws on unknown action", async () => {
    await expect(navigate({ action: "spin" as never })).rejects.toThrow(/unknown action/);
  });
});

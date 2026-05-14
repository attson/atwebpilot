import { describe, expect, it, vi } from "vitest";
import { uploadFile } from "@/content/tools/upload-file";

function setupChromeMock(reply: { ok: boolean; data?: unknown; error?: string }) {
  const sendMessage = vi.fn().mockResolvedValue(reply);
  (globalThis as unknown as { chrome: typeof chrome }).chrome = {
    runtime: { sendMessage }
  } as unknown as typeof chrome;
  return sendMessage;
}

describe("uploadFile", () => {
  it("requests binary via BG and assigns File to input.files", async () => {
    document.body.innerHTML = `<input id="x" type="file" />`;
    const input = document.querySelector<HTMLInputElement>("#x")!;
    let changed = 0;
    input.addEventListener("change", () => changed++);

    const sendMessage = setupChromeMock({
      ok: true,
      data: { base64: btoa("hello"), mime: "text/plain", size: 5 }
    });

    const r = await uploadFile({
      selector: "#x",
      url: "https://example.com/x.txt",
      filename: "hello.txt"
    });

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "http.fetchBinary", url: "https://example.com/x.txt" })
    );
    expect(input.files?.length).toBe(1);
    expect(input.files?.[0].name).toBe("hello.txt");
    expect(input.files?.[0].type).toBe("text/plain");
    expect(changed).toBe(1);
    expect((r as Record<string, unknown>).uploaded).toBe(true);
  });

  it("falls back filename from URL when not given", async () => {
    document.body.innerHTML = `<input id="x" type="file" />`;
    setupChromeMock({
      ok: true,
      data: { base64: btoa("a"), mime: "image/png", size: 1 }
    });
    await uploadFile({ selector: "#x", url: "https://x.com/path/to/pic.png" });
    expect(
      document.querySelector<HTMLInputElement>("#x")!.files?.[0].name
    ).toBe("pic.png");
  });

  it("throws when target is not a file input", async () => {
    document.body.innerHTML = `<input id="x" type="text" />`;
    setupChromeMock({ ok: true, data: { base64: "", mime: "", size: 0 } });
    await expect(uploadFile({ selector: "#x", url: "https://x.com/a" })).rejects.toThrow(/not a file input/);
  });

  it("throws when BG returns ok:false", async () => {
    document.body.innerHTML = `<input id="x" type="file" />`;
    setupChromeMock({ ok: false, error: "404" });
    await expect(uploadFile({ selector: "#x", url: "https://x.com/a" })).rejects.toThrow(/download failed/);
  });
});

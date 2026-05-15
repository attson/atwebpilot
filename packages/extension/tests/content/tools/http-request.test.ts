import { describe, expect, it, vi } from "vitest";
import { httpRequestBridge } from "@/content/tools/http-request";

describe("httpRequest bridge", () => {
  it("forwards to background via chrome.runtime.sendMessage", async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      data: { status: 200, headers: {}, body: "{\"ok\":true}" }
    });
    (globalThis as unknown as { chrome: typeof chrome }).chrome = {
      runtime: { sendMessage }
    } as unknown as typeof chrome;

    const r = (await httpRequestBridge({
      url: "https://example.com/api",
      method: "GET"
    })) as Record<string, unknown>;

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "http.request",
        url: "https://example.com/api",
        method: "GET",
        withCredentials: false
      })
    );
    expect(r.status).toBe(200);
  });

  it("throws when bg returns ok:false", async () => {
    (globalThis as unknown as { chrome: typeof chrome }).chrome = {
      runtime: { sendMessage: vi.fn().mockResolvedValue({ ok: false, error: "blocked" }) }
    } as unknown as typeof chrome;
    await expect(httpRequestBridge({ url: "https://x.com", method: "GET" })).rejects.toThrow(
      /blocked/
    );
  });
});

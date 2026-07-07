import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";

// Minimal chrome mock
(globalThis as any).chrome = {
  action: {
    setBadgeText: vi.fn().mockResolvedValue(undefined),
    setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined)
  },
  runtime: {
    sendMessage: vi.fn().mockResolvedValue(undefined)
  },
  tabs: { onUpdated: { addListener: vi.fn() }, onCreated: { addListener: vi.fn() }, onRemoved: { addListener: vi.fn() } },
  webNavigation: { onHistoryStateUpdated: { addListener: vi.fn() } }
};

describe("refreshRecommendations includes matching presets", () => {
  it("wikipedia URL surfaces wikipedia-summary preset", async () => {
    const { refreshRecommendations } = await import("@/background/tab-watcher");
    await refreshRecommendations(1, "https://en.wikipedia.org/wiki/Rust_(programming_language)");
    const msg = (chrome.runtime.sendMessage as any).mock.calls
      .map((c: any[]) => c[0])
      .find((m: any) => m?.type === "tabs.recommendations");
    expect(msg).toBeTruthy();
    expect(msg.presets.map((p: any) => p.id)).toContain("wikipedia-summary");
  });

  it("any https URL always yields a presets array (article-translate-zh is universal)", async () => {
    (chrome.runtime.sendMessage as any).mockClear();
    const { refreshRecommendations } = await import("@/background/tab-watcher");
    await refreshRecommendations(1, "https://random.site/none");
    const msg = (chrome.runtime.sendMessage as any).mock.calls
      .map((c: any[]) => c[0])
      .find((m: any) => m?.type === "tabs.recommendations");
    // article-translate-zh has pattern "https://**" and matches all https URLs,
    // so presets will be non-empty. We verify the field is always an array.
    expect(Array.isArray(msg.presets)).toBe(true);
    expect(msg.presets.length).toBeGreaterThan(0);
  });
});

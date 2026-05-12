import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetDBForTests } from "@/background/storage/db";
import { saveDraft } from "@/background/storage/tools";
import { refreshRecommendations } from "@/background/tab-watcher";

const setBadgeText = vi.fn();
const setBadgeBackgroundColor = vi.fn();
const sendMessage = vi.fn().mockResolvedValue(undefined);

describe("tab-watcher", () => {
  beforeEach(() => {
    _resetDBForTests();
    indexedDB = new IDBFactory();
    setBadgeText.mockClear();
    setBadgeBackgroundColor.mockClear();
    sendMessage.mockClear();
    (globalThis as unknown as { chrome: typeof chrome }).chrome = {
      action: { setBadgeText, setBadgeBackgroundColor },
      runtime: { sendMessage }
    } as unknown as typeof chrome;
  });

  afterEach(() => _resetDBForTests());

  it("sets badge text when matching tools exist", async () => {
    await saveDraft({
      kind: "steps",
      name: "PDD",
      urlPatterns: ["https://*.yangkeduo.com/**"],
      description: "",
      steps: [{ kind: "tool", tool: "snapshotDOM", args: {} }],
      outputSchema: {}
    });
    await refreshRecommendations(7, "https://mobile.yangkeduo.com/goods.html");
    expect(setBadgeText).toHaveBeenCalledWith({ tabId: 7, text: "1" });
    expect(setBadgeBackgroundColor).toHaveBeenCalled();
  });

  it("clears badge when no match", async () => {
    await refreshRecommendations(8, "https://other.com/");
    expect(setBadgeText).toHaveBeenCalledWith({ tabId: 8, text: "" });
    expect(setBadgeBackgroundColor).not.toHaveBeenCalled();
  });

  it("broadcasts recommendations to sidepanel", async () => {
    await saveDraft({
      kind: "steps",
      name: "PDD",
      urlPatterns: ["https://*.yangkeduo.com/**"],
      description: "",
      steps: [{ kind: "tool", tool: "snapshotDOM", args: {} }],
      outputSchema: {}
    });
    const url = "https://mobile.yangkeduo.com/goods.html";
    await refreshRecommendations(9, url);
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "tabs.recommendations",
        tabId: 9,
        url,
        tools: expect.arrayContaining([expect.objectContaining({ name: "PDD" })])
      })
    );
  });

  it("swallows sidepanel sendMessage rejection", async () => {
    sendMessage.mockRejectedValueOnce(new Error("no listeners"));
    await expect(refreshRecommendations(10, "https://other.com/")).resolves.not.toThrow();
  });
});

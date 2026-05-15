import { matchingTools } from "./storage/tools";

export async function refreshRecommendations(tabId: number, url: string): Promise<void> {
  const tools = await matchingTools(url);
  await chrome.action.setBadgeText({
    tabId,
    text: tools.length ? String(tools.length) : ""
  });
  if (tools.length) {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#10b981" });
  }
  try {
    await chrome.runtime.sendMessage({
      type: "tabs.recommendations",
      tabId,
      url,
      tools
    });
  } catch {
    // sidepanel 不在听就 swallow
  }
}

export function installTabWatcher(): void {
  chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
    if (change.url) void refreshRecommendations(tabId, change.url);
    if (change.status === "complete" && (change.url || tab.url)) {
      void broadcast({
        type: "tabs.urlChanged",
        tabId,
        newUrl: change.url ?? tab.url ?? "",
        newTitle: tab.title ?? ""
      });
    }
  });
  chrome.webNavigation.onHistoryStateUpdated.addListener(({ tabId, url }) => {
    void refreshRecommendations(tabId, url);
    void broadcast({ type: "tabs.urlChanged", tabId, newUrl: url, newTitle: "" });
  });
  chrome.tabs.onCreated.addListener((tab) => {
    if (tab.id == null) return;
    void broadcast({
      type: "tabs.spawned",
      tabId: tab.id,
      openerTabId: tab.openerTabId ?? null,
      windowId: tab.windowId,
      url: tab.url ?? "",
      title: tab.title ?? ""
    });
  });
  chrome.tabs.onRemoved.addListener((tabId) => {
    void broadcast({ type: "tabs.removed", tabId });
  });
}

async function broadcast(msg: unknown): Promise<void> {
  try {
    await chrome.runtime.sendMessage(msg);
  } catch {
    // sidepanel 不在听就 swallow
  }
}

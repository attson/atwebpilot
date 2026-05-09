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
  chrome.tabs.onUpdated.addListener((tabId, change) => {
    if (!change.url) return;
    void refreshRecommendations(tabId, change.url);
  });
  chrome.webNavigation.onHistoryStateUpdated.addListener(({ tabId, url }) => {
    void refreshRecommendations(tabId, url);
  });
}

import * as ss from "@/sidepanel/chat/persistence/sessions-storage";

async function handleTabRemoved(tabId: number): Promise<void> {
  try {
    const active = await ss.getActiveByTabId(tabId);
    if (!active) return;
    await ss.archiveActive(active.id);
    const evicted = await ss.pruneOverLimit(active.url);
    if (evicted.length > 0) await ss.cascadeDeleteRuns(evicted);
  } catch (e) {
    console.warn("[persistence] tab-close-archiver failed (non-fatal)", e);
  }
}

export function installTabCloseArchiver(): () => void {
  const listener = (tabId: number) => { void handleTabRemoved(tabId); };
  chrome.tabs.onRemoved.addListener(listener);
  return () => chrome.tabs.onRemoved.removeListener(listener);
}

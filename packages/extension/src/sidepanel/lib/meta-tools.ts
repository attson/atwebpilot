/**
 * Sidepanel-side handlers for the round-5 meta tools (closeTab / switchToTab /
 * searchBookmarks / searchHistory / downloadImage). They live in the sidepanel
 * because they only need chrome.* APIs that are available there, not in the
 * content script.
 *
 * All handlers reject if the underlying chrome.* API isn't available so that
 * the LLM gets a clear error rather than a silent no-op.
 */

export type MetaHandler = (input: unknown) => Promise<unknown>;

function asObj(raw: unknown): Record<string, unknown> {
  return (raw ?? {}) as Record<string, unknown>;
}

async function closeTab(raw: unknown, allowedTabIds: () => Set<number>): Promise<unknown> {
  const { tabId } = asObj(raw) as { tabId?: number };
  if (typeof tabId !== "number") throw new Error("closeTab: tabId required");
  if (!allowedTabIds().has(tabId)) {
    throw new Error(`closeTab: tab ${tabId} not in attachedTabs; use attachTab first`);
  }
  await chrome.tabs.remove(tabId);
  return { ok: true, tabId };
}

async function switchToTab(raw: unknown, allowedTabIds: () => Set<number>, mainTabId: number): Promise<unknown> {
  const { tabId } = asObj(raw) as { tabId?: number };
  if (typeof tabId !== "number") throw new Error("switchToTab: tabId required");
  if (tabId !== mainTabId && !allowedTabIds().has(tabId)) {
    throw new Error(`switchToTab: tab ${tabId} not attached; use attachTab first`);
  }
  const tab = await chrome.tabs.update(tabId, { active: true });
  if (tab.windowId != null) {
    try {
      await chrome.windows.update(tab.windowId, { focused: true });
    } catch {
      // window focus may fail on some platforms; ignore
    }
  }
  return { ok: true, tabId, url: tab.url ?? null };
}

async function searchBookmarks(raw: unknown): Promise<unknown> {
  const { query, limit } = asObj(raw) as { query?: string; limit?: number };
  if (typeof query !== "string" || query.trim() === "") {
    throw new Error("searchBookmarks: query required");
  }
  if (!chrome.bookmarks?.search) throw new Error("searchBookmarks: bookmarks API unavailable");
  const nodes = await chrome.bookmarks.search(query);
  const cap = typeof limit === "number" && limit > 0 ? limit : 50;
  return nodes
    .filter((n) => !!n.url)
    .slice(0, cap)
    .map((n) => ({ id: n.id, title: n.title, url: n.url! }));
}

async function searchHistory(raw: unknown): Promise<unknown> {
  const { query, daysBack, limit } = asObj(raw) as {
    query?: string;
    daysBack?: number;
    limit?: number;
  };
  if (typeof query !== "string") throw new Error("searchHistory: query required");
  if (!chrome.history?.search) throw new Error("searchHistory: history API unavailable");
  const start = Date.now() - (daysBack && daysBack > 0 ? daysBack : 7) * 24 * 60 * 60 * 1000;
  const items = await chrome.history.search({
    text: query,
    startTime: start,
    maxResults: typeof limit === "number" && limit > 0 ? limit : 50,
  });
  return items.map((h) => ({
    url: h.url,
    title: h.title,
    lastVisitTime: h.lastVisitTime,
    visitCount: h.visitCount,
  }));
}

async function downloadImage(raw: unknown): Promise<unknown> {
  const { url, filename } = asObj(raw) as { url?: string; filename?: string };
  if (typeof url !== "string") throw new Error("downloadImage: url required");
  if (!chrome.downloads?.download) throw new Error("downloadImage: downloads API unavailable");
  const id = await chrome.downloads.download({
    url,
    filename: filename || undefined,
    saveAs: false,
  });
  return { downloadId: id, filename: filename || null };
}

export function buildMetaTools(opts: {
  attachedTabIds: () => number[];
  mainTabId: number;
}): Record<string, MetaHandler> {
  const allowed = () => new Set([...opts.attachedTabIds(), opts.mainTabId]);
  return {
    closeTab: (raw) => closeTab(raw, allowed),
    switchToTab: (raw) => switchToTab(raw, allowed, opts.mainTabId),
    searchBookmarks,
    searchHistory,
    downloadImage,
  };
}

import type { MentionBookmarkOption } from "@/sidepanel/input/mention-picker";

/**
 * Walks chrome.bookmarks tree and returns leaf nodes (those with a `url`).
 * Folder nodes are skipped. Limited to `cap` entries for picker performance.
 */
export async function loadBookmarks(cap = 500): Promise<MentionBookmarkOption[]> {
  try {
    if (!chrome.bookmarks?.getTree) return [];
    const trees = await chrome.bookmarks.getTree();
    const out: MentionBookmarkOption[] = [];
    walk(trees, out, cap);
    return out;
  } catch {
    return [];
  }
}

function walk(nodes: chrome.bookmarks.BookmarkTreeNode[], out: MentionBookmarkOption[], cap: number): void {
  for (const n of nodes) {
    if (out.length >= cap) return;
    if (n.url) {
      out.push({ id: n.id, title: n.title || n.url, url: n.url });
    }
    if (n.children) walk(n.children, out, cap);
  }
}

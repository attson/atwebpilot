/**
 * Per-tab UID cache. Maps uid → Element captured by takeSnapshot. Lookups stay
 * O(1). The cache is cleared when takeSnapshot is re-run on the same tab or
 * after a 5-minute idle TTL (via getElementByUid touching `lastUse`).
 *
 * The Element WeakRef is held to avoid leaking detached nodes — if the page
 * disposed the element between snapshot and click, we'll get null and surface
 * "stale snapshot" to the LLM.
 */

const TTL_MS = 5 * 60 * 1000;

type CacheEntry = { ref: WeakRef<Element>; created: number };

let cache: Map<string, CacheEntry> | null = null;
let counter = 0;

function ensure(): Map<string, CacheEntry> {
  if (!cache) cache = new Map();
  return cache;
}

export function resetUidCache(): void {
  cache = new Map();
}

export function nextUid(): string {
  counter += 1;
  return `el_${counter}`;
}

export function recordUid(uid: string, el: Element): void {
  ensure().set(uid, { ref: new WeakRef(el), created: Date.now() });
}

export function lookupUid(uid: string): Element | null {
  const c = ensure().get(uid);
  if (!c) return null;
  if (Date.now() - c.created > TTL_MS) {
    ensure().delete(uid);
    return null;
  }
  const el = c.ref.deref();
  if (!el) {
    ensure().delete(uid);
    return null;
  }
  return el;
}

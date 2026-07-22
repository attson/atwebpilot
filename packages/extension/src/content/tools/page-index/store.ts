import { buildPageIndex } from "./build";
import { DEFAULT_MAX_BLOCKS, MAX_INDEX_BLOCKS, type PageBlock, type PageIndex } from "./types";

let current: PageIndex | null = null;
const byCacheKey = new Map<string, PageIndex>();
const byIndexId = new Map<string, PageIndex>();

function cacheKey(url: string, maxBlocks: number): string {
  return `${url}\n${maxBlocks}`;
}

function remember(index: PageIndex): PageIndex {
  current = index;
  byCacheKey.set(cacheKey(index.url, index.maxBlocks), index);
  byIndexId.set(index.indexId, index);
  return index;
}

export function getPageIndex(args: { maxBlocks?: number; refresh?: boolean } = {}): PageIndex {
  const maxBlocks = Math.min(MAX_INDEX_BLOCKS, Math.max(1, Math.floor(args.maxBlocks ?? DEFAULT_MAX_BLOCKS)));
  const key = cacheKey(location.href, maxBlocks);
  if (args.refresh) return remember(buildPageIndex({ maxBlocks }));

  const cached = byCacheKey.get(key);
  if (cached) {
    current = cached;
    return cached;
  }

  return remember(buildPageIndex({ maxBlocks }));
}

export function findBlock(blockId: string, indexId?: string): { index: PageIndex | null; block: PageBlock | null; indexMissing: boolean } {
  if (indexId) {
    const indexed = byIndexId.get(indexId);
    if (!indexed) return { index: null, block: null, indexMissing: true };
    return { index: indexed, block: indexed.blocks.find((block) => block.blockId === blockId) ?? null, indexMissing: false };
  }

  const index = current ?? getPageIndex();
  return { index, block: index.blocks.find((block) => block.blockId === blockId) ?? null, indexMissing: false };
}

export function clearPageIndexForTests(): void {
  current = null;
  byCacheKey.clear();
  byIndexId.clear();
}

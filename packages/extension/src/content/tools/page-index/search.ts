import { FIELD_EVIDENCE_CHARS, MAX_MATCH_LIMIT, SEARCH_SNIPPET_CHARS, type PageBlock, type PageIndex } from "./types";
import { makeWindowPreview, normalizeText, tokenizeQuery, visibleText } from "./text";

type SearchArgs = {
  query?: string;
  fields?: string[];
  limit?: number;
};

type ExtractArgs = {
  fields: string[];
  maxCandidatesPerField?: number;
};

const FIELD_ALIASES: Record<string, string[]> = {
  asin: ["asin", "product id", "product identifier"],
  "品牌": ["品牌", "brand", "brand name", "manufacturer", "maker"],
  brand: ["brand", "brand name", "manufacturer", "maker", "品牌"],
  "价格": ["价格", "price", "sale price", "list price", "current price"],
  price: ["price", "sale price", "list price", "current price", "价格"],
  "评分": ["rating", "ratings", "reviews", "customer reviews", "评分", "评论"],
  rating: ["rating", "ratings", "reviews", "customer reviews", "评分", "评论"],
  ratings: ["rating", "ratings", "reviews", "customer reviews", "评分", "评论"],
  "排名": ["排名", "rank", "ranking", "best sellers rank", "best seller rank", "category rank"],
  rank: ["rank", "ranking", "best sellers rank", "best seller rank", "category rank", "排名"],
  "30天销量": ["30天销量", "30 天销量", "月销量", "销量", "past month", "bought in past month", "sold in past month"],
  "上架时间": ["上架时间", "发布日期", "date first available", "available since", "release date"],
  "库存": ["库存", "stock", "availability", "in stock", "available"]
};

function aliasesFor(field: string): string[] {
  const normalized = normalizeText(field);
  return FIELD_ALIASES[field] ?? FIELD_ALIASES[normalized] ?? [field];
}

function usefulTokens(input: string | string[] | undefined): string[] {
  return tokenizeQuery(input).filter((token) => /[\u4e00-\u9fa5]/.test(token) || token.length >= 3 || /\d/.test(token));
}

function normalizedParts(block: PageBlock): { label: string; value: string; text: string; headings: string } {
  const label = normalizeText(block.label ?? "");
  const value = normalizeText(block.value ?? "");
  const text = normalizeText(block.text);
  const headings = normalizeText(block.headingPath.join(" "));
  return { label, value, text, headings };
}

function scoreBlock(block: PageBlock, tokens: string[], phrases: string[]): number {
  const parts = normalizedParts(block);
  let score = 0;

  for (const phrase of phrases.map(normalizeText).filter(Boolean)) {
    if (parts.label === phrase) score += 40;
    else if (parts.label.includes(phrase)) score += 24;
    if (parts.value.includes(phrase)) score += 10;
    if (parts.text.includes(phrase)) score += block.kind === "kv" ? 16 : 10;
    if (parts.headings.includes(phrase)) score += 5;
  }

  for (const token of tokens) {
    if (parts.label === token) score += 16;
    else if (parts.label.includes(token)) score += 9;
    if (parts.value.includes(token)) score += 4;
    if (parts.text.includes(token)) score += block.kind === "kv" ? 6 : 3;
    if (parts.headings.includes(token)) score += 2;
  }

  if (score > 0 && block.kind === "kv") score += 8;
  return score;
}

function findMatchOffset(block: PageBlock, terms: string[]): number {
  const text = visibleText(block.text).toLowerCase();
  const candidates = terms
    .map(visibleText)
    .filter((term) => term.length > 0)
    .sort((a, b) => b.length - a.length);

  let best = -1;
  for (const term of candidates) {
    const index = text.indexOf(term.toLowerCase());
    if (index >= 0 && (best < 0 || index < best)) best = index;
  }

  return best >= 0 ? best : 0;
}

function toSearchMatch(block: PageBlock, score: number, tokens: string[], phrases: string[]) {
  const offset = findMatchOffset(block, [...phrases, ...tokens]);
  const preview = makeWindowPreview(block.text, SEARCH_SNIPPET_CHARS, block.blockId, "search_match", "evidence_budget", offset);
  return {
    blockId: block.blockId,
    kind: block.kind,
    score,
    ...(block.label ? { label: block.label } : {}),
    text: preview.text,
    complete: preview.complete,
    availableChars: preview.availableChars,
    previewOffset: preview.offset,
    selectorHint: block.selectorHint,
    truncation: preview.truncation
  };
}

export function searchIndex(index: PageIndex, args: SearchArgs) {
  const phrases = [args.query ?? "", ...(args.fields ?? [])].filter(Boolean);
  const tokens = usefulTokens(phrases);
  const matches = index.blocks
    .map((block) => ({ block, score: scoreBlock(block, tokens, phrases) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.block.order - b.block.order)
    .slice(0, Math.min(MAX_MATCH_LIMIT, Math.max(1, Math.floor(args.limit ?? 20))))
    .map((item) => toSearchMatch(item.block, item.score, tokens, phrases));

  return {
    indexId: index.indexId,
    matches,
    truncated: index.truncated,
    ...(index.truncation ? { truncation: index.truncation } : {})
  };
}

function textWithoutLabel(block: PageBlock): string {
  if (!block.label) return block.text;
  const normalizedLabel = normalizeText(block.label);
  const normalizedText = normalizeText(block.text);
  if (!normalizedText.startsWith(normalizedLabel)) return block.text;

  return block.text.slice(block.label.length).trim();
}

function valueFor(block: PageBlock, field: string): string {
  if (block.value) return block.value;

  const text = textWithoutLabel(block);
  const normalizedField = normalizeText(field);
  if (normalizedField === "asin" || /\basin\b/i.test(field)) {
    const asin = text.match(/\b[A-Z0-9]{10}\b/i);
    if (asin) return asin[0].toUpperCase();
  }

  if (normalizedField.includes("价格") || /\bprice\b/i.test(field)) {
    const price = text.match(/(?:[$￥¥]\s*)?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?/);
    if (price) return price[0].replace(/\s+/g, "");
  }

  return text;
}

export function extractFields(index: PageIndex, args: ExtractArgs) {
  const maxCandidates = Math.min(MAX_MATCH_LIMIT, Math.max(1, Math.floor(args.maxCandidatesPerField ?? 4)));
  const fields = args.fields.map((field) => {
    const aliases = aliasesFor(field);
    const tokens = usefulTokens(aliases);
    const candidates = index.blocks
      .map((block) => ({ block, score: scoreBlock(block, tokens, aliases) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.block.order - b.block.order)
      .slice(0, maxCandidates)
      .map(({ block, score }) => {
        const offset = findMatchOffset(block, [block.value ?? "", ...aliases, ...tokens]);
        const preview = makeWindowPreview(
          block.text,
          FIELD_EVIDENCE_CHARS,
          block.blockId,
          "field_evidence",
          "evidence_budget",
          offset
        );
        return {
          value: valueFor(block, field),
          confidence: Math.min(0.95, 0.4 + score / 80),
          source: block.kind === "kv" ? "label-neighbor" : "text-match",
          blockId: block.blockId,
          ...(block.label ? { label: block.label } : {}),
          evidence: preview.text,
          complete: preview.complete,
          availableChars: preview.availableChars,
          previewOffset: preview.offset,
          truncation: preview.truncation
        };
      });

    return { field, candidates };
  });

  return {
    indexId: index.indexId,
    fields,
    missing: fields.filter((field) => field.candidates.length === 0).map((field) => field.field),
    truncated: index.truncated,
    ...(index.truncation ? { truncation: index.truncation } : {})
  };
}

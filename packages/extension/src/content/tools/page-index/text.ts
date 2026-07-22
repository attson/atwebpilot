import type { Preview, TruncationInfo } from "./types";

export function visibleText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function normalizeText(s: string): string {
  return visibleText(s)
    .toLowerCase()
    .replace(/[：:|｜,，;；()[\]{}<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeQuery(input: string | string[] | undefined): string[] {
  const joined = Array.isArray(input) ? input.join(" ") : input ?? "";
  const normalized = normalizeText(joined);
  const tokens = normalized.match(/[0-9]+[\u4e00-\u9fa5]+|[\u4e00-\u9fa5]+[a-z0-9]*|[a-z0-9]+(?:\.[a-z0-9]+)?/g);
  return Array.from(new Set(tokens ?? []));
}

export function makePreview(
  text: string,
  maxChars: number,
  ref: string,
  reason: string,
  kind: TruncationInfo["kind"] = "preview"
): Preview {
  const clean = visibleText(text);
  if (clean.length <= maxChars) {
    return {
      text: clean,
      complete: true,
      availableChars: clean.length,
      offset: 0,
      truncation: {
        kind: "none",
        originalChars: clean.length,
        returnedChars: clean.length,
        reason: "none",
        ref
      }
    };
  }

  const returned = clean.slice(0, maxChars);
  return {
    text: returned,
    complete: false,
    availableChars: clean.length,
    offset: 0,
    truncation: {
      kind,
      originalChars: clean.length,
      returnedChars: returned.length,
      reason,
      ref
    }
  };
}

export function makeWindowPreview(
  text: string,
  maxChars: number,
  ref: string,
  reason: string,
  kind: TruncationInfo["kind"],
  anchorAt: number
): Preview {
  const clean = visibleText(text);
  if (clean.length <= maxChars) {
    return makePreview(clean, maxChars, ref, reason, kind);
  }

  const safeAnchor = Math.min(Math.max(0, Math.floor(anchorAt)), clean.length - 1);
  const preferredBefore = Math.floor(maxChars * 0.35);
  const offset = Math.max(0, Math.min(safeAnchor - preferredBefore, clean.length - maxChars));
  const returned = clean.slice(offset, offset + maxChars);
  return {
    text: returned,
    complete: false,
    availableChars: clean.length,
    offset,
    truncation: {
      kind,
      originalChars: clean.length,
      returnedChars: returned.length,
      reason,
      ref
    }
  };
}

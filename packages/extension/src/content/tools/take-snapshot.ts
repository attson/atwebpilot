import type { Json } from "@atwebpilot/shared/types";
import { nextUid, recordUid, resetUidCache } from "./uid-cache";

const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "input:not([type=hidden])",
  "textarea",
  "select",
  "[role=button]",
  "[role=link]",
  "[role=checkbox]",
  "[role=radio]",
  "[role=tab]",
  "[contenteditable=true]",
  "[data-testid]",
].join(", ");

function elText(el: Element): string {
  const t = (el as HTMLElement).innerText ?? el.textContent ?? "";
  return t.trim().slice(0, 80);
}

function elRole(el: Element): string {
  return el.getAttribute("role") || el.tagName.toLowerCase();
}

function elName(el: Element): string {
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel;
  const placeholder = el.getAttribute("placeholder");
  if (placeholder) return placeholder;
  const name = el.getAttribute("name");
  if (name) return name;
  const text = elText(el);
  if (text) return text;
  return "";
}

function bounds(el: Element): { x: number; y: number; w: number; h: number } {
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
}

export async function takeSnapshot(args: Json): Promise<Json> {
  const opts = (args ?? {}) as { includeAll?: boolean };
  resetUidCache();
  const selector = opts.includeAll
    ? "body *"
    : INTERACTIVE_SELECTOR;
  const nodes = Array.from(document.querySelectorAll(selector));
  const out: Array<{
    uid: string;
    role: string;
    name: string;
    tag: string;
    text: string;
    bounds: { x: number; y: number; w: number; h: number };
  }> = [];
  for (const el of nodes) {
    // Skip elements outside the viewport with zero size (most likely hidden)
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const uid = nextUid();
    recordUid(uid, el);
    out.push({
      uid,
      role: elRole(el),
      name: elName(el),
      tag: el.tagName.toLowerCase(),
      text: elText(el),
      bounds: bounds(el),
    });
    if (out.length >= 500) break; // sanity cap
  }
  return out as unknown as Json;
}

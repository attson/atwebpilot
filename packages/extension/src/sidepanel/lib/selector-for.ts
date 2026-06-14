/**
 * Generate a CSS selector for an element. Basic priority:
 *  1. element.id            → `#id`
 *  2. element[data-testid]  → `[data-testid="..."]`
 *  3. element.name          → `<tag>[name="..."]`
 *  4. nth-of-type chain from root → `body > div:nth-of-type(2) > ul > li:nth-of-type(5)`
 *
 * Kept side-effect free + DOM-only so the same code can run in a content
 * script and be unit-tested with happy-dom.
 */
export function selectorFor(el: Element): string {
  if (el.id) return `#${cssEscape(el.id)}`;
  const tid = el.getAttribute("data-testid");
  if (tid) return `[data-testid="${cssEscape(tid)}"]`;
  const name = el.getAttribute("name");
  if (name) return `${el.tagName.toLowerCase()}[name="${cssEscape(name)}"]`;
  return cssPath(el);
}

function cssPath(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur.nodeType === 1 && cur.tagName.toLowerCase() !== "html") {
    const node: Element = cur;
    const tag = node.tagName.toLowerCase();
    const parent: Element | null = node.parentElement;
    if (!parent) {
      parts.unshift(tag);
      break;
    }
    const siblings = (Array.from(parent.children) as Element[]).filter(
      (c) => c.tagName === node.tagName
    );
    if (siblings.length === 1) {
      parts.unshift(tag);
    } else {
      const idx = siblings.indexOf(node) + 1;
      parts.unshift(`${tag}:nth-of-type(${idx})`);
    }
    cur = parent;
  }
  return parts.join(" > ");
}

function cssEscape(s: string): string {
  // Minimal escape: just the characters that break attribute selectors here.
  return s.replace(/(["\\])/g, "\\$1");
}

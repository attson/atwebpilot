import type { Json } from "@atwebpilot/shared/types";

type Args = {
  selector: string;
  value: string;
  clear?: boolean;
};

export async function fillInput(args: Json): Promise<Json> {
  const { selector, value, clear = true } = (args ?? {}) as Args;
  const el = document.querySelector(selector);
  if (!el) throw new Error(`selector miss: ${selector}`);

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.value = clear ? value : el.value + value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return { filled: true, kind: el.tagName.toLowerCase() };
  }

  if (el instanceof HTMLElement && isEditable(el)) {
    el.textContent = clear ? value : (el.textContent ?? "") + value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return { filled: true, kind: "contenteditable" };
  }

  throw new Error(`not an input/textarea/contenteditable: ${selector}`);
}

function isEditable(el: HTMLElement): boolean {
  if (el.isContentEditable) return true;
  const attr = el.getAttribute("contenteditable");
  return attr === "" || attr === "true" || attr === "plaintext-only";
}

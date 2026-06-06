import type { Json } from "@atwebpilot/shared/types";

type Args = { selector: string; required?: boolean };

export async function click(args: Json): Promise<Json> {
  const { selector, required = true } = (args ?? {}) as Args;
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) {
    if (required) throw new Error(`click: selector not found: ${selector}`);
    return { clicked: false };
  }
  el.click();
  return { clicked: true };
}

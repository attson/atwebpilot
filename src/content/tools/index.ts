import type { BuiltinTool, Json } from "@/shared/types";
import { extractImages } from "./extract-images";
import { extractText } from "./extract-text";
import { querySelector, querySelectorAll } from "./query";
import { scroll } from "./scroll";
import { snapshotDOM } from "./snapshot-dom";
import { waitFor } from "./wait-for";

export type ToolFn = (args: Json) => Promise<Json>;

export const TOOLS: Partial<Record<BuiltinTool, ToolFn>> = {
  snapshotDOM,
  querySelector,
  querySelectorAll,
  extractText,
  extractImages,
  scroll,
  waitFor
};

export async function callTool(name: BuiltinTool, args: Json): Promise<Json> {
  const fn = TOOLS[name];
  if (!fn) throw new Error(`tool not implemented: ${name}`);
  return fn(args);
}

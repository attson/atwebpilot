import type { BuiltinTool, Json } from "@/shared/types";
import { extractImages } from "./extract-images";
import { extractText } from "./extract-text";
import { querySelector, querySelectorAll } from "./query";
import { snapshotDOM } from "./snapshot-dom";

export type ToolFn = (args: Json) => Promise<Json>;

export const TOOLS: Partial<Record<BuiltinTool, ToolFn>> = {
  snapshotDOM,
  querySelector,
  querySelectorAll,
  extractText,
  extractImages
};

export async function callTool(name: BuiltinTool, args: Json): Promise<Json> {
  const fn = TOOLS[name];
  if (!fn) throw new Error(`tool not implemented: ${name}`);
  return fn(args);
}

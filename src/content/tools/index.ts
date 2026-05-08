import type { BuiltinTool, Json } from "@/shared/types";
import { click } from "./click";
import { extractImages } from "./extract-images";
import { extractText } from "./extract-text";
import { httpRequestBridge } from "./http-request";
import { querySelector, querySelectorAll } from "./query";
import { readStorage } from "./read-storage";
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
  waitFor,
  click,
  readStorage,
  httpRequest: httpRequestBridge
};

export async function callTool(name: BuiltinTool, args: Json): Promise<Json> {
  const fn = TOOLS[name];
  if (!fn) throw new Error(`tool not implemented: ${name}`);
  return fn(args);
}

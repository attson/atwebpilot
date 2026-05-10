import type { BuiltinTool, Json } from "@/shared/types";
import { click } from "./click";
import { extractFormState } from "./extract-form-state";
import { extractImages } from "./extract-images";
import { extractText } from "./extract-text";
import { fillInput } from "./fill-input";
import { focus } from "./focus";
import { getValue } from "./get-value";
import { hover } from "./hover";
import { httpRequestBridge } from "./http-request";
import { querySelector, querySelectorAll } from "./query";
import { readStorage } from "./read-storage";
import { scroll } from "./scroll";
import { selectOption } from "./select-option";
import { setCheckbox } from "./set-checkbox";
import { snapshotDOM } from "./snapshot-dom";
import { submitForm } from "./submit-form";
import { uploadFile } from "./upload-file";
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
  httpRequest: httpRequestBridge,
  fillInput,
  setCheckbox,
  selectOption,
  submitForm,
  hover,
  focus,
  uploadFile,
  getValue,
  extractFormState
};

export async function callTool(name: BuiltinTool, args: Json): Promise<Json> {
  const fn = TOOLS[name];
  if (!fn) throw new Error(`tool not implemented: ${name}`);
  return fn(args);
}

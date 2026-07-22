import { highestSeverity, runStaticScan } from "@atwebpilot/shared/static-scan";
import type { Json } from "@atwebpilot/shared/types";

export type ToolSeverity = "safe" | "caution" | "dangerous";

export type PermissionMode = "read" | "default" | "trust" | "yolo";

const SAFE = new Set([
  "snapshotDOM",
  "querySelector",
  "querySelectorAll",
  "extractText",
  "extractImages",
  "scroll",
  "waitFor",
  "hover",
  "focus",
  "getValue",
  "extractFormState",
  "detachTab",
  "askUser",
  "screenshot",
  // Round 5 — meta + visual
  "searchBookmarks",
  "searchHistory",
  "switchToTab",
  "closeTab",
  "takeSnapshot",
  "highlightElement",
  "highlightText",
  // Round 6
  "getPageInfo",
  // Page Context Index — local read-only helpers
  "createPageIndex",
  "searchPageIndex",
  "readPageBlock",
  "extractPageFields"
]);

const CAUTION = new Set([
  "click",
  "fillInput",
  "setCheckbox",
  "selectOption",
  "listTabs",
  "openTab",
  "attachTab",
  // Round 5 — write actions
  "clickByUid",
  "fillByUid",
  "fillForm",
  "downloadImage",
  "downloadSpreadsheet",
  // Round 6
  "pressKey"
]);

const DANGEROUS_FIXED = new Set([
  "readStorage",
  "submitForm",
  "uploadFile",
  // Round 6
  "writeStorage"
]);

export function classifyTool(name: string, input: Json): ToolSeverity {
  if (SAFE.has(name)) return "safe";
  if (CAUTION.has(name)) return "caution";
  if (DANGEROUS_FIXED.has(name)) return "dangerous";
  if (name === "httpRequest") {
    const withCred = isObject(input) && (input as Record<string, Json>).withCredentials === true;
    return withCred ? "dangerous" : "caution";
  }
  if (name === "runJS") {
    const source = isObject(input) ? ((input as Record<string, Json>).source as string | undefined) : undefined;
    if (!source) return "caution";
    const sev = highestSeverity(runStaticScan(source));
    if (sev === "dangerous") return "dangerous";
    return "caution";
  }
  if (name === "navigate") {
    const action = isObject(input) ? (input as Record<string, Json>).action : undefined;
    return action === "goto" ? "caution" : "safe";
  }
  return "dangerous";
}

/** Decide whether a tool call auto-runs under a given permission mode. */
export function evaluateAutoApproval(
  toolName: string,
  severity: ToolSeverity,
  mode: PermissionMode,
  trustedDangerTools: string[]
): boolean {
  if (mode === "yolo") return true;
  if (severity === "safe") return true;
  if (mode === "read") return false;
  if (severity === "caution") return true;
  // severity === "dangerous"
  if (mode === "trust") return trustedDangerTools.includes(toolName);
  return false; // default
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

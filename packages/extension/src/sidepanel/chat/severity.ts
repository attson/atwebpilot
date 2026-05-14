import { highestSeverity, runStaticScan } from "@webpilot/shared/static-scan";
import type { Json } from "@webpilot/shared/types";

export type ToolSeverity = "safe" | "caution" | "dangerous";

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
  "detachTab"
]);

const CAUTION = new Set([
  "click",
  "fillInput",
  "setCheckbox",
  "selectOption",
  "listTabs",
  "openTab",
  "attachTab"
]);

const DANGEROUS_FIXED = new Set([
  "readStorage",
  "submitForm",
  "uploadFile"
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
  return "dangerous";
}

export function autoApproves(
  severity: ToolSeverity,
  toolName: string,
  approveAllSafe: boolean,
  dangerousAllowlist: string[]
): boolean {
  if (severity === "safe") return true;
  if (dangerousAllowlist.includes(toolName)) return true;
  if (severity === "caution") return approveAllSafe;
  if (severity === "dangerous") return false;
  return false;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

import { highestSeverity, runStaticScan } from "@/shared/static-scan";
import type { Json } from "@/shared/types";

export type ToolSeverity = "safe" | "caution" | "dangerous";

const SAFE = new Set([
  "snapshotDOM",
  "querySelector",
  "querySelectorAll",
  "extractText",
  "extractImages",
  "scroll",
  "waitFor"
]);

export function classifyTool(name: string, input: Json): ToolSeverity {
  if (SAFE.has(name)) return "safe";
  if (name === "click") return "caution";
  if (name === "readStorage") return "dangerous";
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

export function autoApproves(severity: ToolSeverity, approveAllSafe: boolean): boolean {
  if (severity === "safe") return true;
  if (severity === "caution") return approveAllSafe;
  return false;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

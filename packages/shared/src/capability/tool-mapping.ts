import type { BuiltinTool } from "../types";
import type { Capability } from "./catalog";

/**
 * Maps each extension built-in tool to the capability needed to call it.
 * Source of truth: spec §7.1 table. Keep in sync with shared/types.ts BuiltinTool.
 *
 * httpRequest is callable two ways (cookied / no-cookie); the caller must
 * pass `cookied: boolean` to disambiguate. Same for runJS (scanned/unsafe).
 */
export function capabilityForTool(
  tool: BuiltinTool,
  opts?: { httpCookied?: boolean; runJsUnsafe?: boolean }
): Capability {
  switch (tool) {
    case "snapshotDOM":
    case "querySelector":
    case "querySelectorAll":
    case "extractText":
    case "extractFormState":
    case "getValue":
      return "read:dom";
    case "extractImages":
      return "read:image";
    case "readStorage":
      return "read:storage";
    case "hover":
    case "focus":
    case "scroll":
    case "waitFor":
      return "nav:tab";
    case "click":
    case "fillInput":
    case "setCheckbox":
    case "selectOption":
      return "interact:form";
    case "submitForm":
      return "submit:form";
    case "uploadFile":
      return "upload:file";
    case "httpRequest":
      return opts?.httpCookied ? "httpRequest:cookied" : "httpRequest:no-cookie";
    case "askUser":
      // askUser doesn't touch the page — it's a sidepanel-only UI prompt.
      // Treat as the lightest read capability since DOM is never accessed.
      return "read:dom";
    case "screenshot":
      // Visual read of the rendered tab; no DOM mutation. Treat as image read.
      return "read:image";
    // Round 5 — meta / UI helpers
    case "closeTab":
    case "switchToTab":
      return "tab:open";
    case "searchBookmarks":
    case "searchHistory":
      return "read:dom";
    case "downloadImage":
      return "submit:form"; // writes to user's disk — treat as side-effect
    case "takeSnapshot":
      return "read:dom";
    case "clickByUid":
      return "interact:form";
    case "fillByUid":
    case "fillForm":
      return "interact:form";
    case "highlightElement":
    case "highlightText":
      return "read:dom"; // visual-only overlay
    // Round 6 — common helpers
    case "navigate":
      return "nav:tab";
    case "getPageInfo":
      return "read:dom";
    case "pressKey":
      return "interact:form";
    case "writeStorage":
      return "read:storage";
    default: {
      const _exhaustive: never = tool;
      throw new Error(`capabilityForTool: unknown tool ${_exhaustive}`);
    }
  }
}

/**
 * runJS is special — capability depends on the static-scan verdict, which is
 * decided by the caller. This helper takes the bool directly.
 */
export function capabilityForRunJs(unsafe: boolean): Capability {
  return unsafe ? "runJS:unsafe" : "runJS:scanned";
}

/**
 * Capability required for the control-plane tab operations.
 */
export const TAB_OPEN_CAPABILITY: Capability = "tab:open";

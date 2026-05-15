/**
 * Complete capability catalog from spec §7.1. Each capability is a string in
 * "category:name" form. Sets of capabilities make up a session's "scope" —
 * what tools the AI is allowed to call within that session.
 */
export const CAPABILITIES = [
  "read:dom",
  "read:image",
  "read:storage",
  "nav:tab",
  "interact:form",
  "submit:form",
  "upload:file",
  "httpRequest:no-cookie",
  "httpRequest:cookied",
  "runJS:scanned",
  "runJS:unsafe",
  "tab:open"
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/** Capabilities that are auto-granted on every session (safe). */
export const IMPLICIT_CAPABILITIES = new Set<Capability>([
  "read:dom",
  "read:image",
  "nav:tab"
]);

/** Capabilities that always require explicit human approval (dangerous). */
export const DANGEROUS_CAPABILITIES = new Set<Capability>([
  "read:storage",
  "submit:form",
  "upload:file",
  "httpRequest:cookied",
  "runJS:unsafe"
]);

export function isCapability(s: string): s is Capability {
  return (CAPABILITIES as readonly string[]).includes(s);
}

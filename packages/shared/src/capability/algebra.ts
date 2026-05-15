import type { Capability } from "./catalog";
import { IMPLICIT_CAPABILITIES } from "./catalog";

/** Pure-set operations over Capability sets. ReadonlySet for input safety. */

export function subset(a: ReadonlySet<Capability>, b: ReadonlySet<Capability>): boolean {
  for (const c of a) if (!b.has(c)) return false;
  return true;
}

export function union(
  a: ReadonlySet<Capability>,
  b: ReadonlySet<Capability>
): Set<Capability> {
  const out = new Set<Capability>(a);
  for (const c of b) out.add(c);
  return out;
}

export function intersection(
  a: ReadonlySet<Capability>,
  b: ReadonlySet<Capability>
): Set<Capability> {
  const out = new Set<Capability>();
  for (const c of a) if (b.has(c)) out.add(c);
  return out;
}

/**
 * Effective scope = requested scope ∪ implicit capabilities. Use this when
 * checking whether a tool call is allowed: the auto-granted (read:dom etc.)
 * capabilities don't need to be explicitly requested.
 */
export function effectiveScope(requested: ReadonlySet<Capability>): Set<Capability> {
  return union(requested, IMPLICIT_CAPABILITIES);
}

/** Does the effective scope cover the single required capability? */
export function scopeCovers(
  requested: ReadonlySet<Capability>,
  required: Capability
): boolean {
  return effectiveScope(requested).has(required);
}

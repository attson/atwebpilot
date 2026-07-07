// packages/shared/src/match-presets.ts
import { compilePattern } from "./url-pattern";
import { PRESETS } from "./presets";
import type { Preset } from "./preset";

export function matchPresetsByUrl(
  url: string,
  registry: readonly Preset[] = PRESETS
): Preset[] {
  return registry.filter((p) =>
    p.urlPatterns.some((pat) => compilePattern(pat).test(url))
  );
}

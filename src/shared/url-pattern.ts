const SPECIAL = /[.+?^${}()|[\]\\]/g;
const PLACEHOLDER_DOUBLE = "\x01";
const PLACEHOLDER_SINGLE = "\x02";

export function compilePattern(pattern: string): RegExp {
  const replaced = pattern
    .replace(/\*\*/g, PLACEHOLDER_DOUBLE)
    .replace(/\*/g, PLACEHOLDER_SINGLE);
  const escaped = replaced.replace(SPECIAL, "\\$&");
  const expanded = escaped
    .replace(new RegExp(PLACEHOLDER_DOUBLE, "g"), ".*")
    .replace(new RegExp(PLACEHOLDER_SINGLE, "g"), "[^/]*");
  return new RegExp(`^${expanded}$`);
}

export function matchesAny(url: string, patterns: string[]): boolean {
  return patterns.some((p) => compilePattern(p).test(url));
}

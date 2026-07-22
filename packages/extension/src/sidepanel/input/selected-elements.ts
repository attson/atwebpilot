export function buildPromptWithSelectedElements(prompt: string, selectors: string[]): string {
  const selected = selectors.map((s) => s.trim()).filter(Boolean);
  if (selected.length === 0) return prompt;
  return [
    "=== Selected page elements ===",
    "The user selected these CSS selectors on the current page:",
    ...selected.map((selector, i) => `${i + 1}. \`${selector}\``),
    "",
    "=== User request ===",
    prompt
  ].join("\n");
}

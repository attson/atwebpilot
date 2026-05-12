const MAX_ERROR_BODY_CHARS = 500;

export function formatLlmHttpError(provider: string, status: number, body: string): string {
  const compact = (body.trim() || "<empty body>").replace(/\s+/g, " ");
  if (compact.length <= MAX_ERROR_BODY_CHARS) return `${provider} ${status}: ${compact}`;

  const omitted = compact.length - MAX_ERROR_BODY_CHARS;
  return `${provider} ${status}: ${compact.slice(0, MAX_ERROR_BODY_CHARS)}... (truncated ${omitted} chars)`;
}

import type { JsonSchema } from "../types";

/**
 * Each low-level explore_<tool> MCP tool wraps one extension built-in tool.
 * It accepts the same args as the underlying tool plus a session_id.
 *
 * inputSchema parameter is the tool's native args schema (likely from the
 * extension's tool definition). This helper just composes it with the
 * session_id wrapper.
 */
export function buildExploreInputSchema(toolArgsSchema: JsonSchema): JsonSchema {
  return {
    type: "object",
    required: ["session_id"],
    properties: {
      session_id: { type: "string" },
      args: toolArgsSchema
    },
    additionalProperties: false
  };
}

export function exploreToolName(builtinTool: string): string {
  return `explore_${builtinTool}`;
}

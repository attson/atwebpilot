import type { ChatMessage, Json, JsonSchema } from "@/shared/types";

export type LlmTool = {
  name: string;
  description: string;
  input_schema: JsonSchema;
};

export type LlmStreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_use_start"; id: string; name: string }
  | { type: "tool_use_input_delta"; id: string; partial_json: string }
  | { type: "tool_use_end"; id: string; input: Json }
  | { type: "message_end"; usage?: { input_tokens: number; output_tokens: number } }
  | { type: "error"; error: string };

export interface LlmClient {
  stream(input: {
    apiKey: string;
    model: string;
    system: string;
    messages: ChatMessage[];
    tools: LlmTool[];
    maxTokens?: number;
    abortSignal?: AbortSignal;
  }): AsyncIterable<LlmStreamEvent>;
}

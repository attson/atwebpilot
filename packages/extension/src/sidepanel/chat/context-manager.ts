import type {
  ChatMessage,
  ImagePart,
  Json,
  TextPart,
  ToolResultPart,
  ToolUsePart,
} from "@atwebpilot/shared/types";
import { truncateContent } from "@/sidepanel/llm/truncate";

export type UserMessageContent = Extract<ChatMessage, { role: "user" }>["content"];

export type ContextBuildOptions = {
  recentMessageLimit?: number;
  softCharBudget?: number;
  memoryCharLimit?: number;
};

export type ContextBuildResult = {
  initialMessages: ChatMessage[];
  compressed: boolean;
  compressedMessageCount: number;
  estimatedChars: number;
};

const DEFAULT_RECENT_MESSAGE_LIMIT = 8;
const DEFAULT_SOFT_CHAR_BUDGET = 24_000;
const DEFAULT_MEMORY_CHAR_LIMIT = 4_000;
const PART_TEXT_CAP = 700;
const TOOL_RESULT_TEXT_CAP = 900;
const ASSISTANT_TOOL_INPUT_CAP = 500;

export function buildCurrentUserContent(
  text: string,
  images: ImagePart[]
): UserMessageContent {
  if (images.length === 0) return text;
  const content: Array<TextPart | ImagePart> = [...images];
  if (text) content.push({ type: "text", text });
  return content;
}

export function buildInitialMessagesForNextTurn(
  history: ChatMessage[],
  options: ContextBuildOptions = {}
): ContextBuildResult {
  const recentMessageLimit = options.recentMessageLimit ?? DEFAULT_RECENT_MESSAGE_LIMIT;
  const softCharBudget = options.softCharBudget ?? DEFAULT_SOFT_CHAR_BUDGET;
  const memoryCharLimit = options.memoryCharLimit ?? DEFAULT_MEMORY_CHAR_LIMIT;

  if (history.length === 0) {
    return { initialMessages: [], compressed: false, compressedMessageCount: 0, estimatedChars: 0 };
  }

  const sanitized = history.map(sanitizeMessageForHistory);
  const estimatedChars = JSON.stringify(sanitized).length;
  if (estimatedChars <= softCharBudget) {
    return {
      initialMessages: sanitized,
      compressed: false,
      compressedMessageCount: 0,
      estimatedChars,
    };
  }

  const recentCount = Math.max(1, Math.min(recentMessageLimit, sanitized.length));
  const old = sanitized.slice(0, -recentCount);
  const recent = sanitized.slice(-recentCount);
  const memory = buildMemoryMessage(old, memoryCharLimit);
  const initialMessages = memory ? [memory, ...recent] : recent;

  return {
    initialMessages,
    compressed: old.length > 0,
    compressedMessageCount: old.length,
    estimatedChars: JSON.stringify(initialMessages).length,
  };
}

function sanitizeMessageForHistory(message: ChatMessage): ChatMessage {
  if (message.role === "assistant") {
    return {
      role: "assistant",
      content: message.content.map(sanitizeAssistantPart),
    };
  }

  if (typeof message.content === "string") {
    return { role: "user", content: truncateContent(message.content, PART_TEXT_CAP) };
  }

  return {
    role: "user",
    content: message.content.map((part): TextPart | ToolResultPart => {
      if (part.type === "text") return { ...part, text: truncateContent(part.text, PART_TEXT_CAP) };
      if (part.type === "image") {
        return {
          type: "text",
          text: `[image omitted from prior context: ${part.media_type}, ${part.data.length} base64 chars]`,
        };
      }
      return sanitizeToolResultPart(part, TOOL_RESULT_TEXT_CAP);
    }),
  };
}

function sanitizeAssistantPart(part: TextPart | ToolUsePart): TextPart | ToolUsePart {
  if (part.type === "text") return { ...part, text: truncateContent(part.text, PART_TEXT_CAP) };
  return {
    ...part,
    input: compactJsonValue(part.input, ASSISTANT_TOOL_INPUT_CAP),
  };
}

function sanitizeToolResultPart(part: ToolResultPart, cap: number): ToolResultPart {
  if (typeof part.content === "string") {
    return { ...part, content: truncateContent(part.content, cap) };
  }

  let remaining = cap;
  return {
    ...part,
    content: part.content.map((inner): TextPart => {
      if (inner.type === "image") {
        return {
          type: "text",
          text: `[tool_result image omitted from prior context: ${inner.media_type}, ${inner.data.length} base64 chars]`,
        };
      }
      const text = truncateContent(inner.text, Math.max(0, remaining));
      remaining = Math.max(0, remaining - text.length);
      return { ...inner, text };
    }),
  };
}

function buildMemoryMessage(messages: ChatMessage[], memoryCharLimit: number): ChatMessage | null {
  if (messages.length === 0) return null;
  const lines = messages.map((message, index) => summarizeMessage(message, index + 1));
  const body = truncateContent(lines.join("\n"), memoryCharLimit);
  return {
    role: "user",
    content: [
      "[上下文记忆]",
      "以下是较早对话的压缩摘要。它用于保持同一会话的长期连续性；大段网页内容、历史图片和截图已用引用/占位符替代。",
      body,
    ].join("\n"),
  };
}

function summarizeMessage(message: ChatMessage, index: number): string {
  const prefix = message.role === "assistant" ? `A${index}` : `U${index}`;
  if (typeof message.content === "string") {
    return `${prefix}: ${message.content}`;
  }
  if (message.role === "assistant") {
    return `${prefix}: ${message.content.map(summarizeAssistantPart).filter(Boolean).join(" | ")}`;
  }
  return `${prefix}: ${message.content.map(summarizeUserPart).filter(Boolean).join(" | ")}`;
}

function summarizeAssistantPart(part: TextPart | ToolUsePart): string {
  if (part.type === "text") return part.text;
  return `tool_use ${part.name} input=${truncateJson(part.input, ASSISTANT_TOOL_INPUT_CAP)}`;
}

function summarizeUserPart(part: TextPart | ImagePart | ToolResultPart): string {
  if (part.type === "text") return part.text;
  if (part.type === "image") {
    return `[image omitted from prior context: ${part.media_type}, ${part.data.length} base64 chars]`;
  }
  const content = typeof part.content === "string"
    ? part.content
    : part.content.map((inner) =>
        inner.type === "image"
          ? `[tool_result image omitted from prior context: ${inner.media_type}, ${inner.data.length} base64 chars]`
          : inner.text
      ).join("\n");
  return `tool_result ${part.tool_use_id}: ${content}`;
}

function truncateJson(value: unknown, cap: number): string {
  return truncateContent(JSON.stringify(value), cap);
}

function compactJsonValue(value: Json, cap: number): Json {
  const encoded = JSON.stringify(value);
  if (encoded.length <= cap) return value;
  return { _omitted: truncateContent(encoded, cap) };
}

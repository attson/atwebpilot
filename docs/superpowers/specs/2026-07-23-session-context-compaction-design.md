# Session Context Compaction Design

## Problem

AtWebPilot persisted chat messages in the UI/IDB, but a new user send did not
pass prior user/assistant turns back into `runChatSession`. From the model's
perspective, multiple sends in the same visible conversation were independent
tasks. This broke follow-up prompts such as “继续刚才的” and made the page-index
workflow less effective across turns.

The previous within-run compaction only handled large `tool_result` payloads
inside one `runChatSession` call. It did not solve cross-send memory.

## Goals

- Preserve useful prior conversation context across user sends.
- Compress early history before the model call when context grows too large.
- Keep recent turns raw for short-term continuity.
- Never replay old image/base64 payloads or old screenshot blocks into long-term
  context; keep text placeholders and IDs instead.
- Preserve page context references such as `indexId` and `blockId` so the model
  can use `searchPageIndex` / `readPageBlock` / targeted `screenshot` on demand.
- Fix the current-send image path by sending staged images as `ChatMessage`
  image parts instead of only rendering them in the UI.

## Non-Goals

- No new dependency.
- No background-side API key path.
- No LLM-powered durable memory summary in this pass. The first version uses a
  deterministic structured compactor. A later version can swap the same
  `context-manager` boundary to an extra one-shot LLM summary if needed.
- No user-visible settings for thresholds yet. Defaults should be conservative.

## Design

Add `packages/extension/src/sidepanel/chat/context-manager.ts` as the single
boundary for cross-send model context.

The builder produces:

- `initialMessages`: sanitized prior history for `runChatSession`.
- `compressed`: whether old turns were replaced by a `[上下文记忆]` message.
- `compressedMessageCount`: number of old messages covered by the memory.
- `estimatedChars`: char proxy for logging/debugging.

Behavior:

- If sanitized history is within `softCharBudget`, pass it through as prior
  messages.
- If over budget, keep the last N messages raw and replace older messages with a
  user-role `[上下文记忆]` message.
- Old user images become text placeholders containing media type and omitted
  base64 length.
- Old screenshot/tool-result images become text placeholders.
- Tool-result text is truncated but important IDs survive because head/tail
  truncation is used.
- Current-turn staged images are sent through `RunSessionInput.userContent`.

## Integration

Sidepanel:

- Build context from `session0.messages` before appending the current UI message.
- Build current model content from selected-element-expanded text plus staged
  images.
- Pass `initialMessages` and `input.userContent` to `runChatSession`.
- Log `[上下文] 已压缩早期对话` when compression happens.

Widget:

- Capture `session.messages` before appending the current UI message.
- Pass that history snapshot and staged images to `runFromInput`.
- `runFromInput` builds the same `initialMessages` and `userContent`.

`runChatSession`:

- Keep existing `userPrompt` for logs/system prompt compatibility.
- Add optional `userContent` and append it as the current user message when
  present.

## Test Coverage

- `context-manager.test.ts`
  - Keeps recent prior turns.
  - Compresses older history when over budget.
  - Preserves `indexId` / `blockId`.
  - Omits old image base64.
  - Builds current user content with images.
- `run-session.test.ts`
  - Sends `initialMessages` plus current multimodal user content to the LLM.
- `input-box.test.tsx` / `input-toolbar.test.tsx`
  - Allows image-only sends while keeping empty text-only sends disabled.

## Follow-Up

The deterministic `[上下文记忆]` message is intentionally replaceable.
If later quality requires Codex/Claude-style LLM memory, add an async summarizer
that updates a persisted `contextSummary` through the same call sites. Keep the
current no-BG-key rule: summarization runs in sidepanel/widget with the user's
configured client.

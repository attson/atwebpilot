# 原始 LLM 交互日志（Raw LLM Exchange Log）— 设计

> 日期：2026-05-23
> 状态：已与用户确认设计，待写实现计划

## 背景与动机

排查"AI 提前收尾 / 上下文膨胀 / 返回内容不对"这类问题时，目前没有任何地方能看到**与模型交互的完整原始内容**。

现状：
- 唯一的模型交互咽喉点是 `LlmClient.stream(input)`（`packages/extension/src/sidepanel/llm/types.ts`）。`input` 携带完整请求（`model` / `system` / 全部 `messages` / `tools` / `maxTokens` / `endpoint` / `apiKey`），返回 `LlmStreamEvent` 流。
- 现有「日志」抽屉（`logs-drawer.tsx` + `chat-page.tsx` 的 `log()` → `session.logs`）只记录**派生的高层事件**（round 开始、tool 调用、usage、session_end 等），**不含**发出去的完整 `messages`、system prompt，也不含原始响应。
- `session.logs` 仅内存、**不随会话持久化**（`rehydrateFromPersisted` 不含 `logs`），刷新即丢。

因此需要一个新机制：在 `stream()` 边界录制每一次模型交互的结构化完整内容，持久化、可在专用面板查看与导出。

## 已确认的关键决策

1. **捕获粒度 = 结构化完整**：每轮请求（model / system / 全部 messages / tools / max_tokens / endpoint，**去掉 apiKey**）+ 每轮响应（完整文本、所有 tool_use 及入参、stop_reason、usage、错误）。不存逐字节原始 SSE。
2. **持久化 + 体积上限**：随会话存进 IndexedDB，刷新/重开可查、可导出；对超大字段截断、对条数设上限，防止存储膨胀。
3. **查看入口 = 专用面板**：从对话页打开的全高 overlay，按轮列出可折叠 request/response 卡片，能复制/导出；当前会话与历史会话都能看。
4. **捕获点 = `LlmClient` 边界包一层录制器**（方案 1）：单咽喉点、provider 无关、核心编排代码零侵入。
5. **v1 范围**：只录主对话循环（run-session 用的那个 client）。`kind` 字段预留 `"summary"`/`"draft"`，但汇总 step、草稿生成的录制不在本期。

## 架构总览

```
chat-page.tsx
  ├─ pickClient(provider)                         ← 真实 provider client（不变）
  ├─ createRecordingClient(inner, onExchange)     ← 新：录制 wrapper
  │     └─ stream(input):
  │           snapshot request (去 apiKey)
  │           for await ev of inner.stream(input):
  │               accumulate (text / toolUses / usage / stopReason / error)
  │               yield ev                         ← 原样透传，run-session 无感
  │           finally: onExchange(组装好的 LlmExchange)   ← abort/报错也记录
  └─ runChatSession({ client: recordingClient, ... })   ← run-session 零改动

onExchange = (ex) => session.addLlmExchange(ex)
  → SessionData.llmExchanges[]（FIFO 上限）
  → 经 auto-persist 落 IndexedDB（PersistedSessionData.llmExchanges）

LlmExchangePanel（全高 overlay）
  ← 读 session.llmExchanges，按轮渲染可折叠卡片 + 复制/导出
```

**设计要点**：录制完全发生在 chat-page 包装 client 这一层，`runChatSession` 与 provider client 的编排逻辑都不改（除下面 stop_reason 的纯增量扩展）。

## 数据模型

新增到 `packages/shared/src/types.ts`：

```ts
export type LlmExchangeRequest = {
  provider: LlmProvider;
  model: string;
  endpoint?: string;
  maxTokens?: number;
  system: string;
  messages: ChatMessage[];   // 完整上下文，单块内容按上限截断
  toolNames: string[];       // 只存工具名（schema 每轮相同、冗余，省体积）
};

export type LlmExchangeResponse = {
  text: string;
  toolUses: { id: string; name: string; input: Json }[];
  usage?: { input_tokens: number; output_tokens: number };
  stopReason?: string;       // end_turn / max_tokens / tool_use / …
  error?: string;
  aborted?: boolean;
};

export type LlmExchange = {
  id: string;
  round: number;             // wrapper 内自增计数（从 0 起）
  kind: "main";              // 预留 "summary" | "draft"
  startedAt: number;
  durationMs: number;
  request: LlmExchangeRequest;
  response: LlmExchangeResponse;
};
```

### stop_reason 的获取（纯增量扩展）

当前 `LlmStreamEvent` 不含 stop_reason。给 `message_end` 事件加可选字段：

```ts
// types.ts (sidepanel/llm/types.ts)
| { type: "message_end"; usage?: {...}; stop_reason?: string }
```

- `anthropic.ts`：`message_delta` 的 `payload.delta.stop_reason` 暂存，`message_stop` 时随 `message_end` 带出。
- `openai.ts`：取 `choices[].finish_reason`。
- `run-session.ts` 只读 `ev.usage`，对新增的 `stop_reason` 无感 —— **行为不变**。

## 捕获：录制 wrapper

新文件 `packages/extension/src/sidepanel/llm/recording-client.ts`：

```ts
export type RecordingOptions = {
  provider: LlmProvider;             // chat-page 已知，经此传入（不污染 LlmClient 接口）
  kind?: LlmExchange["kind"];        // 默认 "main"
  maxContentChars?: number;          // 默认 8000
};

export function createRecordingClient(
  inner: LlmClient,
  onExchange: (ex: LlmExchange) => void,
  opts: RecordingOptions
): LlmClient;
```

行为：
- `stream(input)` 是一个 async generator：
  1. 记录 `startedAt`、快照 request：`{ provider: opts.provider, model: input.model, endpoint: input.endpoint, maxTokens: input.maxTokens, system: input.system, messages: truncateMessages(input.messages, cap), toolNames: input.tools.map(t => t.name) }`。`provider` 来自 `opts`（`LlmClient.stream` 的 input 本就不带 provider，保持接口不变）。**绝不读取 `input.apiKey`。**
  2. `for await (const ev of inner.stream(input))`：累积 `text`（text_delta）、`toolUses`（tool_use_end）、`usage` / `stop_reason`（message_end）、`error`（error 事件）；**每个 ev 原样 `yield`**。
  3. `finally`：组装 `LlmExchange`（`durationMs = now - startedAt`，`round` 用实例自增计数），调 `onExchange`。abort（消费方提前 break / abortSignal）或抛错时，`finally` 仍执行 → 记录 partial，`response.aborted = true` 或带 `error`。

截断 helper（同文件或 `truncate.ts`）：
- `truncateContent(s, cap)`：`s.length <= cap` 原样返回；否则 `head(cap/2) + "\n…[截断 " + (s.length-cap) + " 字]…\n" + tail(cap/2)`。
- `truncateMessages(messages, cap)`：对每条消息的文本/字符串型 content 与 `tool_result.content`、`text` part 应用 `truncateContent`。结构（消息条数、role、tool_use_id）保留不变。

## 存储与持久化

`session-store.ts`：
- `SessionData` 加 `llmExchanges: LlmExchange[]`；`makeEmptySession` 初始化 `[]`。
- 新 action `addLlmExchange(tabId, ex)`：追加并保留最近 `MAX_EXCHANGES`（默认 60）条（FIFO）。
- `rehydrateFromPersisted`：读 `data.llmExchanges ?? []`。
- `LegacySession` 暴露 `addLlmExchange(ex)`。

持久化（`PersistedSessionData` in `shared/types.ts` + `auto-persist.ts` / `sessions-storage.ts`）：
- `PersistedSessionData` 加 `llmExchanges: LlmExchange[]`。
- 写入：auto-persist 序列化时带上 `llmExchanges`。
- 读取：旧记录无该字段 → 默认 `[]`，**向后兼容，无需 DB 版本迁移**（持久化为 blob，读时给默认值）。

## 查看面板

新组件 `packages/extension/src/sidepanel/components/llm-exchange-panel.tsx`（全高 overlay）。

入口：对话页头部加「原始日志」按钮（挨着现有 日志 / 历史 按钮），打开/关闭由本地 state 控制。

渲染：
- 读 `session.llmExchanges`，按 `round` 列出可折叠卡片。
- 卡片标题行：`#{round} · {model} · {durationMs}ms · in {usage.input}/out {usage.output} · {stopReason}`；`error`/`aborted` 用红/琥珀色高亮。
- 展开显示两块：
  - **Request**：`system`（折叠）、`messages` 列表（每条显示 role + 截断后 content / tool_use / tool_result）、`toolNames`、`maxTokens`、`endpoint`。
  - **Response**：完整 `text`、每个 `toolUse`（name + input JSON）、`error`（若有）。
- 操作：`复制本条`（该 exchange 的 JSON 写剪贴板，复用 logs-drawer 的 clipboard 写法）/ `导出全部`（`Blob` 下载 JSON，复用 result-view 的导出写法）。

当前会话实时刷新（zustand 订阅）。历史会话：经现有「历史」抽屉 rehydrate 成当前会话后，面板自然显示其持久化的 exchanges —— **无需额外改动**。

## 错误处理

- abort / stream 抛错：`finally` 仍记录 partial exchange（带 `aborted`/`error`），保证“出问题的那一轮”一定有记录可查。
- `onExchange` 抛错不得影响主流程：wrapper 内 `try { onExchange(ex) } catch { /* 吞掉并 console.warn */ }`。
- apiKey 绝不进入任何记录字段（不读取 `input.apiKey`）。

## 测试（TDD）

`recording-client.test.ts`（用 fake inner client 喂事件）：
- 事件**原样透传**（消费方拿到的序列与 inner 一致）。
- `onExchange` 恰好被调用一次；记录里 **apiKey 不存在**。
- `text` / `toolUses` / `usage` / `stop_reason` 正确组装。
- 单块超长 content 被 `truncateContent` 截断（含标记），结构不变。
- 消费方提前 break / abortSignal 触发时仍记录 partial，`response.aborted === true`。
- inner 发 `error` 事件时记录进 `response.error`。

`truncate` helper 单测：边界（恰好等于 cap、超出、空串）。

`session-store` 单测：`addLlmExchange` 追加 + 超过 `MAX_EXCHANGES` 时 FIFO；`rehydrateFromPersisted` 往返含 `llmExchanges`（旧记录缺字段 → `[]`）。

`anthropic.ts` 单测：`message_end` 带出 `stop_reason`（喂含 `message_delta.stop_reason` 的 SSE）。

`llm-exchange-panel.test.tsx`：渲染若干 exchange、展开/折叠、复制（mock clipboard）、导出（mock Blob/URL）。

## 文件改动清单

新增：
- `packages/extension/src/sidepanel/llm/recording-client.ts`（+ 截断 helper）
- `packages/extension/src/sidepanel/components/llm-exchange-panel.tsx`
- 对应测试文件

修改：
- `packages/shared/src/types.ts`：新增 `LlmExchange*` 类型；`PersistedSessionData` 加 `llmExchanges`
- `packages/extension/src/sidepanel/llm/types.ts`：`message_end` 加 `stop_reason?`
- `packages/extension/src/sidepanel/llm/anthropic.ts` / `openai.ts`：填 `stop_reason`
- `packages/extension/src/sidepanel/chat/session-store.ts`：`llmExchanges` 字段 + `addLlmExchange` + rehydrate + Legacy 暴露
- `packages/extension/src/sidepanel/chat/persistence/auto-persist.ts`（及相关 sessions-storage）：序列化带 `llmExchanges`
- `packages/extension/src/sidepanel/pages/chat-page.tsx`：用 `createRecordingClient` 包 client；头部加「原始日志」按钮 + 面板开关

不改：`run-session.ts`（仅经由它使用被包装后的 client，逻辑不动）。

## 常量默认值

- `MAX_CONTENT_CHARS = 8000`（单块 content 截断阈值）
- `MAX_EXCHANGES = 60`（每会话保留条数上限）

## 非目标（YAGNI）

- 不录汇总 step（`generateSummaryStep`）、工具草稿生成（`tool-draft-generator`）—— `kind` 预留但本期不接。
- 不存逐字节原始 SSE / 原始 HTTP 请求体。
- 不做跨会话的全局日志检索 / 过滤 UI。
- 不加录制开关（默认常开；体积由截断 + 条数上限控制）。

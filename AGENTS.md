# Agent Guide — AtWebPilot

This file orients AI agents (Claude Code / Codex / Cursor) working in this
repo. Read it before making non-trivial changes.

## What this is

AtWebPilot is a Chromium MV3 side-panel extension that lets a user converse
with an LLM and have it read / write / collect on the currently-open web
page. Successful conversations can be **固化 (solidified)** into reusable
URL-pattern-matched tools that replay the same step sequence on similar
pages without an LLM round-trip.

Three personas of work the user expects help with:

- **read**: summarize / translate / extract / answer about the page
- **write**: fill forms, click, select, submit, upload
- **collect**: gather images, lists, reviews into structured data

## Tech stack

- Vite 5 + `@crxjs/vite-plugin` (MV3 build), React 18, TypeScript 5 (strict)
- Tailwind 3, zustand 4, zod 3, idb 8
- vitest + happy-dom + fake-indexeddb (no Playwright; UI smoke is manual,
  but coordinator-driven E2E covers the chat loop via a real `ws` server)
- pnpm 9 workspaces (4 packages: `shared` / `coordinator` / `extension` / `mcp-server`)
- LLM: Anthropic Messages API + OpenAI Chat API; both stream via fetch
  directly from the side panel (no proxy, no key on disk except
  `chrome.storage.local | session`)
- Remote control: optional WebSocket coordinator client (`packages/coordinator`
  is the reference server) — exposes EXEC for individual tools and a
  separate opt-in surface for full chat sessions; off by default

## Repo layout

```
caiji2/                              # pnpm workspaces monorepo（Phase 0 起）
├─ packages/
│  ├─ shared/                         纯函数 + 类型 + zod wire schemas（无 chrome / 无 DOM 依赖）
│  │  └─ src/
│  │     ├─ types.ts                  Tool / Step / RunRecord(+source) / ChatMessage / Severity / ToolUsePart / JsonSchema
│  │     ├─ messages.ts               zod RPC schemas (sidepanel <-> bg <-> content)
│  │     ├─ url-pattern.ts            glob → RegExp
│  │     ├─ static-scan.ts            runJS source → severity findings (regex rules)
│  │     ├─ infer-json-schema.ts      Minimal JSON Schema inference for save dialog
│  │     ├─ llm/                      LlmClient interface + LlmStreamEvent union（Phase 2 起被 background 共用）
│  │     └─ protocol/                 WS protocol：envelope / errors / messages / chat-event；ClientToServerSchema、ServerToClientSchema discriminated unions
│  ├─ coordinator/                    参考 WS 服务器（worker registry / session manager / dispatcher / catalog / clock）
│  │  └─ src/                         （仅供测试与本地 smoke；生产部署不在这里）
│  ├─ mcp-server/                     stdio MCP server + LoopbackWSHub（Plan 13；Claude 经 coordinator 驱动浏览器）
│  └─ extension/                      AtWebPilot 浏览器扩展（19 工具 + sidepanel + LLM agent loop + WS worker）
│     ├─ src/
│     │  ├─ manifest.ts               MV3 manifest (defineManifest)
│     │  ├─ background/               Service worker
│     │  │  ├─ index.ts               Wakeup + RPC listener + tab-watcher + coordinator client lifecycle
│     │  │  ├─ rpc-handlers.ts        Dispatch RpcRequest; runOneStep + injectMainWorld（被 coordinator-exec / bg-tool-runner 复用）
│     │  │  ├─ http-proxy.ts          Cross-origin fetch (omit/include cookie); fetchAsBase64 for uploadFile
│     │  │  ├─ tab-watcher.ts         chrome.tabs / webNavigation → set badge + 推 tabs.recommendations / tabs.spawned / tabs.urlChanged / tabs.removed
│     │  │  ├─ tab-close-archiver.ts  关 tab 时 archive 会话到 IDB（Plan 8）
│     │  │  ├─ coordinator-client.ts  单 WS 实例：HELLO / EXEC / START_CHAT_SESSION 等路由 + chrome.alarms 心跳 + 重连
│     │  │  ├─ coordinator-state.ts   worker_id / token / config / allow_remote_chat 存 chrome.storage.local
│     │  │  ├─ coordinator-hello.ts   HELLO payload 构造（fingerprint / saved_tools / available_tabs）
│     │  │  ├─ coordinator-exec.ts    EXEC → runOneStep 适配 + Result 包装
│     │  │  ├─ coordinator-chat.ts    Plan 12 新增：START_CHAT_SESSION / ABORT_SESSION 入口；BG 端跑 runChatSession（一次一个 session，受 allow_remote_chat gate）
│     │  │  ├─ coordinator-state-bridge.ts   READ_SIDEPANEL_STATE → chrome.runtime ping/pong（500ms 超时）→ SIDEPANEL_STATE_REPLY
│     │  │  ├─ mock-llm-client.ts     Plan 12：脚本化 LlmStreamEvent[][]，每 stream() 取下一轮
│     │  │  ├─ bg-tool-runner.ts      ToolRunner 接口的 background 实现（直接调 runOneStep）
│     │  │  └─ storage/{db,tools,runs,export-import,sessions}.ts   IndexedDB (DB_NAME = "caiji" — do NOT rename)；`runs` 表 record 有 `source: "user" | "coordinator"`（后向兼容：读时缺字段补 "user"）
│     │  ├─ content/                  Content script (isolated world)
│     │  │  ├─ index.ts               chrome.runtime.onMessage → callTool / injectMain
│     │  │  ├─ runner.ts + ctx.ts     Step Runner with ${var} bindings + timeout
│     │  │  ├─ inject-main.ts         Bridge to BG.scripting.injectMain
│     │  │  └─ tools/*.ts             One file per BuiltinTool
│     │  └─ sidepanel/                React UI (the only user surface)
│     │     ├─ rpc.ts                 typed wrappers + onTabRecommendations + onTabEvents + retry on SW wake
│     │     ├─ chat/
│     │     │  ├─ session-store.ts    zustand: sessionsByTab + currentTabId + per-tab attachedTabs + llmExchanges
│     │     │  ├─ persistence/        Plan 8：sessions IDB store；每 URL ≤20 archived sessions + cascade 删 runs
│     │     │  ├─ approval.ts         Per-tab Approver factory
│     │     │  ├─ severity.ts         classifyTool / autoApproves(sev,name,toggle,allowlist)
│     │     │  ├─ tool-runner.ts      ToolRunner 接口；sidepanel 实现 wraps rpc.runOneStep
│     │     │  ├─ run-session.ts      LLM tool-use loop (DI: client/runner/approver/rpc/tabsRpc); emits SessionEvent；continuation guard 总额上限（v0.0.15）
│     │     │  ├─ cross-tab-events.ts Plan 7：tabs.spawned / urlChanged / removed → store mutation + system note（仅当 session 处于 running/streaming 时把 opener-match 算 AI 开 — v0.0.14 修）
│     │     │  ├─ tab-tracker.ts      chrome.tabs events → store actions
│     │     │  └─ settings-store.ts   LlmSettings (provider/model/apiKey/endpoint/maxRounds/maxTokens/autoApproveDangerous/maxContinuationNudges)
│     │     ├─ llm/
│     │     │  ├─ types.ts            re-export from @atwebpilot/shared/llm（兼容存量 import）
│     │     │  ├─ anthropic.ts / openai.ts    SSE parsers（surface stop_reason on message_end）
│     │     │  ├─ recording-client.ts Plan 11：包 LlmClient 捕获 request/response 到 llmExchanges（apiKey 屏蔽）
│     │     │  ├─ http-error.ts       HTTP 错误规范化（含 retry-after 解析）
│     │     │  ├─ truncate.ts         exchange log payload 截断
│     │     │  ├─ client.ts           pickClient(provider)
│     │     │  ├─ tool-schema.ts      19 BuiltinTool LlmTool defs + runJS + listTabs/openTab/attachTab/detachTab
│     │     │  ├─ system-prompt.ts    buildSystemPrompt({url,title,savedTools,attachedTabs})
│     │     │  ├─ summary-step.ts     One-shot 非流式生成 "summary runJS step"（Plan 5）
│     │     │  └─ tool-draft-generator.ts   Plan 6：AI 总结对话生成工具草案（提示词或 steps）
│     │     ├─ pages/
│     │     │  ├─ chat-page.tsx       Default route；full session loop（tabId 在 send() 闭包里）
│     │     │  ├─ tools-page.tsx      List + per-row export + page import
│     │     │  ├─ tool-detail-page.tsx Replay tool；ResultView hoisted；autoRun supported
│     │     │  ├─ run-page.tsx        DEV：paste Tool JSON
│     │     │  ├─ settings-page.tsx   LLM + 自动通过策略 + 备份 + maxContinuationNudges
│     │     │  └─ coordinator-settings-page.tsx   WS URL/token 配置 + 状态展示 + allow_remote_chat checkbox
│     │     ├─ coordinator-state-bridge.ts   Plan 12 sidepanel 端：响应 ping.sidepanelState → 读 zustand 拼快照 → pong
│     │     ├─ components/            Stateless except where needed (chat-view, step-card, exchange-log, etc.)
│     │     └─ app.tsx                Routing + tab-tracker mount + coordinator-state-bridge mount
│     ├─ tests/                       Unit + integration（含 background/coordinator-e2e.test.ts：起真 `ws` server 跑 HELLO/EXEC/START_CHAT_SESSION 端到端）
│     ├─ vite.config.ts               Vite 配置含 @crxjs；build 产物在 packages/extension/dist/
│     ├─ tsconfig.json
│     └─ package.json
└─ docs/superpowers/
   ├─ specs/                          Design docs；见 specs/README.md（已涵盖 Plan 1-12）
   ├─ plans/                          Implementation plans（每份对应一份 spec）
   └─ scripts/                        辅助脚本（如 mini-coordinator.mjs：Layer-5 手动 smoke）
```

## monorepo 开发常用命令

| 命令 | 作用 |
|---|---|
| `pnpm dev` | 跑扩展开发模式（vite + HMR） |
| `pnpm build` | 产 `packages/extension/dist/` |
| `pnpm typecheck` | shared + extension 串跑 tsc --noEmit |
| `pnpm test` | shared + extension 串跑 vitest |
| `pnpm --filter @atwebpilot/shared test` | 只跑 shared 包测试 |
| `pnpm --filter @atwebpilot/extension test:watch` | 扩展测试 watch 模式 |

## Workflow conventions

This project follows the **superpowers** workflow. Every non-trivial change
goes through:

1. **brainstorming** — invoke `superpowers:brainstorming`; ask user
   clarifying questions one at a time; present design in sections; get
   approval; write spec to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`.
2. **writing-plans** — invoke `superpowers:writing-plans`; produce a task
   list with bite-sized steps + complete code in each step; save to
   `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`.
3. **executing-plans** (or `subagent-driven-development`) — execute tasks
   one by one with frequent commits.

Skip this only for: bug fixes, typo / doc edits, the user explicitly asks
"just do X". When unsure, propose a spec.

## Hard rules

- **IDB DB name is `caiji`** in `packages/extension/src/background/storage/db.ts`. Do not rename
  it (would orphan every existing user's saved tools). Internal name and
  product name (AtWebPilot) are intentionally decoupled.
- **No new dependencies without asking.** Existing stack covers everything
  we've needed; new deps cost build size and review burden.
- **API key never goes to IDB or to any export bundle.** It lives in
  `chrome.storage.local` (or `chrome.storage.session`).
- **Plan 4 per-tab invariant**: when run-session runs, capture `tabId`
  in the `send()` closure and pass it to every store action / approver
  lookup. Do NOT read `useStore.getState().currentTabId` inside async
  callbacks — the user may have switched tabs and you'll write to the
  wrong session. See `packages/extension/src/sidepanel/pages/chat-page.tsx`'s `stepFromCard` and the
  `tool_use_input_delta` case as the canonical pattern.
- **Severity gating signature is 4-arg**:
  `autoApproves(severity, toolName, approveAllSafe, dangerousAllowlist)`.
  Every callsite must pass all four — `tabId-aware` settings come from
  `useSettings().autoApproveDangerous`.
- **Static scan never blocks**. It only labels. Users can override and
  run dangerous code (Plan 5 summary step uses the same convention).
- **Content script may be missing**: BG `runOneStep` already retries
  with `chrome.scripting.executeScript` injection + `retryUntilReady`
  backoff. Don't bypass that.
- **`runChatSession` is a pure function (DI)**. The sidepanel and
  `CoordinatorChatHost` both call it with different `client` / `runner`
  / `approver` / `rpc`. Don't reach into `useStore` from inside it.
  Adding new state should go through the `onEvent` callback so both
  callers benefit.
- **Continuation guard is session-total, not since-progress** (v0.0.15
  fix). `nudgesSinceProgress` was renamed `totalNudges` and the reset
  on tool use was removed. Don't reintroduce per-progress reset — it
  causes "AI 确认完成" 死循环 when the model alternates text-only with
  one verification tool.
- **Cross-tab opener match needs session.status == running|streaming**
  (v0.0.14 fix). `tabs.spawned` with `openerTabId` covers BOTH user
  Ctrl+click AND AI's in-page click. The session-status gate is the
  only thing distinguishing them. Don't auto-attach on idle.
- **`allow_remote_chat=false` blocks ONLY `START_CHAT_SESSION`** (Plan
  12 spec). Existing EXEC behavior (incl. dangerous tools) is
  intentionally unchanged — that contract was set in Phase 2 and
  changing it on upgrade would break already-connected coordinators.
- **Coordinator chat sessions use `AutoApprover` (not `Approver`)**.
  Inside the BG-driven path the user has already opted in via the
  flag; plain `Approver.request()` would never resolve for dangerous
  tools and hang the session. See `coordinator-chat.ts`.
- **RunRecord.source is REQUIRED on new records, backfilled on read**
  for legacy. Don't make it optional in the type. Coordinator-driven
  sessions set `source: "coordinator"`; user sessions get `"user"` (or
  backfilled to `"user"` if a pre-v0.0.16 record is read back).
- **`LlmStreamEvent` / `LlmClient` live in `@atwebpilot/shared/llm`**
  (Plan 12). Extension still has a re-export shim at
  `sidepanel/llm/types.ts` for back-compat — keep it; new code should
  import from `@atwebpilot/shared/llm` directly.

## Common tasks

### Add a new BuiltinTool

1. `packages/shared/src/types.ts` — add to `BuiltinTool` union
2. `packages/shared/src/messages.ts` — add to `StepSchema` enum
3. `packages/extension/src/content/tools/<tool>.ts` — implement `(args: Json) => Promise<Json>`
4. `packages/extension/src/content/tools/index.ts` — register in `TOOLS`
5. `packages/extension/src/sidepanel/llm/tool-schema.ts` — add `LlmTool` def with JSON Schema
6. `packages/extension/src/sidepanel/chat/severity.ts` — classify in safe / caution / dangerous
7. `packages/extension/tests/content/tools/<tool>.test.ts` — happy-dom unit tests
8. `packages/extension/tests/sidepanel/chat/severity.test.ts` — add a classification case

### Add a new RPC

1. `packages/shared/src/messages.ts` — add to `RpcRequest` discriminatedUnion
2. `packages/extension/src/background/rpc-handlers.ts` — handle in `dispatch` switch
3. `packages/extension/src/sidepanel/rpc.ts` — add typed wrapper

### Add a new WS protocol message

1. `packages/shared/src/protocol/messages.ts` — define new zod schema + extend the right discriminated union (`ClientToServerSchema` / `ServerToClientSchema`); export the inferred TS type at the bottom
2. `packages/shared/tests/protocol/<msg>.test.ts` — round-trip + reject-malformed cases
3. If it carries `SessionEvent` or another extension-side runtime type, mirror as a zod schema in `packages/shared/src/protocol/chat-event.ts` (keep the `chat-event.test.ts` variant round-trip test green)
4. `packages/extension/src/background/coordinator-client.ts` — add a `case` in `handleMessage`'s switch; delegate to the right injected handler (`onChat` / `onReadState` / etc.)
5. `packages/extension/src/background/index.ts` — instantiate / wire any new handler in `startCoordinatorClient`; add disposal in `stopCoordinatorClient` if it owns a listener
6. End-to-end: extend `packages/extension/tests/background/coordinator-e2e.test.ts` with a real-`ws` test that drives the new path

### Add a new tool-use turn event (`SessionEvent`) variant

1. Add to the union in `packages/extension/src/sidepanel/chat/run-session.ts`
2. Mirror in `packages/shared/src/protocol/chat-event.ts` (`ChatSessionEventSchema`) and add a round-trip case to `chat-event.test.ts`
3. Sidepanel consumer (chat-page / step-card) handles it via `onEvent`
4. Don't break the existing 15 variants — extension and shared mirror must stay in sync (the round-trip test guards this)

### Working with sessions

- Read current session: `useSession()` returns the `SessionData` for
  `currentTabId` (or `EMPTY_SESSION` sentinel).
- Mutate a specific session: import `appendUserMessage(tabId, text)` /
  `setStatus(tabId, ...)` etc. and pass `tabId` explicitly.
- Background-running sessions: handled correctly by run-session's
  closure-captured `tabId`. Don't rely on `currentTabId` in callbacks.

## Build / test / dev

```bash
pnpm install
pnpm typecheck      # pnpm -r typecheck across shared / coordinator / extension; CI gate
pnpm test           # pnpm -r test; ~492 tests total (346 extension + 101 shared + 45 coordinator)
pnpm test:watch     # extension only (the largest, fastest-iterating slice)
pnpm build          # vite build → packages/extension/dist/
```

Load `packages/extension/dist/` via `chrome://extensions` (developer mode → load unpacked).
After code change: rebuild, then click the reload icon on the extension.
**Reload an open page if content script seems missing** (the BG-side
auto-injection retries up to 2s but a hard refresh is faster).

### Release versioning

- `build-extension.yml` injects the extension version from `v*` tags before
  building release zips.
- `publish-mcp-server.yml` injects `packages/mcp-server/package.json` from
  the same `v*` tag before `npm publish`; do not rely on the checked-in MCP
  package version for tagged publishes.
- Bump root `package.json` manually for the next release commit. Keep
  `packages/mcp-server/package.json` reasonably current as a fallback, but
  tag injection is the release source of truth.

### Coordinator smoke (Plan 12, manual)

```bash
node docs/superpowers/scripts/mini-coordinator.mjs   # 起一个最小 WS server
# 装载 dist/ 后，在 sidepanel 的 Coordinator 设置页填:
#   URL = ws://127.0.0.1:8787/worker
#   token = 任意非空
# 勾上 "允许 coordinator 远程驱动 chat session"，点 Connect
# 脚本会自动发 START_CHAT_SESSION（mock_llm 三轮）→ 应看到 1 个 continuation_nudge + 1 个 session_end(done)
```

## What's been built (state as of v0.0.16)

Read `docs/superpowers/specs/README.md` for the spec index. At a glance:

- **Plan 1** — executable skeleton: 9 builtin tools, IDB tools/runs, runner
- **Plan 2** — AI conversation: streaming Anthropic+OpenAI, step approval, runJS static scan
- **Plan 3** — AtWebPilot rebrand: 9 more tools (fillInput / setCheckbox / selectOption / submitForm / hover / focus / uploadFile / getValue / extractFormState), per-tool dangerous allowlist
- **Plan 4** — per-tab sessions: each tab its own conversation; closed-tab sessions previously kept 5 min in memory (replaced by Plan 8)
- **Plan 5** — AI-generated summary step: save dialog asks LLM for a runJS step that integrates prior step outputs into stable JSON
- **Plan 6** — two tool-save flavors (`prompt` vs `steps`): AI summarises the conversation into a tool draft; prompt-tools jump straight to chat with the prompt prefilled at run time
- **Plan 7** — multi-tab context: one session can attach multiple tabs (`@`-mention, `openTab` tool, `attachTab` tool); 19 existing tools accept an optional `tabId`; new control-plane tools `listTabs`/`attachTab`/`detachTab`/`openTab`
- **Plan 8** — sidepanel session persistence: `chat_sessions` IDB store, per-URL ≤20 archived sessions, history drawer, banner switcher; in-memory `closedSessions` removed
- **Plan 9** — GitHub Actions: `build-extension.yml` runs typecheck+test+build on every push, attaches a versioned zip; pushing `v*` tag triggers a release (version injected from tag)
- **Plan 10** — Remote Coordinator (Phase 1+2): WS protocol (`HELLO`/`WELCOME`/`EXEC`/`RESULT`/...) in `packages/shared/src/protocol`; coordinator core in `packages/coordinator`; extension acts as a worker via `CoordinatorClient` (chrome.alarms heartbeat + backoff reconnect)
- **Plan 11** — Raw LLM exchange log + continuation guard: `recording-client.ts` captures every LLM round; dedicated viewer panel; `continuation guard` nudges the model when it stops with a text-only turn (`maxContinuationNudges`, default 1)
- **Plan 12** — Remote-testable chat session (v0.0.16): `START_CHAT_SESSION`/`ABORT_SESSION`/`READ_SIDEPANEL_STATE`/`CHAT_EVENT`/`SIDEPANEL_STATE_REPLY`; `CoordinatorChatHost` runs `runChatSession` BG-side with `MockLlmClient`+`BackgroundToolRunner`+`AutoApprover`; `allow_remote_chat` opt-in; `RunRecord.source` tag

### Recent material bug fixes worth remembering

- **v0.0.14** — `tabs.spawned` opener-match handler was attributing user Ctrl+clicks (idle session) to AI. Gated on `session.status ∈ {running, streaming}`. See `packages/extension/src/sidepanel/chat/cross-tab-events.ts`.
- **v0.0.15** — Continuation guard `nudgesSinceProgress` reset on any tool call, allowing infinite "AI 确认完成" loops when the model alternated text-only with a verification tool. Renamed to session-total `totalNudges`; reset removed. See `packages/extension/src/sidepanel/chat/run-session.ts`.

## Anti-patterns to avoid

- Reading `currentTabId` inside async callbacks during a chat session
- Adding business logic to a component (move to `chat/` or shared/`)
- Treating `runJS` errors as `output: null` (BG now wraps + re-throws —
  don't undo)
- Renaming `caiji` → `atwebpilot` anywhere user data lives (IDB / import
  alias `@/`)
- Touching `.idea/` or other IDE configs in commits
- Hard-coding `chrome.*` access in `runChatSession` or anything below
  it — go through DI (the `tabsRpc` / `runner` / `client` / `approver`
  injection points). The host running in BG (`CoordinatorChatHost`)
  has no sidepanel and works with stubs in tests.
- Bypassing the wire schema when sending over WS. `CoordinatorClient.send`
  re-validates every outgoing message against `ClientToServerSchema`;
  if a schema mismatch silently drops your message you're missing a
  field — fix the construction site, don't widen the schema.
- Mutating `RunRecord` after `finalizeRun`. The reader path applies
  `withSourceDefault` for legacy records — write a fresh record instead
  of patching one in place.

## Test-driven changes

Most modules in `packages/shared/src/`, `packages/extension/src/sidepanel/llm/`, `packages/extension/src/sidepanel/chat/`
have direct unit-test counterparts in `packages/shared/tests/` and `packages/extension/tests/`. When changing one:

1. Edit the test first to express the new behavior
2. Run failing
3. Implement
4. Run passing
5. Commit (separate test commit and impl commit not required; bundle is fine)

# Agent Guide — WebPilot

This file orients AI agents (Claude Code / Codex / Cursor) working in this
repo. Read it before making non-trivial changes.

## What this is

WebPilot is a Chromium MV3 side-panel extension that lets a user converse
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
- vitest + happy-dom + fake-indexeddb (no Playwright; e2e is manual)
- pnpm (lock checked in)
- LLM: Anthropic Messages API + OpenAI Chat API; both stream via fetch
  directly from the side panel (no proxy, no key on disk except
  `chrome.storage.local | session`)

## Repo layout

```
src/
├─ manifest.ts                       MV3 manifest (defineManifest)
├─ shared/                            Imports allowed from all three entrypoints
│  ├─ types.ts                        Tool / Step / RunRecord / SessionData / LlmSettings / ChatMessage / ScanFinding
│  ├─ messages.ts                     zod RPC schemas (sidepanel <-> bg <-> content)
│  ├─ url-pattern.ts                  glob → RegExp
│  ├─ static-scan.ts                  runJS source → severity findings (regex rules)
│  └─ infer-json-schema.ts            Minimal JSON Schema inference for save dialog
├─ background/                        Service worker
│  ├─ index.ts                        Wakeup + RPC listener + tab-watcher install
│  ├─ rpc-handlers.ts                 Dispatch RpcRequest; runOneStep + injectMainWorld
│  ├─ http-proxy.ts                   Cross-origin fetch (omit/include cookie); fetchAsBase64 for uploadFile
│  ├─ tab-watcher.ts                  chrome.tabs / webNavigation → set badge + push tabs.recommendations
│  └─ storage/{db,tools,runs,export-import}.ts   IndexedDB (DB_NAME = "caiji" — do NOT rename)
├─ content/                           Content script (isolated world)
│  ├─ index.ts                        chrome.runtime.onMessage → callTool / injectMain
│  ├─ runner.ts + ctx.ts              Step Runner with ${var} bindings + timeout
│  ├─ inject-main.ts                  Bridge to BG.scripting.injectMain
│  └─ tools/*.ts                      One file per BuiltinTool
└─ sidepanel/                         React UI (the only user surface)
   ├─ rpc.ts                          typed wrappers + onTabRecommendations + retry on SW wake
   ├─ chat/
   │  ├─ session-store.ts             zustand: sessionsByTab + closedSessions + currentTabId; per-tab actions
   │  ├─ approval.ts                  Per-tab Approver factory
   │  ├─ severity.ts                  classifyTool / autoApproves(sev,name,toggle,allowlist)
   │  ├─ tool-runner.ts               Wraps rpc.runOneStep
   │  ├─ run-session.ts               LLM tool-use loop (DI: client/runner/approver/rpc); emits SessionEvent
   │  ├─ tab-tracker.ts               chrome.tabs events → store actions
   │  ├─ closed-sessions-pruner.ts    setInterval prune
   │  └─ settings-store.ts            LlmSettings (provider/model/apiKey/endpoint/maxRounds/maxTokens/autoApproveDangerous)
   ├─ llm/
   │  ├─ types.ts                     LlmClient interface (streaming events)
   │  ├─ anthropic.ts / openai.ts     SSE parsers (parseAnthropicStream / parseOpenAiStream are pure, well-tested)
   │  ├─ client.ts                    pickClient(provider)
   │  ├─ tool-schema.ts               19 BuiltinTool LlmTool defs + runJS
   │  ├─ system-prompt.ts             buildSystemPrompt({url,title,savedTools})
   │  └─ summary-step.ts              One-shot non-streaming gen of a "summary runJS step" for save-as-tool
   ├─ pages/
   │  ├─ chat-page.tsx                Default route; full session loop wiring (tabId captured in send() closure)
   │  ├─ tools-page.tsx               List + per-row export + page import
   │  ├─ tool-detail-page.tsx         Replay tool; ResultView hoisted above step list; autoRun supported
   │  ├─ run-page.tsx                 DEV: paste Tool JSON
   │  └─ settings-page.tsx            LLM + 自动通过策略 + 备份
   ├─ components/                     Stateless except where needed (chat-view, step-card, etc.)
   └─ app.tsx                         Routing + tab-tracker mount + pruner
docs/superpowers/
├─ specs/      Design docs (one per planning cycle); see specs/README.md for index
└─ plans/      Implementation plans (numbered Plan 1-5)
tests/         Unit + integration; mirrors src/ tree
```

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

- **IDB DB name is `caiji`** in `background/storage/db.ts`. Do not rename
  it (would orphan every existing user's saved tools). Internal name and
  product name (WebPilot) are intentionally decoupled.
- **No new dependencies without asking.** Existing stack covers everything
  we've needed; new deps cost build size and review burden.
- **API key never goes to IDB or to any export bundle.** It lives in
  `chrome.storage.local` (or `chrome.storage.session`).
- **Plan 4 per-tab invariant**: when run-session runs, capture `tabId`
  in the `send()` closure and pass it to every store action / approver
  lookup. Do NOT read `useStore.getState().currentTabId` inside async
  callbacks — the user may have switched tabs and you'll write to the
  wrong session. See `chat-page.tsx`'s `stepFromCard` and the
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

## Common tasks

### Add a new BuiltinTool

1. `src/shared/types.ts` — add to `BuiltinTool` union
2. `src/shared/messages.ts` — add to `StepSchema` enum
3. `src/content/tools/<tool>.ts` — implement `(args: Json) => Promise<Json>`
4. `src/content/tools/index.ts` — register in `TOOLS`
5. `src/sidepanel/llm/tool-schema.ts` — add `LlmTool` def with JSON Schema
6. `src/sidepanel/chat/severity.ts` — classify in safe / caution / dangerous
7. `tests/content/tools/<tool>.test.ts` — happy-dom unit tests
8. `tests/sidepanel/chat/severity.test.ts` — add a classification case

### Add a new RPC

1. `src/shared/messages.ts` — add to `RpcRequest` discriminatedUnion
2. `src/background/rpc-handlers.ts` — handle in `dispatch` switch
3. `src/sidepanel/rpc.ts` — add typed wrapper

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
pnpm typecheck      # tsc -b --noEmit; CI gate
pnpm test           # vitest run; full suite
pnpm test:watch
pnpm build          # tsc + vite build → dist/
```

Load `dist/` via `chrome://extensions` (developer mode → load unpacked).
After code change: rebuild, then click the reload icon on the extension.
**Reload an open page if content script seems missing** (the BG-side
auto-injection retries up to 2s but a hard refresh is faster).

## What's been built (state as of Plan 5)

Read `docs/superpowers/specs/README.md` for the spec index. At a glance:

- Plan 1 — executable skeleton: 9 builtin tools, IDB tools/runs, runner
- Plan 2 — AI conversation: streaming Anthropic+OpenAI, step approval, runJS scan
- Plan 3 — WebPilot rebrand: 9 more tools (fillInput / setCheckbox /
  selectOption / submitForm / hover / focus / uploadFile / getValue /
  extractFormState), per-tool dangerous allowlist
- Plan 4 — per-tab sessions: each tab its own conversation; closed-tab
  sessions kept 5 min
- Plan 5 — AI-generated summary step: save dialog can ask LLM for a
  runJS step that integrates prior outputs into stable JSON

## Anti-patterns to avoid

- Reading `currentTabId` inside async callbacks during a chat session
- Adding business logic to a component (move to chat/ or shared/)
- Treating `runJS` errors as `output: null` (BG now wraps + re-throws —
  don't undo)
- Renaming `caiji` → `webpilot` anywhere user data lives (IDB / import
  alias `@/`)
- Touching `.idea/` or other IDE configs in commits

## Test-driven changes

Most modules in `src/shared/`, `src/sidepanel/llm/`, `src/sidepanel/chat/`
have direct unit-test counterparts in `tests/`. When changing one:

1. Edit the test first to express the new behavior
2. Run failing
3. Implement
4. Run passing
5. Commit (separate test commit and impl commit not required; bundle is fine)

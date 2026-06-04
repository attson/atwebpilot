# Remote-testable Chat Session — Design Spec

**Date:** 2026-06-04
**Status:** Draft — pending implementation plan
**Goal:** Expose the sidepanel chat loop (`runChatSession`) and a sidepanel state probe over the existing WebSocket coordinator protocol, so that **bugs living inside the chat session and the cross-tab handler can be exercised end-to-end from a remote test harness** — without requiring browser automation, an LLM API key, or user UI interaction.

Two recent fixes drove this work:

- **v0.0.14** — cross-tab handler (`packages/extension/src/sidepanel/chat/cross-tab-events.ts`) misattributed user-opened tabs as AI-opened when session was idle. Reproducing this needs `tabs.spawned` events with `openerTabId` set + the sidepanel zustand store + a way to read its post-event state.
- **v0.0.15** — continuation nudge budget in `run-session.ts` reset on every tool use, causing infinite "AI confirms done" loops when the model alternated text-only summaries with verification tool calls. Reproducing this needs a deterministic LLM stream and the ability to observe chat events end-to-end.

Both bugs were caught and unit-tested in their respective files. The unit tests pass — but they exercise pure functions in isolation. This spec adds **integration-level coverage** that goes through the same wires real users hit, while keeping zero impact on the user-facing sidepanel chat path.

---

## Non-goals

- **Pair codes / daemon / MCP server** — orthogonal Phase 3 work.
- **Multi-session concurrency** — out of scope; a single coordinator-driven session at a time is enough for testing.
- **Sidepanel UI changes for coordinator sessions** — coordinator sessions are explicitly invisible to the user at runtime; they only appear in run history with a `source: "coordinator"` filter.
- **Authoring tooling for mock LLM scripts** — coordinator authors produce raw `LlmStreamEvent[][]` JSON; no DSL.
- **Subscribing to live sidepanel state changes** — one-shot snapshot only; subscription model can be added later if needed.

---

## Architecture

```
┌────────────────────────────┐         ┌─────────────────────────────────┐
│  Coordinator (WS server)   │ ◄────►  │  Extension Background (SW)      │
│                            │ WS      │                                 │
│  - START_CHAT_SESSION      │         │  CoordinatorClient (existing)   │
│  - ABORT_SESSION           │         │       │                         │
│  - EXEC (existing)         │         │       ├─► coordinator-chat.ts   │
│  - READ_SIDEPANEL_STATE    │         │       │   ├ MockLlmClient       │
│                            │         │       │   ├ runChatSession()    │
│  ◄ CHAT_EVENT              │         │       │   │  (existing pure)    │
│  ◄ RESULT (existing)       │         │       │   └ chrome.runtime msg  │
│  ◄ SIDEPANEL_STATE_REPLY   │         │       │      ─► sidepanel only  │
└────────────────────────────┘         │       │         (for READ_*)    │
                                       │       │                         │
                                       │       └─► coordinator-exec.ts   │
                                       │           (existing EXEC path)  │
                                       │                                 │
                                       │  Settings page                  │
                                       │   └ allow_remote_chat checkbox  │
                                       │     (default false)             │
                                       └─────────────────────────────────┘
                                              │
                                              ▼ chrome.runtime.sendMessage
                                       ┌─────────────────────────────────┐
                                       │  Sidepanel (user-driven only)   │
                                       │  - Responds to READ_SIDEPANEL_  │
                                       │    STATE with zustand snapshot  │
                                       │  - Coordinator chat invisible   │
                                       │    here at runtime              │
                                       └─────────────────────────────────┘
```

### Key invariants

- **Coordinator-driven chat sessions live entirely in the background service worker.** They call the same pure `runChatSession()` function the sidepanel uses, but with a different `client` (mock or real-from-storage), `runner` (background-side tool runner), `approver` (always-approve, gated by opt-in flag), and `rpc` (writes run records with `source: "coordinator"`).
- **The user-facing sidepanel chat path is untouched.** No code in `packages/extension/src/sidepanel/chat/` changes behaviour for user sessions. The only sidepanel change is a new top-level listener for `READ_SIDEPANEL_STATE` requests.
- **`READ_SIDEPANEL_STATE` is read-only.** It cannot mutate sidepanel state; it returns a snapshot or `found: false`.
- **Persistence is shared but tagged.** Coordinator-driven sessions write to the same `runs` table via the same rpc functions. Each run record carries `source: "user" | "coordinator"`. The history UI defaults to filtering out `coordinator` records, with a toggle to show them.

---

## Protocol

Added to `packages/shared/src/protocol/messages.ts`. Existing schemas are not modified; only new variants are added to the discriminated unions.

### Server → Client (coordinator → extension)

```ts
StartChatSessionSchema = z.object({
  ...EnvelopeFields,
  type: z.literal("START_CHAT_SESSION"),
  session_id: z.string().min(1),
  user_prompt: z.string(),
  tab_id: z.string().optional(),
  mock_llm: z.object({
    rounds: z.array(z.array(LlmStreamEventSchema))
  }).optional(),
  settings_override: z.object({
    maxRounds: z.number().int().positive().optional(),
    maxContinuationNudges: z.number().int().nonnegative().optional()
  }).optional()
});

AbortSessionSchema = z.object({
  ...EnvelopeFields,
  type: z.literal("ABORT_SESSION"),
  session_id: z.string().min(1)
});

ReadSidepanelStateSchema = z.object({
  ...EnvelopeFields,
  type: z.literal("READ_SIDEPANEL_STATE"),
  req_id: z.string().min(1),
  tab_id: z.string().min(1)
});
```

### Client → Server (extension → coordinator)

```ts
ChatEventSchema = z.object({
  ...EnvelopeFields,
  type: z.literal("CHAT_EVENT"),
  session_id: z.string().min(1),
  event: SessionEventSchema   // zod mirror of run-session's SessionEvent union
});

SidepanelStateReplySchema = z.object({
  ...EnvelopeFields,
  type: z.literal("SIDEPANEL_STATE_REPLY"),
  req_id: z.string().min(1),
  found: z.boolean(),
  snapshot: z.object({
    status: SessionStatusSchema,         // "idle" | "running" | ... mirror
    messagesCount: z.number().int().nonnegative(),
    attachedTabs: z.array(z.object({
      tabId: z.number().int(),
      source: z.string(),
      lastSeenUrl: z.string()
    })),
    lastSystemNote: z.string().optional()
  }).optional()
});
```

### Type sharing

- `LlmStreamEvent` currently lives in `packages/extension/src/sidepanel/llm/types.ts`. **It moves to `packages/shared/src/llm/types.ts`** so both `coordinator` package and `extension` package can import it without circular deps. Import paths in extension are updated; no behaviour change.
- `SessionEvent` and `SessionStatus` are mirrored as **separate zod schemas** in `packages/shared/src/protocol/chat-event.ts` rather than re-using the TS types from `run-session.ts`. This keeps the boundary clean (shared/protocol owns wire schemas; extension owns runtime types). The two must stay in sync — covered by a property-style test that round-trips each variant.

---

## Background components

### `packages/extension/src/background/coordinator-chat.ts` (new)

Owns one optional active coordinator-driven session at a time.

```ts
export class CoordinatorChatHost {
  private active: { sessionId: string; abort: AbortController } | null = null;

  async handle(msg: ServerToClient, send: (m: ClientToServer) => void): Promise<void> {
    switch (msg.type) {
      case "START_CHAT_SESSION":
        if (this.active) {
          send(makeChatEvent(msg.session_id, sessionEnd("error", "another session is running")));
          return;
        }
        if (!(await isRemoteChatAllowed())) {
          send(makeChatEvent(msg.session_id, sessionEnd("error", "remote chat disabled in settings")));
          return;
        }
        await this.start(msg, send);
        return;
      case "ABORT_SESSION":
        if (this.active?.sessionId === msg.session_id) this.active.abort.abort();
        return;
    }
  }

  private async start(msg: StartChatSession, send: (m: ClientToServer) => void): Promise<void> {
    const ac = new AbortController();
    this.active = { sessionId: msg.session_id, abort: ac };
    try {
      const client: LlmClient = msg.mock_llm
        ? new MockLlmClient(msg.mock_llm.rounds)
        : await buildRealLlmClientFromStorage();
      const tabId = msg.tab_id ? Number(msg.tab_id) : await pickActiveTab();
      await runChatSession({
        client,
        runner: new BackgroundToolRunner(),
        approver: new AutoApprover(),
        rpc: makeBgRpc({ source: "coordinator" }),
        input: { userPrompt: msg.user_prompt, tabId, url: await urlFor(tabId) },
        settings: { ...await defaultRunSettings(), ...msg.settings_override },
        systemPrompt: await loadSystemPrompt(),
        tools: TOOL_DEFS,
        approveAllSafe: true,
        attachedTabIds: [],
        tabsRpc: { listTabs: bgListTabs, openTab: bgOpenTab },
        abortSignal: ac.signal,
        onEvent: (e) => send(makeChatEvent(msg.session_id, e))
      });
    } catch (e) {
      send(makeChatEvent(msg.session_id, sessionEnd("error", e instanceof Error ? e.message : String(e))));
    } finally {
      this.active = null;
    }
  }
}
```

### `packages/extension/src/background/mock-llm-client.ts` (new)

```ts
export class MockLlmClient implements LlmClient {
  constructor(private rounds: LlmStreamEvent[][]) {}
  private i = 0;
  stream(_args: LlmStreamArgs): AsyncIterable<LlmStreamEvent> {
    const events = this.rounds[this.i++] ?? [
      { type: "message_end", usage: { input_tokens: 0, output_tokens: 0 } }
    ];
    return (async function*() { for (const e of events) yield e; })();
  }
}
```

### `packages/extension/src/background/bg-tool-runner.ts` (new)

`ToolRunner` implementation that delegates to the existing `runOneStep` exported from `rpc-handlers.ts`. No new tool logic.

### `packages/extension/src/background/coordinator-state-bridge.ts` (new — background side of READ_SIDEPANEL_STATE)

- Receives `READ_SIDEPANEL_STATE` from `CoordinatorClient`.
- Generates a `req_id`-tagged `chrome.runtime.sendMessage({ type: "ping.sidepanelState", ... })`.
- Sets a 500ms timeout. First matching `pong.sidepanelState` resolves; otherwise `found: false`.
- Sends `SIDEPANEL_STATE_REPLY` back over WS.

### `packages/extension/src/background/coordinator-client.ts` (existing, modified)

`onMessage` adds three new branches that route to the new components above. HELLO / WELCOME / EXEC / PING / PONG behaviour is unchanged.

---

## Sidepanel components

### `packages/extension/src/sidepanel/coordinator-state-bridge.ts` (new)

Mounted at sidepanel app startup. Listens for `chrome.runtime.onMessage` with `type: "ping.sidepanelState"`. On receipt:

- Reads zustand `useStore.getState().sessionsByTab[tab_id]`.
- If no session exists: respond with `{ pong, req_id, found: false }`.
- Else: build snapshot from `status`, `messages.length`, `attachedTabs`, and last system-role `messages` entry.
- Respond with `chrome.runtime.sendMessage({ type: "pong.sidepanelState", req_id, found: true, snapshot })`.

**Multi-sidepanel safety:** if multiple sidepanel instances are open, multiple pongs may arrive. The background bridge accepts the first and ignores the rest (matched by `req_id`).

### `packages/extension/src/sidepanel/pages/coordinator-settings-page.tsx` (existing, modified)

Adds a checkbox:

```
[ ] 允许 coordinator 远程驱动 chat session 和危险工具
    （开启后，连接的 coordinator 可以在你的浏览器里运行任意工具。
     仅在你信任该 coordinator 时勾选。）
```

Value stored at `chrome.storage.local.coordinator.allow_remote_chat` (default `false`). Reading this flag is the responsibility of `isRemoteChatAllowed()` in `coordinator-chat.ts`.

---

## Persistence

Run records produced by coordinator-driven sessions are written via the same `rpc.startSession` / `appendStepLog` / `finalizeSession` calls as user sessions. A new field is added:

```ts
type RunRecord = {
  // existing fields...
  source: "user" | "coordinator";  // NEW; defaults to "user" for backwards compat
};
```

Migration: existing records without `source` are treated as `"user"`. No data migration needed — read-side defaults the missing field.

The sidepanel history UI gets a filter (default: hide `coordinator`). The exact UI placement of this toggle is intentionally left vague in this spec; the implementation plan will pick a small, low-risk location during execution.

---

## Error handling

| Situation | Behavior |
|---|---|
| `allow_remote_chat=false` + `START_CHAT_SESSION` | Immediate `CHAT_EVENT session_end status:"error" reason:"remote chat disabled"`. No run record. |
| Active session exists + new `START_CHAT_SESSION` | `session_end status:"error" reason:"another session is running"`. New session not started. |
| `mock_llm` omitted + no API key in storage | `session_end status:"error" reason:"no API key configured"`. No run record. |
| Tool runner throws | `runChatSession` already wraps as `tool_error` SessionEvent; passed through transparently. |
| `runChatSession` itself throws | Caught in host; emit `session_end status:"error" reason:msg`. |
| WS disconnect mid-session | `active.abort.abort()`. No resume on reconnect. |
| `ABORT_SESSION` with mismatched session_id | Silently ignored. |
| `READ_SIDEPANEL_STATE` with no sidepanel open / no response in 500ms | `SIDEPANEL_STATE_REPLY { found: false }`. |
| Multiple sidepanel instances pong | First by `req_id` wins; rest dropped. |
| Mock LLM `rounds` array exhausted | Auto-yield a default `message_end`. `runChatSession`'s existing continuation-guard logic handles the rest. |

## Security boundaries

- `allow_remote_chat=false` blocks **only** `START_CHAT_SESSION`. Existing EXEC behavior (including dangerous tools like click / runJS / httpRequest) is **unchanged** — those were already accepted by Phase 2 contracts, and changing them silently on upgrade would break currently connected coordinators. Auto-approval inside a coordinator-driven chat session is a more powerful surface (the session can chain many tools without user oversight), which is what the new flag gates.
- `READ_SIDEPANEL_STATE` does **not** require the flag — it is read-only and the coordinator is already authenticated by token via the HELLO handshake.
- `ABORT_SESSION` does **not** require the flag — it can only cancel sessions the coordinator itself spawned.

---

## Testing strategy

Five layers, fail-first TDD by default, with each layer building on the one below.

### Layer 1 — Protocol schemas (`packages/shared/tests/protocol/`)

- `start-chat-session.test.ts` — required fields, optional `mock_llm` shape, `LlmStreamEvent` round-trip.
- `chat-event.test.ts` — every `SessionEvent` variant parses + round-trips.
- `abort-session.test.ts`, `read-sidepanel-state.test.ts`, `sidepanel-state-reply.test.ts`.

### Layer 2 — `MockLlmClient` (`packages/extension/tests/background/`)

- Consumes rounds in order.
- Auto-yields `message_end` when exhausted.
- `usage` defaults correctly.

### Layer 3 — `CoordinatorChatHost` (`packages/extension/tests/background/coordinator-chat-host.test.ts`)

- `allow_remote_chat=false` → immediate error `CHAT_EVENT`.
- Concurrent `START_CHAT_SESSION` rejected.
- `ABORT_SESSION` matches → `abort()` invoked; non-match → silent.
- `onEvent` callbacks passed through as `CHAT_EVENT` messages.
- Uses an injected fake `runChatSession` (no real chat loop invocation in this layer).

### Layer 4 — End-to-end via real `ws` server (`packages/extension/tests/background/coordinator-e2e.test.ts`, augment existing file)

```ts
it("START_CHAT_SESSION end-to-end: continuation guard nudges exactly once", async () => {
  // server connects, sends START_CHAT_SESSION with mock_llm rounds:
  //   R0: [{ type:"text_delta", text:"采集完成" }, { type:"message_end" }]
  //   R1: [{ type:"tool_use_start", id:"t1", name:"httpRequest" },
  //        { type:"tool_use_input_delta", id:"t1", partial_json:"{}" },
  //        { type:"tool_use_end", id:"t1", input:{} },
  //        { type:"message_end" }]
  //   R2: [{ type:"text_delta", text:"确认完成" }, { type:"message_end" }]
  // collect all CHAT_EVENT messages from extension
  // assert exactly one continuation_nudge
  // assert final session_end status="done"
});

it("rejects START_CHAT_SESSION when allow_remote_chat is false", async () => { ... });
it("ABORT_SESSION cancels mid-stream", async () => { ... });
it("READ_SIDEPANEL_STATE returns found:false when no sidepanel listens", async () => { ... });
```

### Layer 5 — Real-Chrome smoke checklist (manual, ~5 min, run after each release)

Documented in this spec but not enforced in CI. Steps:

1. `pnpm build` → load `packages/extension/dist` unpacked into Chrome.
2. Start the local mini coordinator (50-line Node script bundled with this spec).
3. Open Coordinator settings page → paste URL + token, **leave allow flag off** → connect.
4. Coordinator sends `START_CHAT_SESSION` → expect `session_end error: "remote chat disabled"`.
5. Tick the allow flag → resend → expect `session_end status:"done"` with exactly one `continuation_nudge`.
6. With an idle session for tab T open, manually Ctrl-click a link in tab T → confirm sidepanel shows **no** "AI 在 #X 打开了" system note.
7. Coordinator sends `READ_SIDEPANEL_STATE { tab_id: T }` → expect `attachedTabs: []`.

### CI coverage

Layers 1–4 run under existing `pnpm test`. Layer 5 is manual.

---

## File-by-file changes summary

**New files:**

- `packages/shared/src/llm/types.ts` — moved from `packages/extension/src/sidepanel/llm/types.ts`
- `packages/shared/src/protocol/chat-event.ts` — zod schemas for `SessionEvent` and `SessionStatus` mirror
- `packages/extension/src/background/coordinator-chat.ts`
- `packages/extension/src/background/mock-llm-client.ts`
- `packages/extension/src/background/bg-tool-runner.ts`
- `packages/extension/src/background/coordinator-state-bridge.ts`
- `packages/extension/src/sidepanel/coordinator-state-bridge.ts`
- Test files mirroring each above
- `docs/superpowers/specs/2026-06-04-remote-testable-chat-design.md` (this file)
- `docs/superpowers/scripts/mini-coordinator.mjs` (Layer 5 smoke helper)

**Modified files:**

- `packages/shared/src/protocol/messages.ts` — add 5 new schemas + extend discriminated unions
- `packages/shared/src/protocol/index.ts` — export new types
- `packages/extension/src/sidepanel/llm/types.ts` — re-export from shared for back-compat
- `packages/extension/src/background/coordinator-client.ts` — route new message types
- `packages/extension/src/background/rpc-handlers.ts` — minor: add `source` field plumbing
- `packages/extension/src/background/storage/runs.ts` — add `source` field to RunRecord type + reader default
- `packages/extension/src/sidepanel/app.tsx` — mount `coordinator-state-bridge`
- `packages/extension/src/sidepanel/pages/coordinator-settings-page.tsx` — add allow checkbox
- `packages/extension/tests/background/coordinator-e2e.test.ts` — augment with new cases

**Unchanged:**

- `packages/extension/src/sidepanel/chat/*` — zero changes; the user-facing chat path is untouched.
- `packages/coordinator/src/*` — Phase 1 coordinator is a separate concern; this spec doesn't require its modification, though authoring a real coordinator that uses the new messages will need updates there in a separate effort.

---

## Open questions deferred to implementation

- Should `mock_llm.rounds` have a size cap to prevent accidentally huge payloads? Likely yes (~256KB) — confirmed during plan execution.
- Should `coordinator` source records have a separate retention policy (auto-delete after N days)? Default to existing user-record retention for now.
- Future work: a real coordinator CLI that ships with the repo and can author test scenarios from YAML. Out of scope here.

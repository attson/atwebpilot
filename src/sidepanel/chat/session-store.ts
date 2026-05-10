import { create } from "zustand";
import type { ChatMessage, Json, Step, ToolUsePart } from "@/shared/types";

export type StepCardState = {
  toolUseId: string;
  name: string;
  input: Json;
  partialJson: string;
  inputReady: boolean;
  status: "draft" | "awaiting" | "running" | "ok" | "error" | "skipped" | "denied";
  output?: Json;
  error?: string;
  ms?: number;
};

export type LogEntry = {
  ts: number;
  level: "info" | "warn" | "error";
  message: string;
  details?: string;
};

export type SessionStatus =
  | "idle"
  | "streaming"
  | "awaiting"
  | "running"
  | "done"
  | "error"
  | "aborted";

export type SessionData = {
  tabId: number;
  url: string;
  runRecordId: string | null;

  messages: ChatMessage[];
  streamingAssistantText: string;
  cards: StepCardState[];

  approveAllSafe: boolean;

  status: SessionStatus;
  errorMessage: string | null;
  roundCount: number;
  tokenUsage: { input: number; output: number };

  executedSteps: Step[];
  lastOutput: Json;
  showSaveDialog: boolean;

  abortController: AbortController | null;

  logs: LogEntry[];
  logsOpen: boolean;

  inputDraft: string;
};

export type ClosedSession = {
  tabId: number;
  url: string;
  closedAt: number;
  data: SessionData;
};

export function makeEmptySession(tabId: number, url = ""): SessionData {
  return {
    tabId,
    url,
    runRecordId: null,
    messages: [],
    streamingAssistantText: "",
    cards: [],
    approveAllSafe: true,
    status: "idle",
    errorMessage: null,
    roundCount: 0,
    tokenUsage: { input: 0, output: 0 },
    executedSteps: [],
    lastOutput: null,
    showSaveDialog: false,
    abortController: null,
    logs: [],
    logsOpen: false,
    inputDraft: ""
  };
}

export const EMPTY_SESSION: SessionData = Object.freeze(makeEmptySession(-1)) as SessionData;

/** @deprecated 兼容 Plan 1-3 命名；新代码用 SessionData */
export type ChatSessionState = SessionData;

const CLOSED_TTL_MS = 5 * 60 * 1000;

type StoreShape = {
  sessionsByTab: Record<number, SessionData>;
  closedSessions: ClosedSession[];
  currentTabId: number | null;
};

export const useStore = create<StoreShape>(() => ({
  sessionsByTab: {},
  closedSessions: [],
  currentTabId: null
}));

function patchSession(tabId: number, fn: (s: SessionData) => SessionData): void {
  useStore.setState((state) => {
    const cur = state.sessionsByTab[tabId];
    if (!cur) return state;
    const next = fn(cur);
    if (next === cur) return state;
    return {
      ...state,
      sessionsByTab: { ...state.sessionsByTab, [tabId]: next }
    };
  });
}

// === per-tab actions ===

export function ensureSession(tabId: number, url: string): void {
  useStore.setState((state) => {
    if (state.sessionsByTab[tabId]) {
      if (url && state.sessionsByTab[tabId].url !== url) {
        return {
          ...state,
          sessionsByTab: {
            ...state.sessionsByTab,
            [tabId]: { ...state.sessionsByTab[tabId], url }
          }
        };
      }
      return state;
    }
    return {
      ...state,
      sessionsByTab: { ...state.sessionsByTab, [tabId]: makeEmptySession(tabId, url) }
    };
  });
}

export function setCurrentTab(tabId: number): void {
  useStore.setState({ currentTabId: tabId });
}

export function setUrl(tabId: number, url: string): void {
  patchSession(tabId, (s) => ({ ...s, url }));
}

export function appendSystemNote(tabId: number, text: string): void {
  patchSession(tabId, (s) =>
    s.messages.length === 0
      ? s
      : { ...s, messages: [...s.messages, { role: "user", content: text }] }
  );
}

export function appendUserMessage(tabId: number, text: string): void {
  patchSession(tabId, (s) => ({
    ...s,
    messages: [...s.messages, { role: "user", content: text }]
  }));
}

export function beginAssistantTurn(tabId: number): void {
  patchSession(tabId, (s) => ({ ...s, streamingAssistantText: "" }));
}

export function appendAssistantText(tabId: number, delta: string): void {
  patchSession(tabId, (s) => ({
    ...s,
    streamingAssistantText: s.streamingAssistantText + delta
  }));
}

export function finalizeAssistantTurn(tabId: number, toolUses: ToolUsePart[]): void {
  patchSession(tabId, (s) => {
    const arr: Array<
      | { type: "text"; text: string }
      | { type: "tool_use"; id: string; name: string; input: Json }
    > = [];
    if (s.streamingAssistantText) arr.push({ type: "text", text: s.streamingAssistantText });
    for (const tu of toolUses) arr.push({ type: "tool_use", id: tu.id, name: tu.name, input: tu.input });
    return {
      ...s,
      messages: [...s.messages, { role: "assistant", content: arr }],
      streamingAssistantText: ""
    };
  });
}

export function upsertCard(
  tabId: number,
  card: Partial<StepCardState> & { toolUseId: string }
): void {
  patchSession(tabId, (s) => {
    const idx = s.cards.findIndex((c) => c.toolUseId === card.toolUseId);
    if (idx === -1) {
      const next: StepCardState = {
        toolUseId: card.toolUseId,
        name: card.name ?? "",
        input: card.input ?? {},
        partialJson: card.partialJson ?? "",
        inputReady: card.inputReady ?? false,
        status: card.status ?? "draft",
        output: card.output,
        error: card.error,
        ms: card.ms
      };
      return { ...s, cards: [...s.cards, next] };
    }
    const merged = { ...s.cards[idx], ...card };
    const cards = s.cards.slice();
    cards[idx] = merged;
    return { ...s, cards };
  });
}

export function setCardStatus(
  tabId: number,
  toolUseId: string,
  patch: Partial<Pick<StepCardState, "status" | "output" | "error" | "ms" | "input" | "inputReady">>
): void {
  patchSession(tabId, (s) => {
    const idx = s.cards.findIndex((c) => c.toolUseId === toolUseId);
    if (idx === -1) return s;
    const cards = s.cards.slice();
    cards[idx] = { ...cards[idx], ...patch };
    return { ...s, cards };
  });
}

export function appendToolResults(
  tabId: number,
  results: Array<{ tool_use_id: string; content: string; is_error?: boolean }>
): void {
  patchSession(tabId, (s) => ({
    ...s,
    messages: [
      ...s.messages,
      {
        role: "user",
        content: results.map((r) => ({
          type: "tool_result" as const,
          tool_use_id: r.tool_use_id,
          content: r.content,
          is_error: r.is_error
        }))
      }
    ]
  }));
}

export function pushExecutedStep(tabId: number, step: Step): void {
  patchSession(tabId, (s) => ({ ...s, executedSteps: [...s.executedSteps, step] }));
}

export function setLastOutput(tabId: number, v: Json): void {
  patchSession(tabId, (s) => ({ ...s, lastOutput: v }));
}

export function incrementRound(tabId: number): void {
  patchSession(tabId, (s) => ({ ...s, roundCount: s.roundCount + 1 }));
}

export function addUsage(
  tabId: number,
  u: { input_tokens: number; output_tokens: number }
): void {
  patchSession(tabId, (s) => ({
    ...s,
    tokenUsage: {
      input: s.tokenUsage.input + (u.input_tokens ?? 0),
      output: s.tokenUsage.output + (u.output_tokens ?? 0)
    }
  }));
}

export function setStatus(tabId: number, status: SessionStatus): void {
  patchSession(tabId, (s) => ({ ...s, status }));
}

export function setError(tabId: number, errorMessage: string | null): void {
  patchSession(tabId, (s) => ({ ...s, errorMessage }));
}

export function setApproveAllSafe(tabId: number, v: boolean): void {
  patchSession(tabId, (s) => ({ ...s, approveAllSafe: v }));
}

export function setIdentity(
  tabId: number,
  p: { url: string; runRecordId: string }
): void {
  patchSession(tabId, (s) => ({ ...s, url: p.url, runRecordId: p.runRecordId }));
}

export function setAbortController(tabId: number, ac: AbortController | null): void {
  patchSession(tabId, (s) => ({ ...s, abortController: ac }));
}

export function showSave(tabId: number): void {
  patchSession(tabId, (s) => ({ ...s, showSaveDialog: true }));
}

export function hideSave(tabId: number): void {
  patchSession(tabId, (s) => ({ ...s, showSaveDialog: false }));
}

export function appendLog(
  tabId: number,
  level: LogEntry["level"],
  message: string,
  details?: string
): void {
  patchSession(tabId, (s) => ({
    ...s,
    logs: [...s.logs, { ts: Date.now(), level, message, details }]
  }));
}

export function clearLogs(tabId: number): void {
  patchSession(tabId, (s) => ({ ...s, logs: [] }));
}

export function setLogsOpen(tabId: number, open: boolean): void {
  patchSession(tabId, (s) => ({ ...s, logsOpen: open }));
}

export function setInputDraft(tabId: number, text: string): void {
  patchSession(tabId, (s) => ({ ...s, inputDraft: text }));
}

export function resetSession(tabId: number): void {
  patchSession(tabId, (s) => ({ ...makeEmptySession(tabId, s.url) }));
}

// === closed sessions ===

export function closeTab(tabId: number): void {
  useStore.setState((state) => {
    const s = state.sessionsByTab[tabId];
    if (!s) return state;
    s.abortController?.abort();
    const { [tabId]: _gone, ...rest } = state.sessionsByTab;
    void _gone;
    if (s.messages.length === 0) {
      return { ...state, sessionsByTab: rest };
    }
    return {
      ...state,
      sessionsByTab: rest,
      closedSessions: [
        ...state.closedSessions,
        { tabId, url: s.url, closedAt: Date.now(), data: s }
      ]
    };
  });
}

export function restoreClosed(closedIndex: number, targetTabId: number): void {
  useStore.setState((state) => {
    const c = state.closedSessions[closedIndex];
    if (!c) return state;
    const restored: SessionData = {
      ...c.data,
      tabId: targetTabId,
      abortController: null,
      status: "idle",
      showSaveDialog: false,
      streamingAssistantText: "",
      runRecordId: null,
      messages: [
        ...c.data.messages,
        {
          role: "user",
          content: `[已恢复] 来自原 tab ${c.tabId}（${c.url}）的会话，请继续`
        }
      ]
    };
    const closedSessions = state.closedSessions.slice();
    closedSessions.splice(closedIndex, 1);
    return {
      ...state,
      sessionsByTab: { ...state.sessionsByTab, [targetTabId]: restored },
      closedSessions
    };
  });
}

export function pruneClosed(now: number): void {
  useStore.setState((state) => {
    const next = state.closedSessions.filter((c) => now - c.closedAt < CLOSED_TTL_MS);
    return next.length === state.closedSessions.length
      ? state
      : { ...state, closedSessions: next };
  });
}

// === selectors ===

export function getSessionFor(tabId: number): SessionData {
  return useStore.getState().sessionsByTab[tabId] ?? EMPTY_SESSION;
}

// === legacy hook (transitional) ===

type LegacySession = SessionData & {
  reset: () => void;
  setApproveAllSafe: (v: boolean) => void;
  setStatus: (s: SessionStatus) => void;
  setError: (msg: string | null) => void;
  setIdentity: (p: { tabId?: number; url: string; runRecordId: string }) => void;
  appendUserMessage: (text: string) => void;
  beginAssistantTurn: () => void;
  appendAssistantText: (delta: string) => void;
  finalizeAssistantTurn: (toolUses: ToolUsePart[]) => void;
  upsertCard: (card: Partial<StepCardState> & { toolUseId: string }) => void;
  setCardStatus: (
    toolUseId: string,
    patch: Partial<Pick<StepCardState, "status" | "output" | "error" | "ms" | "input" | "inputReady">>
  ) => void;
  appendToolResults: (
    results: Array<{ tool_use_id: string; content: string; is_error?: boolean }>
  ) => void;
  pushExecutedStep: (step: Step) => void;
  setLastOutput: (v: Json) => void;
  incrementRound: () => void;
  addUsage: (u: { input_tokens: number; output_tokens: number }) => void;
  setAbortController: (c: AbortController | null) => void;
  showSave: () => void;
  hideSave: () => void;
  appendLog: (level: LogEntry["level"], message: string, details?: string) => void;
  clearLogs: () => void;
  setLogsOpen: (open: boolean) => void;
  setInputDraft: (text: string) => void;
};

export function useSession(): LegacySession {
  const data = useStore((s) => {
    const id = s.currentTabId;
    return id == null ? EMPTY_SESSION : (s.sessionsByTab[id] ?? EMPTY_SESSION);
  });
  const tabId = useStore.getState().currentTabId ?? -1;

  return {
    ...data,
    reset: () => resetSession(tabId),
    setApproveAllSafe: (v) => setApproveAllSafe(tabId, v),
    setStatus: (s) => setStatus(tabId, s),
    setError: (m) => setError(tabId, m),
    setIdentity: (p) => setIdentity(tabId, { url: p.url, runRecordId: p.runRecordId }),
    appendUserMessage: (t) => appendUserMessage(tabId, t),
    beginAssistantTurn: () => beginAssistantTurn(tabId),
    appendAssistantText: (d) => appendAssistantText(tabId, d),
    finalizeAssistantTurn: (tu) => finalizeAssistantTurn(tabId, tu),
    upsertCard: (c) => upsertCard(tabId, c),
    setCardStatus: (id, p) => setCardStatus(tabId, id, p),
    appendToolResults: (r) => appendToolResults(tabId, r),
    pushExecutedStep: (s) => pushExecutedStep(tabId, s),
    setLastOutput: (v) => setLastOutput(tabId, v),
    incrementRound: () => incrementRound(tabId),
    addUsage: (u) => addUsage(tabId, u),
    setAbortController: (ac) => setAbortController(tabId, ac),
    showSave: () => showSave(tabId),
    hideSave: () => hideSave(tabId),
    appendLog: (l, m, d) => appendLog(tabId, l, m, d),
    clearLogs: () => clearLogs(tabId),
    setLogsOpen: (o) => setLogsOpen(tabId, o),
    setInputDraft: (t) => setInputDraft(tabId, t)
  };
}

export function useCurrentTabId(): number | null {
  return useStore((s) => s.currentTabId);
}

export function useClosedSessions(): ClosedSession[] {
  return useStore((s) => s.closedSessions);
}

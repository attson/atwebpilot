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

export type ChatSessionState = {
  runRecordId: string | null;
  tabId: number | null;
  url: string;

  messages: ChatMessage[];
  streamingAssistantText: string;
  cards: StepCardState[];
  approveAllSafe: boolean;
  status: "idle" | "streaming" | "awaiting" | "running" | "done" | "error" | "aborted";
  errorMessage: string | null;

  roundCount: number;
  tokenUsage: { input: number; output: number };

  executedSteps: Step[];
  lastOutput: Json;
  showSaveDialog: boolean;

  abortController: AbortController | null;

  // 日志抽屉
  logs: LogEntry[];
  logsOpen: boolean;
};

export type LogEntry = {
  ts: number;
  level: "info" | "warn" | "error";
  message: string;
  details?: string;
};

const initialState = (): ChatSessionState => ({
  runRecordId: null,
  tabId: null,
  url: "",
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
  logsOpen: false
});

type SessionActions = {
  reset: () => void;
  setApproveAllSafe: (v: boolean) => void;
  setStatus: (s: ChatSessionState["status"]) => void;
  setError: (msg: string | null) => void;
  setIdentity: (p: { tabId: number; url: string; runRecordId: string }) => void;
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
};

export const useSession = create<ChatSessionState & SessionActions>((set) => ({
  ...initialState(),
  reset: () => set({ ...initialState() }),
  setApproveAllSafe: (v) => set({ approveAllSafe: v }),
  setStatus: (s) => set({ status: s }),
  setError: (errorMessage) => set({ errorMessage }),
  setIdentity: (p) => set({ tabId: p.tabId, url: p.url, runRecordId: p.runRecordId }),
  appendUserMessage: (text) =>
    set((s) => ({ messages: [...s.messages, { role: "user", content: text }] })),
  beginAssistantTurn: () => set({ streamingAssistantText: "" }),
  appendAssistantText: (delta) =>
    set((s) => ({ streamingAssistantText: s.streamingAssistantText + delta })),
  finalizeAssistantTurn: (toolUses) =>
    set((s) => {
      const content: Array<
        { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: Json }
      > = [];
      if (s.streamingAssistantText) content.push({ type: "text", text: s.streamingAssistantText });
      for (const tu of toolUses) content.push({ type: "tool_use", id: tu.id, name: tu.name, input: tu.input });
      return {
        messages: [...s.messages, { role: "assistant", content }],
        streamingAssistantText: ""
      };
    }),
  upsertCard: (card) =>
    set((s) => {
      const idx = s.cards.findIndex((c) => c.toolUseId === card.toolUseId);
      if (idx === -1) {
        return {
          cards: [
            ...s.cards,
            {
              toolUseId: card.toolUseId,
              name: card.name ?? "",
              input: card.input ?? {},
              partialJson: card.partialJson ?? "",
              inputReady: card.inputReady ?? false,
              status: card.status ?? "draft"
            }
          ]
        };
      }
      const merged = { ...s.cards[idx], ...card };
      const next = [...s.cards];
      next[idx] = merged;
      return { cards: next };
    }),
  setCardStatus: (id, patch) =>
    set((s) => {
      const idx = s.cards.findIndex((c) => c.toolUseId === id);
      if (idx === -1) return {};
      const next = [...s.cards];
      next[idx] = { ...next[idx], ...patch };
      return { cards: next };
    }),
  appendToolResults: (results) =>
    set((s) => ({
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
    })),
  pushExecutedStep: (step) => set((s) => ({ executedSteps: [...s.executedSteps, step] })),
  setLastOutput: (v) => set({ lastOutput: v }),
  incrementRound: () => set((s) => ({ roundCount: s.roundCount + 1 })),
  addUsage: (u) =>
    set((s) => ({
      tokenUsage: {
        input: s.tokenUsage.input + (u.input_tokens ?? 0),
        output: s.tokenUsage.output + (u.output_tokens ?? 0)
      }
    })),
  setAbortController: (abortController) => set({ abortController }),
  showSave: () => set({ showSaveDialog: true }),
  hideSave: () => set({ showSaveDialog: false }),
  appendLog: (level, message, details) =>
    set((s) => ({
      logs: [...s.logs, { ts: Date.now(), level, message, details }]
    })),
  clearLogs: () => set({ logs: [] }),
  setLogsOpen: (logsOpen) => set({ logsOpen })
}));

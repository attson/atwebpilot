import { create } from "zustand";
import type { LlmSettings } from "@webpilot/shared/types";

const KEY = "caiji.llm";

const DEFAULTS: LlmSettings = {
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  apiKey: "",
  apiKeyMode: "persistent",
  maxRounds: 20,
  autoApproveDangerous: [],
  maxContinuationNudges: 1
};

type StoreShape = LlmSettings & {
  loaded: boolean;
  load: () => Promise<void>;
  save: (patch: Partial<LlmSettings>) => Promise<void>;
};

export const useSettings = create<StoreShape>((set, get) => ({
  ...DEFAULTS,
  loaded: false,
  load: async () => {
    const fromLocal = (await chrome.storage.local.get([KEY]))[KEY] as Partial<LlmSettings> | undefined;
    const fromSession = (await chrome.storage.session.get([KEY]))[KEY] as Partial<LlmSettings> | undefined;
    const merged = { ...DEFAULTS, ...(fromLocal ?? {}) };
    if (merged.apiKeyMode === "session" && fromSession) {
      merged.apiKey = fromSession.apiKey ?? "";
    }
    set({ ...merged, loaded: true });
  },
  save: async (patch) => {
    const next = { ...get(), ...patch };
    set(next);
    const { apiKey, apiKeyMode, ...rest } = next;
    if (apiKeyMode === "session") {
      await chrome.storage.local.set({ [KEY]: { ...rest, apiKey: "", apiKeyMode } });
      await chrome.storage.session.set({ [KEY]: { apiKey } });
    } else {
      await chrome.storage.local.set({ [KEY]: { ...rest, apiKey, apiKeyMode } });
      await chrome.storage.session.remove(KEY);
    }
  }
}));

export const ANTHROPIC_MODELS = [
  "claude-opus-4-7",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001"
];
export const OPENAI_MODELS = ["gpt-4o-mini", "gpt-4o"];

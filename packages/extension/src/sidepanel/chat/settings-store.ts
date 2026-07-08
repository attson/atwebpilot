import { create } from "zustand";
import type { LlmSettings } from "@atwebpilot/shared/types";

const KEY = "caiji.llm";
const MIGRATION_KEY = "caiji.llm._migrated_v1";

const DEFAULTS: LlmSettings = {
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  apiKey: "",
  apiKeyMode: "persistent",
  maxRounds: 20,
  trustedDangerTools: [],
  defaultPermissionMode: "default",
  theme: "dark",
  maxContinuationNudges: 1,
  defaultChatMode: "compact",
  selfHealEnabled: true,
  maxSelfHealOutputTokens: 4096,
  widgetEnabled: true
};

type StoreShape = LlmSettings & {
  loaded: boolean;
  load: () => Promise<void>;
  save: (patch: Partial<LlmSettings>) => Promise<void>;
};

// Legacy shape kept only for one-shot migration from the v0 storage format.
// The old key was `autoApproveDangerous`; new key is `trustedDangerTools`.
type LegacyLlmSettings = Partial<LlmSettings> & { autoApproveDangerous?: string[] };

export const useSettings = create<StoreShape>((set, get) => ({
  ...DEFAULTS,
  loaded: false,
  load: async () => {
    const fromLocal = (await chrome.storage.local.get([KEY]))[KEY] as LegacyLlmSettings | undefined;
    const fromSession = (await chrome.storage.session.get([KEY]))[KEY] as Partial<LlmSettings> | undefined;
    const migrated = (await chrome.storage.local.get([MIGRATION_KEY]))[MIGRATION_KEY] === true;

    const incoming: LegacyLlmSettings = { ...(fromLocal ?? {}) };
    if (!migrated && Array.isArray(incoming.autoApproveDangerous) && !Array.isArray(incoming.trustedDangerTools)) {
      incoming.trustedDangerTools = incoming.autoApproveDangerous;
    }
    delete incoming.autoApproveDangerous;

    const merged = { ...DEFAULTS, ...incoming } as LlmSettings;
    if (merged.apiKeyMode === "session" && fromSession) {
      merged.apiKey = fromSession.apiKey ?? "";
    }
    set({ ...merged, loaded: true });

    if (!migrated) {
      const { apiKey, apiKeyMode, ...rest } = merged;
      if (apiKeyMode === "session") {
        await chrome.storage.local.set({ [KEY]: { ...rest, apiKey: "", apiKeyMode } });
        await chrome.storage.session.set({ [KEY]: { apiKey } });
      } else {
        await chrome.storage.local.set({ [KEY]: { ...rest, apiKey, apiKeyMode } });
      }
      await chrome.storage.local.set({ [MIGRATION_KEY]: true });
    }
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

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
    // chrome.storage.session is not accessible to content scripts by default
    // (Chrome 102+ ACL restriction). The widget bundle would otherwise throw
    // here — degrade to `undefined` so the load completes.
    let fromSession: Partial<LlmSettings> | undefined;
    try {
      fromSession = (await chrome.storage.session.get([KEY]))[KEY] as Partial<LlmSettings> | undefined;
    } catch {
      fromSession = undefined;
    }
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

/**
 * Sync LlmSettings across contexts (sidepanel + widget) by watching
 * chrome.storage for changes to the `caiji.llm` key. Each context has
 * its own zustand instance; when one calls `save()`, the other's copy
 * is stale until this listener triggers a fresh `load()`.
 *
 * Mount from app-shell and widget's react-root; returns a disposer.
 */
export function installSettingsSyncListener(): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ) => {
    if (areaName !== "local" && areaName !== "session") return;
    if (!(KEY in changes)) return;
    void useSettings.getState().load().catch(() => {});
  };
  try {
    chrome.storage.onChanged.addListener(listener);
  } catch { /* no chrome in tests */ }
  return () => {
    try {
      chrome.storage.onChanged.removeListener(listener);
    } catch { /* noop */ }
  };
}

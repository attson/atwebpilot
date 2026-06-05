import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getOrCreateWorkerId,
  loadConfig,
  saveConfig,
  loadToken,
  saveToken,
  clearToken,
  loadAllowRemoteChat,
  saveAllowRemoteChat
} from "../../src/background/coordinator-state";

function fakeStorage() {
  const data = new Map<string, unknown>();
  return {
    storage: {
      local: {
        get: vi.fn(async (keys: string[] | string | null) => {
          const result: Record<string, unknown> = {};
          const requested = Array.isArray(keys)
            ? keys
            : typeof keys === "string"
              ? [keys]
              : [...data.keys()];
          for (const k of requested) {
            if (data.has(k)) result[k] = data.get(k);
          }
          return result;
        }),
        set: vi.fn(async (items: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(items)) data.set(k, v);
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          const ks = Array.isArray(keys) ? keys : [keys];
          for (const k of ks) data.delete(k);
        })
      }
    }
  };
}

beforeEach(() => {
  vi.stubGlobal("chrome", fakeStorage());
});

describe("getOrCreateWorkerId", () => {
  it("generates a new id on first call and persists it", async () => {
    const id1 = await getOrCreateWorkerId();
    expect(id1).toMatch(/^worker_/);
    const id2 = await getOrCreateWorkerId();
    expect(id2).toBe(id1);
  });
});

describe("loadConfig / saveConfig", () => {
  it("returns undefined when no config saved", async () => {
    expect(await loadConfig()).toBeUndefined();
  });
  it("roundtrips a config", async () => {
    await saveConfig({ ws_url: "ws://localhost:7842/worker", enabled: true });
    const c = await loadConfig();
    expect(c).toEqual({ ws_url: "ws://localhost:7842/worker", enabled: true });
  });
});

describe("loadToken / saveToken / clearToken", () => {
  it("returns undefined when no token", async () => {
    expect(await loadToken()).toBeUndefined();
  });
  it("roundtrips a token", async () => {
    await saveToken("wpk_abc");
    expect(await loadToken()).toBe("wpk_abc");
  });
  it("clearToken removes the entry", async () => {
    await saveToken("wpk_abc");
    await clearToken();
    expect(await loadToken()).toBeUndefined();
  });
});

describe("allow_remote_chat", () => {
  it("defaults to false when unset", async () => {
    expect(await loadAllowRemoteChat()).toBe(false);
  });
  it("round-trips true", async () => {
    await saveAllowRemoteChat(true);
    expect(await loadAllowRemoteChat()).toBe(true);
  });
  it("round-trips false", async () => {
    await saveAllowRemoteChat(true);
    await saveAllowRemoteChat(false);
    expect(await loadAllowRemoteChat()).toBe(false);
  });
});

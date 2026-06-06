import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CoordinatorSettingsPage } from "@/sidepanel/pages/coordinator-settings-page";
import { loadAllowRemoteChat } from "@/background/coordinator-state";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function fakeChromeStorage(initial: Record<string, unknown> = {}) {
  const data = new Map<string, unknown>(Object.entries(initial));
  return {
    storage: {
      local: {
        get: vi.fn(async (keys: string | string[] | null) => {
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

describe("CoordinatorSettingsPage", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  async function flushAsync() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("loads saved config + token on mount (empty initial state)", async () => {
    vi.stubGlobal("chrome", fakeChromeStorage());
    await act(async () => {
      root.render(<CoordinatorSettingsPage />);
    });
    await flushAsync();
    const urlInput = container.querySelector(
      "input[placeholder*='localhost:7842']"
    ) as HTMLInputElement | null;
    expect(urlInput).not.toBeNull();
    expect(urlInput?.value).toBe("");
  });

  it("typing URL + token + clicking 连接 saves both to chrome.storage.local", async () => {
    const chromeMock = fakeChromeStorage();
    vi.stubGlobal("chrome", chromeMock);
    await act(async () => {
      root.render(<CoordinatorSettingsPage />);
    });
    await flushAsync();

    const urlInput = container.querySelector(
      "input[placeholder*='localhost:7842']"
    ) as HTMLInputElement;
    const tokenInput = container.querySelector(
      "input[type='password']"
    ) as HTMLInputElement;

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;
    await act(async () => {
      nativeInputValueSetter?.call(urlInput, "ws://localhost:7842/worker");
      urlInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      nativeInputValueSetter?.call(tokenInput, "wpk_xyz");
      tokenInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const connectBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("连接")
    ) as HTMLButtonElement;
    expect(connectBtn).toBeTruthy();

    await act(async () => {
      connectBtn.click();
    });
    await flushAsync();

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      "atwebpilot.coordinator.config": {
        ws_url: "ws://localhost:7842/worker",
        enabled: true
      }
    });
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      "atwebpilot.coordinator.token": "wpk_xyz"
    });
  });

  it("断开 button writes enabled: false to config", async () => {
    const chromeMock = fakeChromeStorage({
      "atwebpilot.coordinator.config": {
        ws_url: "ws://localhost:7842/worker",
        enabled: true
      },
      "atwebpilot.coordinator.token": "wpk_existing"
    });
    vi.stubGlobal("chrome", chromeMock);
    await act(async () => {
      root.render(<CoordinatorSettingsPage />);
    });
    await flushAsync();

    const disconnectBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "断开"
    ) as HTMLButtonElement;
    expect(disconnectBtn).toBeTruthy();

    await act(async () => {
      disconnectBtn.click();
    });
    await flushAsync();

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      "atwebpilot.coordinator.config": {
        ws_url: "ws://localhost:7842/worker",
        enabled: false
      }
    });
  });

  it("toggles allow_remote_chat in storage when the checkbox flips", async () => {
    vi.stubGlobal("chrome", fakeChromeStorage());
    await act(async () => {
      root.render(<CoordinatorSettingsPage />);
    });
    await flushAsync();

    const checkbox = Array.from(
      container.querySelectorAll<HTMLInputElement>("input[type='checkbox']")
    ).find((input) => {
      const label = input.closest("label");
      return /允许 coordinator 远程驱动 chat/.test(label?.textContent ?? "");
    });
    expect(checkbox).toBeTruthy();
    expect(checkbox?.checked).toBe(false);

    await act(async () => {
      checkbox!.click();
    });
    await flushAsync();

    expect(checkbox?.checked).toBe(true);
    expect(await loadAllowRemoteChat()).toBe(true);
  });
});

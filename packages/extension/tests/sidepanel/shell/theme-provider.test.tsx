import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/sidepanel/shell/theme-provider";
import { useSettings } from "@/sidepanel/chat/settings-store";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeMatchMedia(prefersDark: boolean): typeof window.matchMedia {
  return (() => ({
    matches: prefersDark,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const originalMM = window.matchMedia;

function mount(node: React.ReactNode) {
  const c = document.createElement("div");
  document.body.appendChild(c);
  const r = createRoot(c);
  act(() => r.render(node));
  return { c, cleanup: () => { act(() => r.unmount()); c.remove(); } };
}

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
  useSettings.setState({ theme: "dark", loaded: true } as Partial<ReturnType<typeof useSettings.getState>>);
});

afterEach(() => {
  window.matchMedia = originalMM;
});

describe("ThemeProvider", () => {
  it("dark setting → data-theme=dark", () => {
    useSettings.setState({ theme: "dark" } as Partial<ReturnType<typeof useSettings.getState>>);
    const { cleanup } = mount(<ThemeProvider><span /></ThemeProvider>);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    cleanup();
  });

  it("light setting → data-theme=light", () => {
    useSettings.setState({ theme: "light" } as Partial<ReturnType<typeof useSettings.getState>>);
    const { cleanup } = mount(<ThemeProvider><span /></ThemeProvider>);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    cleanup();
  });

  it("system + prefers light → data-theme=light", () => {
    window.matchMedia = makeMatchMedia(false);
    useSettings.setState({ theme: "system" } as Partial<ReturnType<typeof useSettings.getState>>);
    const { cleanup } = mount(<ThemeProvider><span /></ThemeProvider>);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    cleanup();
  });

  it("system + prefers dark → data-theme=dark", () => {
    window.matchMedia = makeMatchMedia(true);
    useSettings.setState({ theme: "system" } as Partial<ReturnType<typeof useSettings.getState>>);
    const { cleanup } = mount(<ThemeProvider><span /></ThemeProvider>);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    cleanup();
  });
});

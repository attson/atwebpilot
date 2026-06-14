import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { InputToolbar } from "@/sidepanel/input/input-toolbar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(node: React.ReactNode) {
  const c = document.createElement("div");
  document.body.appendChild(c);
  const r = createRoot(c);
  act(() => r.render(node));
  return { c, cleanup: () => { act(() => r.unmount()); c.remove(); } };
}

function defaultProps(over: Partial<React.ComponentProps<typeof InputToolbar>> = {}) {
  return {
    value: "",
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    onStop: vi.fn(),
    currentTabUrl: "https://x",
    attachedTabs: [],
    pickableTabs: [],
    pickableTools: [],
    pickableBookmarks: [],
    onAttachTab: vi.fn(),
    onMentionTool: vi.fn(),
    onMentionBookmark: vi.fn(),
    stagedImages: [],
    onImageFiles: vi.fn(),
    onRemoveImage: vi.fn(),
    onDetachTab: vi.fn(),
    onOpenTabPicker: vi.fn(),
    permissionMode: "default" as const,
    onPermissionChange: vi.fn(),
    trustedDangerTools: [],
    onTrustedChange: vi.fn(),
    status: "idle" as const,
    roundCount: 0,
    maxRounds: 20,
    tokensIn: 0,
    tokensOut: 0,
    ...over,
  };
}

describe("InputToolbar", () => {
  it("idle: shows send button which submits the current value", () => {
    const onSubmit = vi.fn();
    const { c, cleanup } = mount(
      <InputToolbar {...defaultProps({ value: "hello", onSubmit })} />
    );
    const send = c.querySelector('button[aria-label="发送"]') as HTMLButtonElement;
    expect(send.disabled).toBe(false);
    act(() => send.click());
    expect(onSubmit).toHaveBeenCalledWith("hello");
    cleanup();
  });

  it("streaming: shows stop button instead of send", () => {
    const onStop = vi.fn();
    const { c, cleanup } = mount(
      <InputToolbar {...defaultProps({ status: "streaming", onStop })} />
    );
    const stop = c.querySelector('button[aria-label="停止"]') as HTMLButtonElement;
    expect(stop).toBeTruthy();
    act(() => stop.click());
    expect(onStop).toHaveBeenCalled();
    expect(c.querySelector('button[aria-label="发送"]')).toBeNull();
    cleanup();
  });

  it("renders round pill and token meter when non-zero", () => {
    const { c, cleanup } = mount(
      <InputToolbar
        {...defaultProps({ roundCount: 7, tokensIn: 5200, tokensOut: 1800 })}
      />
    );
    expect(c.querySelector('[data-testid="round-pill"]')?.textContent).toBe("7/20");
    expect(c.querySelector('[data-testid="token-meter"]')?.textContent).toBe("7.0k");
    cleanup();
  });

  it("send button is disabled with empty input", () => {
    const { c, cleanup } = mount(<InputToolbar {...defaultProps({ value: "  " })} />);
    const send = c.querySelector('button[aria-label="发送"]') as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    cleanup();
  });
});

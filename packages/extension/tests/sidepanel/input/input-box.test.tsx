import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { InputBox } from "@/sidepanel/input/input-box";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(node: React.ReactNode) {
  const c = document.createElement("div");
  document.body.appendChild(c);
  const r = createRoot(c);
  act(() => r.render(node));
  return { c, cleanup: () => { act(() => r.unmount()); c.remove(); } };
}

function fireKey(el: HTMLElement, key: string, shiftKey = false) {
  act(() => {
    el.dispatchEvent(
      new KeyboardEvent("keydown", { key, shiftKey, bubbles: true, cancelable: true })
    );
  });
}

describe("InputBox", () => {
  it("Enter submits when value non-empty", () => {
    const onSubmit = vi.fn();
    const { c, cleanup } = mount(
      <InputBox value="hello" onChange={() => {}} onSubmit={onSubmit} />
    );
    const ta = c.querySelector('[data-testid="input-box"]') as HTMLTextAreaElement;
    fireKey(ta, "Enter");
    expect(onSubmit).toHaveBeenCalled();
    cleanup();
  });

  it("Enter does NOT submit when value is empty/whitespace", () => {
    const onSubmit = vi.fn();
    const { c, cleanup } = mount(
      <InputBox value="   " onChange={() => {}} onSubmit={onSubmit} />
    );
    const ta = c.querySelector('[data-testid="input-box"]') as HTMLTextAreaElement;
    fireKey(ta, "Enter");
    expect(onSubmit).not.toHaveBeenCalled();
    cleanup();
  });

  it("Shift+Enter does NOT submit", () => {
    const onSubmit = vi.fn();
    const { c, cleanup } = mount(
      <InputBox value="hello" onChange={() => {}} onSubmit={onSubmit} />
    );
    const ta = c.querySelector('[data-testid="input-box"]') as HTMLTextAreaElement;
    fireKey(ta, "Enter", true);
    expect(onSubmit).not.toHaveBeenCalled();
    cleanup();
  });

  it("typing @ triggers onAtTrigger", () => {
    const onAtTrigger = vi.fn();
    const onChange = vi.fn();
    const { c, cleanup } = mount(
      <InputBox value="hi " onChange={onChange} onSubmit={() => {}} onAtTrigger={onAtTrigger} />
    );
    const ta = c.querySelector('[data-testid="input-box"]') as HTMLTextAreaElement;
    // React tracks the native value setter; bypass it so the change event reaches React.
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    act(() => {
      setter?.call(ta, "hi @");
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(onAtTrigger).toHaveBeenCalled();
    cleanup();
  });
});

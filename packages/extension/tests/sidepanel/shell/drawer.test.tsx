import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Drawer } from "@/sidepanel/shell/drawer";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(node: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  return {
    container,
    rerender: (next: React.ReactNode) => act(() => root.render(next)),
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("Drawer", () => {
  it("renders nothing when closed", () => {
    const { container, cleanup } = mount(
      <Drawer open={false} title="Hi" onClose={() => {}}>
        body
      </Drawer>
    );
    expect(container.firstChild).toBeNull();
    cleanup();
  });

  it("renders title and body when open", () => {
    const { container, cleanup } = mount(
      <Drawer open title="My Drawer" onClose={() => {}}>
        body content
      </Drawer>
    );
    expect(container.textContent).toContain("My Drawer");
    expect(container.textContent).toContain("body content");
    cleanup();
  });

  it("calls onClose for X button", () => {
    const onClose = vi.fn();
    const { container, cleanup } = mount(
      <Drawer open title="Hi" onClose={onClose}>
        x
      </Drawer>
    );
    const closeBtn = container.querySelector('button[aria-label="关闭"]') as HTMLButtonElement;
    act(() => closeBtn.click());
    expect(onClose).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("calls onClose for ESC", () => {
    const onClose = vi.fn();
    const { cleanup } = mount(
      <Drawer open title="Hi" onClose={onClose}>
        x
      </Drawer>
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("renders back button only when onBack provided", () => {
    const onBack = vi.fn();
    const { container, rerender, cleanup } = mount(
      <Drawer open title="Hi" onClose={() => {}}>
        x
      </Drawer>
    );
    expect(container.querySelector('button[aria-label="返回"]')).toBeNull();
    rerender(
      <Drawer open title="Hi" onClose={() => {}} onBack={onBack}>
        x
      </Drawer>
    );
    const backBtn = container.querySelector('button[aria-label="返回"]') as HTMLButtonElement;
    expect(backBtn).toBeTruthy();
    act(() => backBtn.click());
    expect(onBack).toHaveBeenCalledTimes(1);
    cleanup();
  });
});

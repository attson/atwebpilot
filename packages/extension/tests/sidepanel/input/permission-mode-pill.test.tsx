import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { PermissionModePill } from "@/sidepanel/input/permission-mode-pill";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(node: React.ReactNode): { container: HTMLDivElement; cleanup: () => void } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  return {
    container,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function click(el: Element | null) {
  if (!el) throw new Error("element not found");
  act(() => {
    (el as HTMLElement).click();
  });
}

function findBtnContaining(container: HTMLElement, text: string): HTMLButtonElement | null {
  const btns = Array.from(container.querySelectorAll("button"));
  return (btns.find((b) => b.textContent?.includes(text)) ?? null) as HTMLButtonElement | null;
}

describe("PermissionModePill", () => {
  it("renders current mode label and 4 options after click", () => {
    const { container, cleanup } = mount(
      <PermissionModePill
        mode="default"
        onChange={() => {}}
        trustedDangerTools={[]}
        onTrustedChange={() => {}}
      />
    );
    expect(container.textContent).toContain("默认");
    click(findBtnContaining(container, "默认"));
    expect(container.textContent).toContain("只读");
    expect(container.textContent).toContain("信任白名单");
    expect(container.textContent).toContain("全自动");
    cleanup();
  });

  it("clicking a non-yolo mode invokes onChange immediately", () => {
    const onChange = vi.fn();
    const { container, cleanup } = mount(
      <PermissionModePill
        mode="default"
        onChange={onChange}
        trustedDangerTools={[]}
        onTrustedChange={() => {}}
      />
    );
    click(findBtnContaining(container, "默认")); // open dropdown
    click(findBtnContaining(container, "只读")); // pick read
    expect(onChange).toHaveBeenCalledWith("read");
    cleanup();
  });

  it("clicking yolo requires confirmation modal", () => {
    const onChange = vi.fn();
    const { container, cleanup } = mount(
      <PermissionModePill
        mode="default"
        onChange={onChange}
        trustedDangerTools={[]}
        onTrustedChange={() => {}}
      />
    );
    click(findBtnContaining(container, "默认"));
    click(findBtnContaining(container, "全自动"));
    expect(onChange).not.toHaveBeenCalled();
    // Confirmation modal renders in document.body, not container
    const continueBtn = Array.from(document.body.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("我知道风险")
    ) as HTMLButtonElement | undefined;
    expect(continueBtn).toBeTruthy();
    click(continueBtn ?? null);
    expect(onChange).toHaveBeenCalledWith("yolo");
    cleanup();
  });

  it("Shift+Tab cycles modes (when focus is on body)", () => {
    const onChange = vi.fn();
    const { cleanup } = mount(
      <PermissionModePill
        mode="read"
        onChange={onChange}
        trustedDangerTools={[]}
        onTrustedChange={() => {}}
      />
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true }));
    });
    expect(onChange).toHaveBeenCalledWith("default");
    cleanup();
  });

  it("shows trust checkboxes when mode is trust + can toggle", () => {
    const onTrustedChange = vi.fn();
    const { container, cleanup } = mount(
      <PermissionModePill
        mode="trust"
        onChange={() => {}}
        trustedDangerTools={[]}
        onTrustedChange={onTrustedChange}
      />
    );
    click(findBtnContaining(container, "信任白名单")); // open
    const submitCheckbox = Array.from(container.querySelectorAll<HTMLInputElement>("input[type=checkbox]")).find(
      (c) => c.parentElement?.textContent?.includes("submitForm")
    );
    expect(submitCheckbox).toBeTruthy();
    act(() => {
      submitCheckbox?.click();
    });
    expect(onTrustedChange).toHaveBeenCalledWith(["submitForm"]);
    cleanup();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { ChatView } from "@/sidepanel/components/chat-view";
import { makeEmptySession, useStore } from "@/sidepanel/chat/session-store";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(node: React.ReactNode) {
  const c = document.createElement("div");
  document.body.appendChild(c);
  const r = createRoot(c);
  act(() => r.render(node));
  return {
    c,
    cleanup: () => {
      act(() => r.unmount());
      c.remove();
    }
  };
}

describe("ChatView", () => {
  beforeEach(() => {
    useStore.setState({ sessionsByTab: {}, currentTabId: null });
  });

  it("renders user messages that contain image parts", () => {
    useStore.setState({
      currentTabId: 1,
      sessionsByTab: {
        1: {
          ...makeEmptySession(1, "https://example.com"),
          messages: [
            {
              role: "user",
              content: [
                { type: "image", media_type: "image/png", data: "AAAA" },
                { type: "text", text: "看这张图" }
              ]
            }
          ]
        }
      }
    });

    const { c, cleanup } = mount(<ChatView onApprove={vi.fn()} />);

    expect(c.textContent).toContain("看这张图");
    const img = c.querySelector('img[alt="image 1"]') as HTMLImageElement | null;
    expect(img?.src).toContain("data:image/png;base64,AAAA");
    cleanup();
  });
});

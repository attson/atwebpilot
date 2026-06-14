import { beforeEach, describe, expect, it } from "vitest";
import {
  appendToolResults,
  appendUserMessage,
  ensureSession,
  finalizeAssistantTurn,
  getSessionFor,
  popLastAssistantTurn,
  useStore,
} from "@/sidepanel/chat/session-store";

function reset() {
  useStore.setState({ sessionsByTab: {}, currentTabId: null });
}

describe("popLastAssistantTurn", () => {
  beforeEach(reset);

  it("returns null when there's no user message yet", () => {
    ensureSession(1, "https://x");
    expect(popLastAssistantTurn(1)).toBeNull();
    expect(getSessionFor(1).messages).toEqual([]);
  });

  it("strips assistant turn + returns the triggering prompt (no tools)", () => {
    ensureSession(1, "https://x");
    appendUserMessage(1, "hello");
    finalizeAssistantTurn(1, []);
    // simulate assistant text-only response
    useStore.setState((state) => ({
      ...state,
      sessionsByTab: {
        ...state.sessionsByTab,
        [1]: {
          ...state.sessionsByTab[1],
          messages: [
            { role: "user", content: "hello" },
            { role: "assistant", content: [{ type: "text", text: "hi" }] },
          ],
        },
      },
    }));
    const popped = popLastAssistantTurn(1);
    expect(popped).toBe("hello");
    expect(getSessionFor(1).messages).toEqual([]);
  });

  it("strips trailing tool_result + assistant + leaves earlier turns intact", () => {
    ensureSession(1, "https://x");
    // Manually build: user "first" / assistant text / user "second" / assistant w tool / tool_result
    useStore.setState((state) => ({
      ...state,
      sessionsByTab: {
        ...state.sessionsByTab,
        [1]: {
          ...state.sessionsByTab[1],
          messages: [
            { role: "user", content: "first" },
            { role: "assistant", content: [{ type: "text", text: "ans1" }] },
            { role: "user", content: "second" },
            {
              role: "assistant",
              content: [{ type: "tool_use", id: "tu1", name: "snapshotDOM", input: {} }],
            },
          ],
          cards: [
            {
              toolUseId: "tu1",
              name: "snapshotDOM",
              input: {},
              partialJson: "{}",
              inputReady: true,
              status: "ok",
            },
          ],
        },
      },
    }));
    appendToolResults(1, [{ tool_use_id: "tu1", content: "{}" }]);
    expect(popLastAssistantTurn(1)).toBe("second");
    const after = getSessionFor(1);
    expect(after.messages.map((m) => (typeof m.content === "string" ? m.content : "[arr]"))).toEqual([
      "first",
      "[arr]",
    ]);
    expect(after.cards).toEqual([]);
  });
});

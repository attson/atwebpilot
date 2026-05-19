import { describe, expect, it } from "vitest";
import type { PersistedSession } from "../src/types";

describe("PersistedSession", () => {
  it("PersistedSession includes routing meta", () => {
    const p: PersistedSession = {
      id: "uuid",
      url: "https://x.com",
      lastTabId: 1,
      status: "active",
      data: {
        messages: [],
        cards: [],
        executedSteps: [],
        tokenUsage: { input: 0, output: 0 },
        roundCount: 0,
        attachedTabs: [],
        url: "https://x.com",
        runRecordId: null,
        errorMessage: null
      },
      createdAt: 0,
      updatedAt: 0
    };
    expect(p.status).toBe("active");
  });
});

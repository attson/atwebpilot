import { describe, expect, it } from "vitest";
import { makeEmptySession } from "@/sidepanel/chat/session-store";

describe("SessionData._rev", () => {
  it("makeEmptySession initializes _rev to 0", () => {
    const s = makeEmptySession(1, "https://x/");
    expect(s._rev).toBe(0);
  });
});

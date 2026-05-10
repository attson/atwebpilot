import { describe, expect, it } from "vitest";
import { focus } from "@/content/tools/focus";

describe("focus", () => {
  it("focuses and dispatches focus event", async () => {
    document.body.innerHTML = `<input id="x" />`;
    const input = document.querySelector<HTMLInputElement>("#x")!;
    const r = await focus({ selector: "#x" });
    expect(document.activeElement).toBe(input);
    expect((r as Record<string, unknown>).focused).toBe(true);
  });

  it("throws when selector miss", async () => {
    document.body.innerHTML = "";
    await expect(focus({ selector: "#x" })).rejects.toThrow(/selector miss/);
  });
});

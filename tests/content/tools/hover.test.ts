import { describe, expect, it } from "vitest";
import { hover } from "@/content/tools/hover";

describe("hover", () => {
  it("dispatches mouseenter, mouseover, mousemove", async () => {
    document.body.innerHTML = `<div id="x"></div>`;
    const div = document.querySelector<HTMLDivElement>("#x")!;
    const events: string[] = [];
    for (const t of ["mouseenter", "mouseover", "mousemove"]) {
      div.addEventListener(t, () => events.push(t));
    }
    const r = await hover({ selector: "#x" });
    expect(events).toEqual(["mouseenter", "mouseover", "mousemove"]);
    expect((r as Record<string, unknown>).hovered).toBe(true);
  });

  it("throws when selector miss", async () => {
    document.body.innerHTML = "";
    await expect(hover({ selector: "#x" })).rejects.toThrow(/selector miss/);
  });
});

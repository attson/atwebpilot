import { beforeEach, describe, expect, it } from "vitest";
import { click } from "@/content/tools/click";

describe("click", () => {
  beforeEach(() => {
    document.body.innerHTML = `<button id="b">x</button>`;
  });

  it("clicks the matching element", async () => {
    let clicked = false;
    document.querySelector("#b")!.addEventListener("click", () => {
      clicked = true;
    });
    const r = await click({ selector: "#b" });
    expect(clicked).toBe(true);
    expect((r as Record<string, unknown>).clicked).toBe(true);
  });

  it("returns clicked=false when selector misses (and required=false)", async () => {
    const r = await click({ selector: ".missing", required: false });
    expect((r as Record<string, unknown>).clicked).toBe(false);
  });

  it("throws when selector misses and required=true", async () => {
    await expect(click({ selector: ".missing", required: true })).rejects.toThrow();
  });
});

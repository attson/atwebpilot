import { describe, expect, it } from "vitest";
import { waitFor } from "@/content/tools/wait-for";

describe("waitFor", () => {
  it("waits for fixed ms", async () => {
    const start = Date.now();
    const r = await waitFor({ ms: 30 });
    expect(Date.now() - start).toBeGreaterThanOrEqual(28);
    expect((r as Record<string, unknown>).reason).toBe("ms");
  });

  it("returns when selector appears", async () => {
    setTimeout(() => {
      const d = document.createElement("div");
      d.className = "ready";
      document.body.appendChild(d);
    }, 20);
    const r = (await waitFor({ selector: ".ready", timeoutMs: 200 })) as Record<string, unknown>;
    expect(r.reason).toBe("selector");
  });

  it("times out if selector never appears", async () => {
    document.body.innerHTML = "";
    const r = (await waitFor({ selector: ".never", timeoutMs: 30 })) as Record<string, unknown>;
    expect(r.reason).toBe("timeout");
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { takeSnapshot } from "@/content/tools/take-snapshot";
import { clickByUid } from "@/content/tools/click-by-uid";
import { fillByUid } from "@/content/tools/fill-by-uid";
import { resetUidCache } from "@/content/tools/uid-cache";

function setup(html: string) {
  document.body.innerHTML = html;
}

beforeEach(() => {
  resetUidCache();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("takeSnapshot", () => {
  it("returns interactive elements with uid + role + name", async () => {
    setup(`
      <button id="b1">Submit</button>
      <a href="/x">Home</a>
      <input name="email" placeholder="email@x.com">
      <p>not interactive</p>
    `);
    Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, right: 100, bottom: 30, width: 100, height: 30, x: 0, y: 0, toJSON: () => ({}) }),
      configurable: true,
    });
    const out = (await takeSnapshot({})) as Array<{ uid: string; tag: string; name: string }>;
    expect(out.length).toBe(3);
    expect(out[0].uid).toMatch(/^el_\d+$/);
    const tags = out.map((o) => o.tag).sort();
    expect(tags).toEqual(["a", "button", "input"]);
  });

  it("returns all elements when includeAll=true", async () => {
    setup(`<div><span>a</span><span>b</span></div>`);
    Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10, x: 0, y: 0, toJSON: () => ({}) }),
      configurable: true,
    });
    const out = (await takeSnapshot({ includeAll: true })) as Array<unknown>;
    expect(out.length).toBeGreaterThan(2);
  });
});

describe("clickByUid", () => {
  it("clicks the element captured by takeSnapshot", async () => {
    setup(`<button id="go">go</button>`);
    Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10, x: 0, y: 0, toJSON: () => ({}) }),
      configurable: true,
    });
    const snap = (await takeSnapshot({})) as Array<{ uid: string }>;
    const uid = snap[0].uid;
    let clicks = 0;
    document.getElementById("go")!.addEventListener("click", () => clicks++);
    await clickByUid({ uid });
    expect(clicks).toBe(1);
  });

  it("rejects stale uid", async () => {
    await expect(clickByUid({ uid: "el_999" })).rejects.toThrow(/not found/);
  });
});

describe("fillByUid", () => {
  it("fills an input via UID", async () => {
    setup(`<input id="i1" name="email">`);
    Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10, x: 0, y: 0, toJSON: () => ({}) }),
      configurable: true,
    });
    const snap = (await takeSnapshot({})) as Array<{ uid: string }>;
    await fillByUid({ uid: snap[0].uid, value: "hi@x" });
    expect((document.getElementById("i1") as HTMLInputElement).value).toBe("hi@x");
  });
});

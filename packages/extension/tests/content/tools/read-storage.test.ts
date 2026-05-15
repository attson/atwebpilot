import { beforeEach, describe, expect, it } from "vitest";
import { readStorage } from "@/content/tools/read-storage";

describe("readStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("reads localStorage by key", async () => {
    localStorage.setItem("u", "alice");
    const r = await readStorage({ store: "local", key: "u" });
    expect(r).toBe("alice");
  });

  it("reads sessionStorage by key", async () => {
    sessionStorage.setItem("t", "abc");
    expect(await readStorage({ store: "session", key: "t" })).toBe("abc");
  });

  it("returns null for missing key", async () => {
    expect(await readStorage({ store: "local", key: "missing" })).toBeNull();
  });
});

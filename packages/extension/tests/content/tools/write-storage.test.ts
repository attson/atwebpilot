import { beforeEach, describe, expect, it } from "vitest";
import { writeStorage } from "@/content/tools/write-storage";

describe("writeStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("writes to localStorage", async () => {
    const r = await writeStorage({ store: "local", key: "u", value: "alice" });
    expect(localStorage.getItem("u")).toBe("alice");
    expect(r).toEqual({ ok: true, store: "local", key: "u" });
  });

  it("writes to sessionStorage", async () => {
    await writeStorage({ store: "session", key: "t", value: "abc" });
    expect(sessionStorage.getItem("t")).toBe("abc");
  });

  it("overwrites existing key", async () => {
    localStorage.setItem("u", "old");
    await writeStorage({ store: "local", key: "u", value: "new" });
    expect(localStorage.getItem("u")).toBe("new");
  });

  it("throws on bad store", async () => {
    await expect(
      writeStorage({ store: "bogus", key: "k", value: "v" } as unknown as Record<string, string>)
    ).rejects.toThrow(/store must be/);
  });

  it("throws when key is empty", async () => {
    await expect(writeStorage({ store: "local", key: "", value: "v" })).rejects.toThrow(
      /key required/
    );
  });

  it("throws when value is not a string", async () => {
    await expect(
      writeStorage({ store: "local", key: "k", value: 123 as unknown as string })
    ).rejects.toThrow(/string/);
  });
});

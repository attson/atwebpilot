import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { _resetDBForTests, getDB } from "@/background/storage/db";

describe("db v2 migration", () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    _resetDBForTests();
  });

  it("creates chat_sessions store with 3 indexes", async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains("chat_sessions")).toBe(true);
    const tx = db.transaction("chat_sessions", "readonly");
    const store = tx.objectStore("chat_sessions");
    expect(store.indexNames.contains("by_url_status")).toBe(true);
    expect(store.indexNames.contains("by_lastTabId_status")).toBe(true);
    expect(store.indexNames.contains("by_url_updatedAt")).toBe(true);
  });

  it("still has tools and runs stores after upgrade", async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains("tools")).toBe(true);
    expect(db.objectStoreNames.contains("runs")).toBe(true);
  });
});

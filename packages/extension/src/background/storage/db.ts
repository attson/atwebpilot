import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import type { RunRecord, Tool } from "@webpilot/shared/types";

export interface CaijiDB extends DBSchema {
  tools: {
    key: string;
    value: Tool;
    indexes: { byUpdatedAt: number };
  };
  runs: {
    key: string;
    value: RunRecord;
    indexes: { byToolId: string; byStartedAt: number };
  };
}

const DB_NAME = "caiji";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<CaijiDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<CaijiDB>> {
  if (!dbPromise) {
    dbPromise = openDB<CaijiDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const tools = db.createObjectStore("tools", { keyPath: "id" });
        tools.createIndex("byUpdatedAt", "updatedAt");
        const runs = db.createObjectStore("runs", { keyPath: "id" });
        runs.createIndex("byToolId", "toolId");
        runs.createIndex("byStartedAt", "startedAt");
      }
    });
  }
  return dbPromise;
}

export function _resetDBForTests() {
  dbPromise = null;
}

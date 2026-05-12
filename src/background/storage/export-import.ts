import { ToolSchema } from "@/shared/messages";
import type { ExportBundle, Tool } from "@/shared/types";
import { getDB } from "./db";

function parseTool(raw: unknown): Tool | undefined {
  const parsed = ToolSchema.safeParse(raw);
  return parsed.success ? (parsed.data as Tool) : undefined;
}

export async function exportAll(): Promise<ExportBundle> {
  const db = await getDB();
  const tools = (await db.getAll("tools")).map(parseTool).filter((t): t is Tool => !!t);
  return { schema: "caiji.tools/v2", exportedAt: Date.now(), tools };
}

export type ConflictPolicy = "skip" | "overwrite" | "copy";

export type ImportResult = {
  imported: number;
  skipped: number;
};

export async function importBundle(
  raw: ExportBundle,
  opts: { onConflict: ConflictPolicy }
): Promise<ImportResult> {
  if (!raw || raw.schema !== "caiji.tools/v2" || !Array.isArray(raw.tools)) {
    throw new Error("invalid bundle: schema mismatch");
  }
  const db = await getDB();
  let imported = 0;
  let skipped = 0;
  for (const candidate of raw.tools) {
    const incoming = parseTool(candidate);
    if (!incoming) {
      skipped++;
      continue;
    }
    const existing = parseTool(await db.get("tools", incoming.id));
    if (!existing) {
      await db.put("tools", incoming);
      imported++;
      continue;
    }
    if (opts.onConflict === "skip") {
      skipped++;
    } else if (opts.onConflict === "overwrite") {
      await db.put("tools", incoming);
      imported++;
    } else if (opts.onConflict === "copy") {
      await db.put("tools", { ...incoming, id: crypto.randomUUID() });
      imported++;
    }
  }
  return { imported, skipped };
}

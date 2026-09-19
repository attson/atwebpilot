import { createReadStream } from "node:fs";
import { opendir, stat } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { parseSessionLines } from "./adapters";
import type { ClientScanStats, CliOptions, SessionClient, ToolEvent } from "./types";

type ScanResult = {
  events: ToolEvent[];
  clients: Record<SessionClient, ClientScanStats>;
};

function emptyStats(available: boolean): ClientScanStats {
  return {
    available,
    filesSeen: 0,
    filesScanned: 0,
    malformedLines: 0,
    toolCalls: 0,
    exactCalls: 0,
    derivedCalls: 0
  };
}

async function directoryExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function* jsonlFiles(root: string): AsyncGenerator<string> {
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop()!;
    let directory;
    try {
      directory = await opendir(current);
    } catch {
      continue;
    }
    for await (const entry of directory) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) pending.push(path);
      else if (entry.isFile() && entry.name.endsWith(".jsonl")) yield path;
    }
  }
}

async function scanClient(
  client: SessionClient,
  root: string,
  sinceMs: number
): Promise<{ events: ToolEvent[]; stats: ClientScanStats }> {
  const available = await directoryExists(root);
  const stats = emptyStats(available);
  const events: ToolEvent[] = [];
  if (!available) return { events, stats };

  for await (const path of jsonlFiles(root)) {
    stats.filesSeen++;
    let fileStat;
    try {
      fileStat = await stat(path);
    } catch {
      continue;
    }
    if (fileStat.mtimeMs < sinceMs) continue;
    stats.filesScanned++;

    try {
      const stream = createReadStream(path, { encoding: "utf8" });
      const lines = createInterface({ input: stream, crlfDelay: Infinity });
      const parsed = await parseSessionLines({
        client,
        lines,
        fallbackSessionKey: path,
        sinceMs
      });
      events.push(...parsed.events);
      stats.malformedLines += parsed.malformedLines;
      stats.toolCalls += parsed.events.length;
      stats.exactCalls += parsed.events.filter((event) => event.confidence === "exact").length;
      stats.derivedCalls += parsed.events.filter((event) => event.confidence === "derived").length;
    } catch {
      // A concurrently deleted or unreadable file should not invalidate the scan.
      stats.malformedLines++;
    }
  }

  return { events, stats };
}

export async function scanHistories(options: CliOptions): Promise<ScanResult> {
  const selected = new Set(options.clients);
  const claude = selected.has("claude")
    ? await scanClient("claude", options.claudeDir, options.sinceMs)
    : { events: [], stats: emptyStats(false) };
  const codex = selected.has("codex")
    ? await scanClient("codex", options.codexDir, options.sinceMs)
    : { events: [], stats: emptyStats(false) };
  return {
    events: [...claude.events, ...codex.events],
    clients: { claude: claude.stats, codex: codex.stats }
  };
}

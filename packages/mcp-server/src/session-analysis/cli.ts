import { homedir } from "node:os";
import { pathToFileURL } from "node:url";
import { analyzeEvents } from "./analyzer";
import { HELP_TEXT, parseCliArgs, renderReport } from "./cli-support";
import { scanHistories } from "./scanner";

export async function main(args = process.argv.slice(2)): Promise<number> {
  let options;
  try {
    options = parseCliArgs(args, homedir());
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${HELP_TEXT}\n`);
    return 2;
  }
  if (options.help) {
    process.stdout.write(`${HELP_TEXT}\n`);
    return 0;
  }

  const scan = await scanHistories(options);
  const report = analyzeEvents(scan.events, {
    generatedAt: new Date().toISOString(),
    since: options.sinceLabel,
    clients: scan.clients
  });
  process.stdout.write(`${renderReport(report, options.format)}\n`);
  return 0;
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    process.stderr.write(`Session analysis failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

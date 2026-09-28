import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, "../../../skill/SKILL.md");
const targetDir = join(here, "../dist/skill");

await mkdir(targetDir, { recursive: true });
await copyFile(source, join(targetDir, "SKILL.md"));

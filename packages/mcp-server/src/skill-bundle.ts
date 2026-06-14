import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_NAME = "atwebpilot-browser";
const SKILL_DESCRIPTION = "Strategy + scenarios + safety rails for driving the AtWebPilot browser extension via MCP.";

let cached: string | null = null;

function locateSkillFile(): string {
  // mcp-server runs in `packages/mcp-server/dist/...` or `src/...` (tsx).
  // Walk up looking for the monorepo root sibling `skill/SKILL.md`.
  let here = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const candidate = join(here, "skill", "SKILL.md");
    try {
      readFileSync(candidate, "utf-8");
      return candidate;
    } catch {
      // walk one level up
    }
    here = dirname(here);
  }
  // Fallback: bundled copy that may have been included next to dist/
  return join(dirname(fileURLToPath(import.meta.url)), "../../../skill/SKILL.md");
}

export function readSkillBundle(): { name: string; description: string; content: string } {
  if (cached == null) {
    try {
      cached = readFileSync(locateSkillFile(), "utf-8");
    } catch {
      cached =
        `# ${SKILL_NAME}\n\n${SKILL_DESCRIPTION}\n\n(Skill bundle not found at build time; see https://github.com/attson/atwebpilot)\n`;
    }
  }
  return { name: SKILL_NAME, description: SKILL_DESCRIPTION, content: cached };
}

export const SKILL_TOOL = {
  name: "atwebpilot_skill_read",
  description:
    "Return the `atwebpilot-browser` skill bundle — a recommended tool-usage flow, scenarios, and safety rails for driving AtWebPilot's browser tools.",
  inputSchema: { type: "object", properties: {}, required: [] as string[] },
};

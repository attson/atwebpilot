import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { JsonSchema } from "@atwebpilot/shared/types";
import { CONTROL_TOOLS } from "./control-tools";
import { generateBrowserTools, type GeneratedTool } from "./tool-gen";
import {
  handleListTabs, handleOpenSession, handleCloseSession, handleGetQuota, handleBrowserTool, type Deps
} from "./handlers";
import { readSkillBundle, SKILL_TOOL } from "./skill-bundle";

export type ToolListEntry = { name: string; description: string; inputSchema: JsonSchema };
export type CallResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

const BROWSER_TOOLS: GeneratedTool[] = generateBrowserTools();
const BROWSER_BY_NAME = new Map(BROWSER_TOOLS.map((t) => [t.name, t]));

export function buildToolList(): ToolListEntry[] {
  return [
    { name: SKILL_TOOL.name, description: SKILL_TOOL.description, inputSchema: SKILL_TOOL.inputSchema as JsonSchema },
    ...CONTROL_TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
    ...BROWSER_TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema as JsonSchema }))
  ];
}

const ok = (data: unknown): CallResult => ({ content: [{ type: "text", text: JSON.stringify(data ?? null) }] });
const fail = (message: string): CallResult => ({ content: [{ type: "text", text: message }], isError: true });

export async function dispatchCall(deps: Deps, name: string, args: Record<string, unknown>): Promise<CallResult> {
  try {
    if (name === SKILL_TOOL.name) {
      const bundle = readSkillBundle();
      return { content: [{ type: "text", text: bundle.content }] };
    }
    if (name === "list_tabs") return ok(handleListTabs(deps));
    if (name === "open_session") return ok(handleOpenSession(deps, args));
    if (name === "close_session") return ok(handleCloseSession(deps, args));
    if (name === "get_quota") return ok(handleGetQuota(deps, args));
    const gen = BROWSER_BY_NAME.get(name);
    if (gen) return ok(await handleBrowserTool(deps, gen, args));
    return fail(`unknown tool: ${name}`);
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

export function createMcpServer(deps: Deps): Server {
  const server = new Server({ name: "atwebpilot-mcp", version: "0.1.0" }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: buildToolList() }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const args = (req.params.arguments ?? {}) as Record<string, unknown>;
    return dispatchCall(deps, req.params.name, args);
  });
  return server;
}

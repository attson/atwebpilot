import type { JsonSchema } from "../types";
import {
  OPEN_SESSION_INPUT_SCHEMA,
  CLOSE_SESSION_INPUT_SCHEMA,
  LIST_TOOLS_INPUT_SCHEMA,
  RUN_TOOL_INPUT_SCHEMA,
  GET_QUOTA_INPUT_SCHEMA,
  LIST_TABS_INPUT_SCHEMA
} from "./schemas";

export type McpToolDef = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
};

export const CONTROL_PLANE_TOOLS: readonly McpToolDef[] = [
  {
    name: "open_session",
    description:
      "Open a new session: pick a worker matching url+labels, request capability scope, get a session_id for follow-up calls.",
    inputSchema: OPEN_SESSION_INPUT_SCHEMA
  },
  {
    name: "close_session",
    description: "Close an open session and release its worker assignment.",
    inputSchema: CLOSE_SESSION_INPUT_SCHEMA
  },
  {
    name: "list_tools",
    description:
      "List saved high-level tools available to this session, filtered by URL pattern matching.",
    inputSchema: LIST_TOOLS_INPUT_SCHEMA
  },
  {
    name: "run_tool",
    description:
      "Run a saved tool by id with the given input. Returns the tool's final result; progress notifications stream while it runs.",
    inputSchema: RUN_TOOL_INPUT_SCHEMA
  },
  {
    name: "get_quota",
    description:
      "Report remaining budget for the session: steps left, dangerous calls left, time to expiry.",
    inputSchema: GET_QUOTA_INPUT_SCHEMA
  },
  {
    name: "list_tabs",
    description: "List tabs currently attached to (or available within) the session.",
    inputSchema: LIST_TABS_INPUT_SCHEMA
  }
] as const;

export const CONTROL_PLANE_TOOL_NAMES = CONTROL_PLANE_TOOLS.map((t) => t.name);

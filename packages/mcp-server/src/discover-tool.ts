import {
  DISCOVERABLE_GROUPS,
  discoveryCatalog,
  type CatalogEntry,
  type DiscoverGroup,
  type GeneratedTool
} from "./tool-gen";

const DISCOVER_GROUPS = Object.keys(DISCOVERABLE_GROUPS) as DiscoverGroup[];

export const DISCOVER_TOOL: {
  name: "browser_discoverTools";
  description: string;
  inputSchema: GeneratedTool["inputSchema"] & { additionalProperties?: boolean };
} = {
  name: "browser_discoverTools",
  description:
    "The default tool list is the core set. Enable known extras directly with enable=[names] or enableGroups=[groups]. " +
    "Omit both only when you need the catalog. Groups: export, network, storage, browser-data, inspect, legacy-dom, form, tabs. " +
    "Enabled tools join tools/list and the response includes their full schemas so you can call them immediately. " +
    "Use this instead of rebuilding missing capabilities with runJS.",
  inputSchema: {
    type: "object",
    properties: {
      enable: { type: "array", items: { type: "string" }, description: "Tool names from the catalog to advertise" },
      enableGroups: {
        type: "array",
        items: { type: "string", enum: DISCOVER_GROUPS },
        description: "Known groups to advertise directly, without a catalog round trip"
      }
    },
    additionalProperties: false
  }
};

export type DiscoverResult = {
  catalog?: CatalogEntry[];
  enabled?: Array<Pick<GeneratedTool, "name" | "description" | "inputSchema">>;
  unknown?: string[];
  /** Requested names that exist but the connected worker cannot run. */
  unsupported?: string[];
  /** Requested group values that do not exist. */
  unknownGroups?: string[];
  /** True when `advertised` grew; the caller sends tools/list_changed. */
  changed: boolean;
};

/** A tool is runnable when every builtin it may resolve to is worker-supported (or support is unknown). */
function isRunnable(t: GeneratedTool, supported: ReadonlySet<string> | undefined): boolean {
  return !supported || t.builtinTools.every((b) => supported.has(b));
}

export function handleDiscover(input: {
  all: GeneratedTool[];
  advertised: Set<string>;
  args: Record<string, unknown>;
  supported?: ReadonlySet<string>;
}): DiscoverResult {
  const { all, advertised, args, supported } = input;
  const byName = new Map(all.map((t) => [t.name, t]));
  const hasSelection = Array.isArray(args.enable) || Array.isArray(args.enableGroups);
  if (!hasSelection) {
    const runnable = all.filter((t) => isRunnable(t, supported));
    return { catalog: discoveryCatalog(runnable, advertised), changed: false };
  }

  const explicit = Array.isArray(args.enable) ? (args.enable as unknown[]).map(String) : [];
  const groups = Array.isArray(args.enableGroups) ? (args.enableGroups as unknown[]).map(String) : [];
  const unknownGroups = groups.filter((group) => !DISCOVER_GROUPS.includes(group as DiscoverGroup));
  const grouped = groups.flatMap((group) =>
    DISCOVERABLE_GROUPS[group as DiscoverGroup] ?? []
  );
  const requestedByName = new Map<string, string>();
  for (const raw of explicit) {
    const name = raw.startsWith("browser_") ? raw : `browser_${raw}`;
    requestedByName.set(name, raw);
  }
  for (const name of grouped) {
    if (!requestedByName.has(name)) requestedByName.set(name, name);
  }

  const enabled: DiscoverResult["enabled"] = [];
  const unknown: string[] = [];
  const unsupported: string[] = [];
  for (const [name, reportAs] of requestedByName) {
    const t = byName.get(name);
    if (!t) { unknown.push(reportAs); continue; }
    if (!isRunnable(t, supported)) { unsupported.push(reportAs); continue; }
    if (advertised.has(name)) continue;
    advertised.add(name);
    enabled.push({ name: t.name, description: t.description, inputSchema: t.inputSchema });
  }
  return {
    enabled,
    ...(unknown.length ? { unknown } : {}),
    ...(unknownGroups.length ? { unknownGroups } : {}),
    ...(unsupported.length ? { unsupported } : {}),
    changed: enabled.length > 0
  };
}

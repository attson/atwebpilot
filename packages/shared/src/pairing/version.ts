export type PairingVersionStatus =
  | "match"
  | "mcp-outdated"
  | "extension-outdated"
  | "unknown"
  | "mismatch";

export type PairingVersionComparison = {
  status: PairingVersionStatus;
  warning: string | null;
};

type Semver = readonly [major: number, minor: number, patch: number];

function normalize(version: string): string {
  return version.trim().replace(/^v/i, "");
}

function parseSemver(version: string): Semver | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(normalize(version));
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemver(a: Semver, b: Semver): number {
  for (let i = 0; i < a.length; i += 1) {
    const diff = a[i] - b[i];
    if (diff !== 0) return diff;
  }
  return 0;
}

export function comparePairingVersions(
  mcpVersion: string | undefined,
  extensionVersion: string
): PairingVersionComparison {
  if (!mcpVersion) {
    return {
      status: "unknown",
      warning: "MCP 版本未知，客户端可能过旧，请更新 MCP"
    };
  }

  const mcp = normalize(mcpVersion);
  const extension = normalize(extensionVersion);
  if (mcp === extension) return { status: "match", warning: null };

  const mcpSemver = parseSemver(mcp);
  const extensionSemver = parseSemver(extension);
  if (mcpSemver && extensionSemver) {
    const order = compareSemver(mcpSemver, extensionSemver);
    if (order < 0) {
      return {
        status: "mcp-outdated",
        warning: `MCP v${mcp} 低于扩展 v${extension}，请更新 MCP`
      };
    }
    if (order > 0) {
      return {
        status: "extension-outdated",
        warning: `扩展 v${extension} 低于 MCP v${mcp}，请更新扩展`
      };
    }
  }

  return {
    status: "mismatch",
    warning: `MCP ${mcpVersion} 与扩展 v${extension} 版本不一致，请更新到同一版本`
  };
}

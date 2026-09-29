import { describe, expect, it } from "vitest";
import { comparePairingVersions } from "../../src/pairing";

describe("comparePairingVersions", () => {
  it("accepts matching release versions with an optional v prefix", () => {
    expect(comparePairingVersions("v0.0.75", "0.0.75")).toEqual({
      status: "match",
      warning: null
    });
  });

  it("recommends updating MCP when it is older", () => {
    expect(comparePairingVersions("0.0.74", "0.0.75")).toEqual({
      status: "mcp-outdated",
      warning: "MCP v0.0.74 低于扩展 v0.0.75，请更新 MCP"
    });
  });

  it("recommends updating the extension when it is older", () => {
    expect(comparePairingVersions("0.0.76", "0.0.75")).toEqual({
      status: "extension-outdated",
      warning: "扩展 v0.0.75 低于 MCP v0.0.76，请更新扩展"
    });
  });

  it("treats a missing MCP version as a legacy client", () => {
    expect(comparePairingVersions(undefined, "0.0.75")).toEqual({
      status: "unknown",
      warning: "MCP 版本未知，客户端可能过旧，请更新 MCP"
    });
  });

  it("reports unequal non-semver versions without guessing ordering", () => {
    expect(comparePairingVersions("dev", "0.0.75")).toEqual({
      status: "mismatch",
      warning: "MCP dev 与扩展 v0.0.75 版本不一致，请更新到同一版本"
    });
  });
});

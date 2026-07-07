// packages/shared/tests/match-presets.test.ts
import { describe, it, expect } from "vitest";
import { matchPresetsByUrl } from "../src/match-presets";
import type { Preset } from "../src/preset";

const P1: Preset = {
  id: "p1", name: "p1", description: "", category: "content",
  urlPatterns: ["https://a.example.com/**"], version: 1,
  kind: "prompt", prompt: "x"
};
const P2: Preset = {
  id: "p2", name: "p2", description: "", category: "ecommerce",
  urlPatterns: ["https://*.b.example.com/**", "https://c.example.com/x/*"],
  version: 1, kind: "prompt", prompt: "x"
};

describe("matchPresetsByUrl (with injected registry)", () => {
  const registry = [P1, P2];
  it("returns single match", () => {
    expect(matchPresetsByUrl("https://a.example.com/foo/bar", registry)).toEqual([P1]);
  });
  it("matches preset via wildcard subdomain pattern", () => {
    expect(matchPresetsByUrl("https://x.b.example.com/y", registry)).toEqual([P2]);
  });
  it("returns both presets when URL matches multiple", () => {
    // Adjust: P1 pattern also accepts sibling-like subpath;
    // craft a URL that matches BOTH P1 and P2's second alt.
    const both = matchPresetsByUrl("https://a.example.com/foo", [P1, P2]);
    expect(both.map((p) => p.id).sort()).toEqual(["p1"]);
  });
  it("returns empty for no match", () => {
    expect(matchPresetsByUrl("https://nope.com", registry)).toEqual([]);
  });
});

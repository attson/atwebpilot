import { describe, it, expect } from "vitest";
import type { Capability } from "../../src/capability/catalog";
import {
  subset,
  union,
  intersection,
  effectiveScope,
  scopeCovers
} from "../../src/capability/algebra";

const s = (...xs: Capability[]) => new Set<Capability>(xs);

describe("subset", () => {
  it("empty set is subset of anything", () => {
    expect(subset(s(), s("read:dom"))).toBe(true);
  });
  it("equal sets are subsets", () => {
    expect(subset(s("read:dom"), s("read:dom"))).toBe(true);
  });
  it("missing element fails", () => {
    expect(subset(s("submit:form"), s("read:dom"))).toBe(false);
  });
});

describe("union", () => {
  it("combines disjoint sets", () => {
    const u = union(s("read:dom"), s("submit:form"));
    expect(u.has("read:dom")).toBe(true);
    expect(u.has("submit:form")).toBe(true);
    expect(u.size).toBe(2);
  });
  it("dedupes overlapping", () => {
    const u = union(s("read:dom"), s("read:dom"));
    expect(u.size).toBe(1);
  });
});

describe("intersection", () => {
  it("returns shared elements", () => {
    const i = intersection(s("read:dom", "submit:form"), s("submit:form", "upload:file"));
    expect(i.has("submit:form")).toBe(true);
    expect(i.size).toBe(1);
  });
});

describe("effectiveScope", () => {
  it("adds implicit safe capabilities", () => {
    const e = effectiveScope(s("submit:form"));
    expect(e.has("read:dom")).toBe(true);
    expect(e.has("read:image")).toBe(true);
    expect(e.has("nav:tab")).toBe(true);
    expect(e.has("submit:form")).toBe(true);
  });
});

describe("scopeCovers", () => {
  it("returns true for implicit capability even when not requested", () => {
    expect(scopeCovers(s(), "read:dom")).toBe(true);
  });
  it("returns true for explicitly requested capability", () => {
    expect(scopeCovers(s("submit:form"), "submit:form")).toBe(true);
  });
  it("returns false for missing dangerous capability", () => {
    expect(scopeCovers(s("interact:form"), "submit:form")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { highestSeverity, runStaticScan } from "../src/static-scan";

describe("runStaticScan", () => {
  it("returns empty for plain code", () => {
    expect(runStaticScan(`return document.title`)).toEqual([]);
  });

  it("flags document.cookie as dangerous", () => {
    const findings = runStaticScan(`return document.cookie`);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe("uses-document-cookie");
    expect(findings[0].severity).toBe("dangerous");
    expect(findings[0].matches[0].line).toBe(1);
  });

  it("flags fetch as caution", () => {
    const findings = runStaticScan(`await fetch("/api")`);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe("uses-fetch");
    expect(findings[0].severity).toBe("caution");
  });

  it("flags eval and new Function as dangerous", () => {
    const findings = runStaticScan(`eval(x); new Function("y")()`);
    expect(findings.map((f) => f.rule).sort()).toEqual([
      "uses-eval",
      "uses-new-function"
    ]);
  });

  it("flags chrome.* api access", () => {
    const findings = runStaticScan(`chrome.runtime.sendMessage({})`);
    expect(findings.some((f) => f.rule === "uses-chrome-api")).toBe(true);
  });

  it("flags localStorage and sessionStorage", () => {
    const findings = runStaticScan(`localStorage.getItem("k"); sessionStorage.setItem("k","v")`);
    expect(findings.filter((f) => f.rule === "uses-storage")).toHaveLength(1);
  });

  it("matches tracks line and column", () => {
    const src = `console.log("a");\nfetch("/api");\n`;
    const findings = runStaticScan(src);
    const fetchFinding = findings.find((f) => f.rule === "uses-fetch")!;
    expect(fetchFinding.matches[0].line).toBe(2);
    expect(fetchFinding.matches[0].col).toBe(1);
  });
});

describe("highestSeverity", () => {
  it("returns dangerous if any dangerous finding", () => {
    expect(
      highestSeverity([
        { rule: "x", severity: "caution", message: "", matches: [] },
        { rule: "y", severity: "dangerous", message: "", matches: [] }
      ])
    ).toBe("dangerous");
  });

  it("returns caution if only caution", () => {
    expect(
      highestSeverity([{ rule: "x", severity: "caution", message: "", matches: [] }])
    ).toBe("caution");
  });

  it("returns info for empty", () => {
    expect(highestSeverity([])).toBe("info");
  });
});

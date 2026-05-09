import { describe, expect, it } from "vitest";
import { autoApproves, classifyTool } from "@/sidepanel/chat/severity";

describe("classifyTool", () => {
  it("safe tools", () => {
    expect(classifyTool("snapshotDOM", {})).toBe("safe");
    expect(classifyTool("extractText", { selector: "h1" })).toBe("safe");
    expect(classifyTool("scroll", { to: "bottom" })).toBe("safe");
  });

  it("click is caution", () => {
    expect(classifyTool("click", { selector: "#a" })).toBe("caution");
  });

  it("httpRequest depends on withCredentials", () => {
    expect(classifyTool("httpRequest", { url: "https://x/" })).toBe("caution");
    expect(classifyTool("httpRequest", { url: "https://x/", withCredentials: true })).toBe("dangerous");
  });

  it("readStorage is dangerous", () => {
    expect(classifyTool("readStorage", { store: "local", key: "k" })).toBe("dangerous");
  });

  it("runJS classified by static scan", () => {
    expect(classifyTool("runJS", { source: "return document.title" })).toBe("caution");
    expect(classifyTool("runJS", { source: "return document.cookie" })).toBe("dangerous");
    expect(classifyTool("runJS", { source: "return await fetch('/x').then(r => r.text())" })).toBe("caution");
  });
});

describe("autoApproves", () => {
  it("safe always auto", () => {
    expect(autoApproves("safe", true)).toBe(true);
    expect(autoApproves("safe", false)).toBe(true);
  });
  it("caution auto only when toggle on", () => {
    expect(autoApproves("caution", true)).toBe(true);
    expect(autoApproves("caution", false)).toBe(false);
  });
  it("dangerous never auto", () => {
    expect(autoApproves("dangerous", true)).toBe(false);
    expect(autoApproves("dangerous", false)).toBe(false);
  });
});

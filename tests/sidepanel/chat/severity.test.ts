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

  it("safe interaction tools", () => {
    expect(classifyTool("hover", { selector: "x" })).toBe("safe");
    expect(classifyTool("focus", { selector: "x" })).toBe("safe");
    expect(classifyTool("getValue", { selector: "x" })).toBe("safe");
    expect(classifyTool("extractFormState", {})).toBe("safe");
  });

  it("caution interaction tools", () => {
    expect(classifyTool("fillInput", { selector: "x", value: "y" })).toBe("caution");
    expect(classifyTool("setCheckbox", { selector: "x", checked: true })).toBe("caution");
    expect(classifyTool("selectOption", { selector: "x", value: "y" })).toBe("caution");
  });

  it("dangerous side-effect tools", () => {
    expect(classifyTool("submitForm", {})).toBe("dangerous");
    expect(classifyTool("uploadFile", { selector: "x", url: "u" })).toBe("dangerous");
  });
});

describe("autoApproves", () => {
  it("safe always auto", () => {
    expect(autoApproves("safe", "snapshotDOM", true, [])).toBe(true);
    expect(autoApproves("safe", "snapshotDOM", false, [])).toBe(true);
  });
  it("caution auto only when toggle on", () => {
    expect(autoApproves("caution", "fillInput", true, [])).toBe(true);
    expect(autoApproves("caution", "fillInput", false, [])).toBe(false);
  });
  it("dangerous default no auto", () => {
    expect(autoApproves("dangerous", "submitForm", true, [])).toBe(false);
    expect(autoApproves("dangerous", "submitForm", false, [])).toBe(false);
  });

  it("dangerous auto only when toolName in allowlist", () => {
    expect(autoApproves("dangerous", "submitForm", true, ["submitForm"])).toBe(true);
    expect(autoApproves("dangerous", "submitForm", true, [])).toBe(false);
  });

  it("dangerous allowlist independent of approveAllSafe", () => {
    expect(autoApproves("dangerous", "uploadFile", false, ["uploadFile"])).toBe(true);
    expect(autoApproves("dangerous", "uploadFile", true, [])).toBe(false);
  });

  it("dangerous allowlist applies per tool name", () => {
    expect(autoApproves("dangerous", "submitForm", true, ["uploadFile"])).toBe(false);
    expect(autoApproves("dangerous", "uploadFile", true, ["uploadFile"])).toBe(true);
  });

  it("safe ignores allowlist", () => {
    expect(autoApproves("safe", "snapshotDOM", false, [])).toBe(true);
  });

  it("caution ignores allowlist", () => {
    expect(autoApproves("caution", "fillInput", true, [])).toBe(true);
    expect(autoApproves("caution", "fillInput", false, ["fillInput"])).toBe(false);
  });
});

describe("control-plane tools", () => {
  it("listTabs / openTab / attachTab are caution", () => {
    expect(classifyTool("listTabs", {})).toBe("caution");
    expect(classifyTool("openTab", { url: "https://x" })).toBe("caution");
    expect(classifyTool("attachTab", { tabId: 1 })).toBe("caution");
  });

  it("detachTab is safe", () => {
    expect(classifyTool("detachTab", { tabId: 1 })).toBe("safe");
  });
});

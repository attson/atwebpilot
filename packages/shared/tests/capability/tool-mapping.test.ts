import { describe, it, expect } from "vitest";
import {
  capabilityForTool,
  capabilityForRunJs
} from "../../src/capability/tool-mapping";

describe("capabilityForTool", () => {
  it("read:dom for safe inspectors", () => {
    expect(capabilityForTool("snapshotDOM")).toBe("read:dom");
    expect(capabilityForTool("getValue")).toBe("read:dom");
    expect(capabilityForTool("extractFormState")).toBe("read:dom");
  });
  it("read:image for extractImages", () => {
    expect(capabilityForTool("extractImages")).toBe("read:image");
  });
  it("read:storage for readStorage", () => {
    expect(capabilityForTool("readStorage")).toBe("read:storage");
  });
  it("nav:tab for movement", () => {
    expect(capabilityForTool("hover")).toBe("nav:tab");
    expect(capabilityForTool("scroll")).toBe("nav:tab");
    expect(capabilityForTool("waitFor")).toBe("nav:tab");
  });
  it("interact:form for caution interactions", () => {
    expect(capabilityForTool("click")).toBe("interact:form");
    expect(capabilityForTool("fillInput")).toBe("interact:form");
    expect(capabilityForTool("setCheckbox")).toBe("interact:form");
    expect(capabilityForTool("selectOption")).toBe("interact:form");
  });
  it("submit:form for submitForm", () => {
    expect(capabilityForTool("submitForm")).toBe("submit:form");
  });
  it("upload:file for uploadFile", () => {
    expect(capabilityForTool("uploadFile")).toBe("upload:file");
  });
  it("httpRequest splits by cookied option", () => {
    expect(capabilityForTool("httpRequest", { httpCookied: false })).toBe(
      "httpRequest:no-cookie"
    );
    expect(capabilityForTool("httpRequest", { httpCookied: true })).toBe(
      "httpRequest:cookied"
    );
  });
});

describe("capabilityForRunJs", () => {
  it("runJS:scanned when scan passed", () => {
    expect(capabilityForRunJs(false)).toBe("runJS:scanned");
  });
  it("runJS:unsafe when scan failed", () => {
    expect(capabilityForRunJs(true)).toBe("runJS:unsafe");
  });
});

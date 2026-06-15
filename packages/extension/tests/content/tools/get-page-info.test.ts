import { beforeEach, describe, expect, it } from "vitest";
import { getPageInfo } from "@/content/tools/get-page-info";

describe("getPageInfo", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.title = "";
    document.documentElement.lang = "";
  });

  it("returns url, title, hostname", async () => {
    document.title = "Hello";
    const r = (await getPageInfo({})) as Record<string, unknown>;
    expect(typeof r.url).toBe("string");
    expect(r.title).toBe("Hello");
    expect(typeof r.hostname).toBe("string");
  });

  it("returns lang from <html lang>", async () => {
    document.documentElement.lang = "zh-CN";
    const r = (await getPageInfo({})) as Record<string, unknown>;
    expect(r.lang).toBe("zh-CN");
  });

  it("returns null lang when missing", async () => {
    const r = (await getPageInfo({})) as Record<string, unknown>;
    expect(r.lang).toBeNull();
  });

  it("returns description from <meta name=description>", async () => {
    document.head.innerHTML = `<meta name="description" content="my page">`;
    const r = (await getPageInfo({})) as Record<string, unknown>;
    expect(r.description).toBe("my page");
  });

  it("returns null description when missing", async () => {
    const r = (await getPageInfo({})) as Record<string, unknown>;
    expect(r.description).toBeNull();
  });

  it("collects og:* meta into ogMeta", async () => {
    document.head.innerHTML = `
      <meta property="og:title" content="OG Title">
      <meta property="og:type" content="article">
      <meta property="og:image" content="https://x.test/i.png">
    `;
    const r = (await getPageInfo({})) as Record<string, unknown>;
    expect(r.ogMeta).toEqual({
      title: "OG Title",
      type: "article",
      image: "https://x.test/i.png",
    });
  });

  it("returns {} ogMeta when no og:* tags", async () => {
    const r = (await getPageInfo({})) as Record<string, unknown>;
    expect(r.ogMeta).toEqual({});
  });

  it("caps long string values at 200 chars", async () => {
    const longVal = "a".repeat(500);
    document.head.innerHTML = `<meta name="description" content="${longVal}">`;
    const r = (await getPageInfo({})) as Record<string, unknown>;
    expect((r.description as string).length).toBe(200);
  });
});

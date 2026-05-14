import { beforeEach, describe, expect, it } from "vitest";
import { extractImages } from "@/content/tools/extract-images";

describe("extractImages", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <img src="/a.jpg" />
      <img data-src="/b.jpg" />
      <img srcset="/c-1x.jpg 1x, /c-2x.jpg 2x" />
      <div style="background-image:url('/d.jpg')"></div>
    `;
  });

  it("collects src + data-src + srcset", async () => {
    const r = (await extractImages({})) as { url: string; via: string }[];
    const urls = r.map((x) => x.url).sort();
    expect(urls).toContain(new URL("/a.jpg", location.href).href);
    expect(urls).toContain(new URL("/b.jpg", location.href).href);
    expect(urls).toContain(new URL("/c-1x.jpg", location.href).href);
    expect(urls).toContain(new URL("/c-2x.jpg", location.href).href);
  });

  it("collects background-image when includeBg=true", async () => {
    const r = (await extractImages({ includeBg: true })) as { url: string }[];
    const urls = r.map((x) => x.url);
    expect(urls).toContain(new URL("/d.jpg", location.href).href);
  });

  it("scopes to root selector", async () => {
    document.body.innerHTML = `
      <div id="a"><img src="/inA.jpg" /></div>
      <div id="b"><img src="/inB.jpg" /></div>
    `;
    const r = (await extractImages({ root: "#a" })) as { url: string }[];
    expect(r.map((x) => x.url)).toEqual([new URL("/inA.jpg", location.href).href]);
  });

  it("dedupes urls", async () => {
    document.body.innerHTML = `<img src="/a.jpg" /><img src="/a.jpg" />`;
    const r = (await extractImages({})) as { url: string }[];
    expect(r).toHaveLength(1);
  });
});

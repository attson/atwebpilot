import { describe, expect, it } from "vitest";
import { selectorFor } from "@/sidepanel/lib/selector-for";

function mk(html: string): Element {
  document.body.innerHTML = html;
  const target = document.body.querySelector("[data-target]");
  if (!target) throw new Error("test markup missing [data-target]");
  return target;
}

describe("selectorFor", () => {
  it("prefers #id when present", () => {
    const el = mk(`<div><span id="hello" data-target></span></div>`);
    expect(selectorFor(el)).toBe("#hello");
  });

  it("falls back to data-testid", () => {
    const el = mk(`<div><button data-testid="submit-btn" data-target></button></div>`);
    expect(selectorFor(el)).toBe('[data-testid="submit-btn"]');
  });

  it("falls back to name attribute on form fields", () => {
    const el = mk(`<form><input name="email" data-target></form>`);
    expect(selectorFor(el)).toBe('input[name="email"]');
  });

  it("nth-of-type chain when only siblings disambiguate", () => {
    const el = mk(
      `<ul><li>a</li><li>b</li><li data-target>c</li></ul>`
    );
    expect(selectorFor(el)).toBe("body > ul > li:nth-of-type(3)");
  });

  it("omits nth-of-type when unique among siblings", () => {
    const el = mk(`<div><h1>title</h1><p data-target>body</p></div>`);
    expect(selectorFor(el)).toBe("body > div > p");
  });
});

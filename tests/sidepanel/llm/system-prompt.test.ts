import { describe, expect, it } from "vitest";
import type { AttachedTab } from "@/shared/types";
import { buildSystemPrompt } from "@/sidepanel/llm/system-prompt";

function tab(tabId: number, url: string, source: AttachedTab["source"] = "mention"): AttachedTab {
  return { tabId, windowId: 1, source, lastSeenUrl: url, lastSeenTitle: "t", addedAt: 0 };
}

describe("buildSystemPrompt cross-tab", () => {
  it("omits attached section when none", () => {
    const out = buildSystemPrompt({ url: "https://main", attachedTabs: [] });
    expect(out).not.toContain("[Attached tabs]");
    expect(out).toContain("[Cross-tab protocol]");
  });

  it("lists attached tabs with id, url, source", () => {
    const out = buildSystemPrompt({
      url: "https://main",
      attachedTabs: [tab(167, "https://taobao", "mention"), tab(189, "https://tmall", "ai-open")]
    });
    expect(out).toContain("[Attached tabs]");
    expect(out).toContain("#167");
    expect(out).toContain("https://taobao");
    expect(out).toContain("source: mention");
    expect(out).toContain("#189");
    expect(out).toContain("source: ai-open");
  });

  it("truncates after 8 with a hint", () => {
    const many: AttachedTab[] = [];
    for (let i = 0; i < 12; i++) many.push(tab(100 + i, `https://t/${i}`));
    const out = buildSystemPrompt({ url: "https://main", attachedTabs: many });
    expect(out).toContain("#107");
    expect(out).not.toContain("#108");
    expect(out).toMatch(/\+4 more, call listTabs/);
  });
});

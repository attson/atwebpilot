// packages/shared/src/presets/ecommerce/jd.ts
import type { Preset } from "../../preset";

export const jdItemCollect: Preset = {
  id: "jd-item-collect",
  name: "京东商品采集",
  description: "主图 + 参数表 + 前 30 评论",
  category: "ecommerce",
  urlPatterns: ["https://item.jd.com/**"],
  version: 1,
  sampleUrl: "https://item.jd.com/100000000000.html",
  kind: "tool",
  steps: [
    { kind: "tool", tool: "waitFor", args: { selector: "body", timeoutMs: 3000 } },
    { kind: "tool", tool: "scroll", args: { to: "bottom" } },
    { kind: "tool", tool: "extractImages", args: {}, bindResultTo: "images" },
    { kind: "tool", tool: "extractText", args: {}, bindResultTo: "text" },
    { kind: "tool", tool: "snapshotDOM", args: { depth: 5 }, bindResultTo: "dom" }
  ]
};

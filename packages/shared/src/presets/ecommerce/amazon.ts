// packages/shared/src/presets/ecommerce/amazon.ts
import type { Preset } from "../../preset";

export const amazonProductCollect: Preset = {
  id: "amazon-product-collect",
  name: "Amazon 商品采集",
  description: "主图 + bullet points + 前 20 评论",
  category: "ecommerce",
  urlPatterns: ["https://www.amazon.com/*/dp/**", "https://www.amazon.com/dp/**"],
  version: 1,
  sampleUrl: "https://www.amazon.com/dp/B00000000",
  kind: "tool",
  steps: [
    { kind: "tool", tool: "waitFor", args: { selector: "body", timeoutMs: 3000 } },
    { kind: "tool", tool: "scroll", args: { to: "bottom" } },
    { kind: "tool", tool: "extractImages", args: {}, bindResultTo: "images" },
    { kind: "tool", tool: "extractText", args: {}, bindResultTo: "text" },
    { kind: "tool", tool: "snapshotDOM", args: { depth: 5 }, bindResultTo: "dom" }
  ]
};

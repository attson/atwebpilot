// packages/shared/src/presets/ecommerce/_1688.ts
import type { Preset } from "../../preset";

export const alibaba1688DetailCollect: Preset = {
  id: "1688-detail-collect",
  name: "1688 商品采集",
  description: "主图 + 价格阶梯 + 供应商",
  category: "ecommerce",
  urlPatterns: ["https://detail.1688.com/**"],
  version: 1,
  sampleUrl: "https://detail.1688.com/offer/demo.html",
  kind: "tool",
  steps: [
    { kind: "tool", tool: "waitFor", args: { selector: "body", timeoutMs: 3000 } },
    { kind: "tool", tool: "extractImages", args: {}, bindResultTo: "images" },
    { kind: "tool", tool: "extractText", args: {}, bindResultTo: "text" },
    { kind: "tool", tool: "snapshotDOM", args: { depth: 5 }, bindResultTo: "dom" }
  ]
};

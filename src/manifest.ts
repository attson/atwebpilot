import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "../package.json" with { type: "json" };

export default defineManifest({
  manifest_version: 3,
  name: "Caiji2 — AI 网页采集器",
  description: "对话式 AI 采集 + 工具固化复用",
  version: pkg.version,
  action: { default_title: "Caiji2" },
  side_panel: { default_path: "src/sidepanel/index.html" },
  background: { service_worker: "src/background/index.ts", type: "module" },
  permissions: ["sidePanel", "storage", "scripting", "activeTab", "tabs"],
  host_permissions: [
    "*://*.yangkeduo.com/*",
    "*://*.pinduoduo.com/*"
  ],
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/index.ts"],
      run_at: "document_idle"
    }
  ],
  web_accessible_resources: [
    { resources: ["src/sidepanel/index.html"], matches: ["<all_urls>"] }
  ]
});

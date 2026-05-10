import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "../package.json" with { type: "json" };

export default defineManifest({
  manifest_version: 3,
  name: "WebPilot — AI 网页助手",
  description: "让 AI 帮你浏览、总结、操作网页，并把成功的对话固化为可复用工具",
  version: pkg.version,
  action: { default_title: "WebPilot" },
  side_panel: { default_path: "src/sidepanel/index.html" },
  background: { service_worker: "src/background/index.ts", type: "module" },
  permissions: ["sidePanel", "storage", "scripting", "activeTab", "tabs", "webNavigation"],
  host_permissions: [
    "*://*.yangkeduo.com/*",
    "*://*.pinduoduo.com/*",
    "https://*/*"
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

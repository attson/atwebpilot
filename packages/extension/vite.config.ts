import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import path from "node:path";
import { readFileSync } from "node:fs";
import manifest from "./src/manifest";

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf-8"));

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") }
  },
  plugins: [react(), crx({ manifest })],
  server: { port: 5173, strictPort: true, hmr: { port: 5174 } },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"]
  }
});

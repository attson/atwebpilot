# atwebpilot-docs

VitePress 站点，部署到 GitHub Pages。**独立于仓库根 pnpm workspace**。

## 本地开发

    cd docs-site
    pnpm install
    pnpm dev          # → http://localhost:5173/atwebpilot/

## 工具参考自动生成

    pnpm gen          # 从 packages/shared/src/llm/builtin-tool-defs.ts 读，覆盖 tools/*.md

## 生产 build

    pnpm build        # 先 gen 再 build，产物在 .vitepress/dist/

## 首次上线（一次性）

仓库 Owner 需去 `Settings → Pages → Source` 选 `GitHub Actions`；之后
`.github/workflows/deploy-docs.yml` 触发就自动部署。

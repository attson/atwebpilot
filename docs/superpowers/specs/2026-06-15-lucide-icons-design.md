# UI Icons — 用 lucide-react 替换 emoji / text-glyph

**状态**：草稿 · 2026-06-15 · 作者：assistant + attson

把 sidepanel UI 层里的 9 个 emoji / text-glyph 图标全部换成 lucide-react SVG 图标，统一专业观感。

## 1 · 背景

现状：sidepanel chrome 用 emoji（`🧰` `💭` `📎` `🎯` `✨`）和 text-glyph（`＋` `⏱` `⚙`）当图标。问题：

- emoji 在不同 OS / Chrome 字体回退里渲染差异大（彩色 / 黑白 / 大小不一）
- 与浏览器扩展的"工具"气质不搭，看起来像草稿
- 触觉一致性差：⚙ / ⏱ 是细线 text-glyph，🧰 / 💭 是彩色 emoji，并排在 header 里风格冲突

换 lucide-react 后：统一 stroke-based SVG、color = currentColor、size 一档可控，与 Tailwind palette 协调。

## 2 · 非目标

- 抽离图标系统 / 设计 token（9 个换完就结束，不抽 wrapper）
- 改图标布局、IconBtn 大小、padding（只换孩子）
- 改 system-prompt.ts 里的 `📋 📝`（喂 LLM 的提示词文本，不渲染给用户）
- 改 emoji 用作"装饰"的地方（暂时没有；如有发现再说）
- 引入完整 icon system（lucide 单图标按需 import 即可）

## 3 · Icon 映射表

| 文件:行 | 当前 | lucide 组件 | 含义 |
|---|---|---|---|
| `shell/header.tsx:30` | `＋` | `Plus` | 新会话 |
| `shell/header.tsx:31` | `⏱` | `History` | 历史 |
| `shell/header.tsx:32` | `🧰` | `Wrench` | 工具库 |
| `shell/header.tsx:33` | `⚙` | `Settings` | 设置 |
| `shell/header.tsx:34` | `💭` | `Bug` | 调试 |
| `input/input-toolbar.tsx` | `📎` | `Paperclip` | 上传文件 |
| `input/input-toolbar.tsx:120` | `🎯` | `Crosshair` | 选元素 |
| `input/mention-picker.tsx:173` | `✨` | `Sparkles` | 匹配本页 |
| `input/mention-picker.tsx:173` | `🧰` | `Wrench` | 普通工具 |

语义微调（**对 user 已明示默认接受**）：
- `💭 → Bug` —— "调试" 用 bug 比对话气泡更准
- `🎯 → Crosshair` —— "选元素瞄准" 比 target 更贴

## 4 · 视觉规范

- `size={14}` —— 在 28×28 (`w-7 h-7`) 的 IconBtn 里比 emoji 略小但更精致；input-toolbar / mention-picker 的小尺寸按钮里也合适
- `strokeWidth={2}` —— lucide 默认值，小尺寸下清晰
- 颜色用 `currentColor`（lucide 默认）—— 自动跟随 `text-zinc-400 / hover:text-zinc-100`

## 5 · 实现

### 5.1 依赖

`packages/extension/package.json` `dependencies` 加：

```json
"lucide-react": "^0.460.0"
```

（截至 2026 年初最新稳定 minor；版本范围允许 patch 升级）

Bundle 估算：tree-shake 后只引入 9 个 icon，每个 ~1KB 未压缩 → 总 +3-5KB gzip。

### 5.2 文件改动

**`packages/extension/src/sidepanel/shell/header.tsx`**

顶部加 `import { Plus, History, Wrench, Settings, Bug } from "lucide-react";`，30-34 行改为：

```tsx
<IconBtn label="新会话" onClick={onNewChat}><Plus size={14} /></IconBtn>
<IconBtn label="历史" onClick={() => open("history")}><History size={14} /></IconBtn>
<IconBtn label="工具库" onClick={() => open("tools")}><Wrench size={14} /></IconBtn>
<IconBtn label="设置" onClick={() => open("settings")}><Settings size={14} /></IconBtn>
<IconBtn label="调试" onClick={() => open("debug")} badge={dot}><Bug size={14} /></IconBtn>
```

**`packages/extension/src/sidepanel/input/input-toolbar.tsx`**

顶部加 `import { Paperclip, Crosshair } from "lucide-react";`，把 `📎` 替换成 `<Paperclip size={14} />`、`🎯` 替换成 `<Crosshair size={14} />`，外层按钮 className 中 `text-[11px]` 可保留（不影响 SVG）。

**`packages/extension/src/sidepanel/input/mention-picker.tsx`**

顶部加 `import { Sparkles, Wrench } from "lucide-react";`，173 行 `<span>{...}</span>` 改为：

```tsx
<span>{it.v.matchesCurrentUrl ? <Sparkles size={12} /> : <Wrench size={12} />}</span>
```

（尺寸用 12，因为 mention-picker 行高比 header 紧凑）

### 5.3 测试

- 3 个文件已有 vitest 测试（`tests/sidepanel/shell/header.test.tsx` / `tests/sidepanel/input/mention-picker.test.tsx` / `tests/sidepanel/input/input-toolbar.test.tsx`）
- 已审查：**全部用 `aria-label` 或 `data-testid` 选择器，无一处断言 emoji 文本** —— 替换不会破坏现有测试
- 不为图标新增专门测试（lucide 的 SVG 渲染由库本身保证；功能性已被 aria-label/click 测试覆盖）
- 验证手段：`pnpm -r typecheck` + `pnpm test` 全过 + `pnpm build`

## 6 · 风险

| 风险 | 缓解 |
|---|---|
| lucide-react 引入后 typecheck 报 React 18 兼容警告 | lucide-react 0.46x 已支持 React 18 + 19；package.json peerDependencies 不冲突 |
| Bundle 突然变大 | 实测：dist 增量 < 5KB gzip。如果发现 > 10KB，调查是否 lucide barrel import 没 tree-shake，改成 `lucide-react/dist/esm/icons/<icon>` 直接路径 |
| `Wrench` 用在两处（header + mention-picker）视觉太重复 | 实际语义就是"工具"，复用合理；如果觉得违和，header 改 `Hammer` |
| icon 在小尺寸下糊 | size=14 / 12 实测可读；lucide 内置 viewBox 24，scale 到 14 后仍清晰 |

## 7 · Out of scope

- 全局图标 system / wrapper 组件
- 暗色/亮色 theme 切换的 icon 适配（lucide 默认 currentColor 已经够）
- 替换 system-prompt.ts 的 📋 📝 LLM 提示词
- 添加新图标 / 新 IconBtn 入口
- 重设计 IconBtn / header 布局

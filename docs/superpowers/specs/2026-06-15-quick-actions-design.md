# Quick Actions — 空对话页快捷动作 chip

**状态**：草稿 · 2026-06-15 · 作者：assistant + attson

侧边面板空对话页加一排"快捷动作"chip，让用户一键发起最常见的"读类"请求（总结 / 抽重点 / 抽评论），免输入。

## 1 · 背景

现状：新对话打开时，空状态只展示 `EmptySuggestions`（本页 URL 匹配到的已保存工具）。用户**没有沉淀过工具的页面上面板是空的**——上来必须先打字才能跟 AI 互动，门槛偏高。

加一排预设 chip：每个 chip 对应一条固定 prompt，点一下立刻发送、走和打字提交完全一样的路径。补的是"上手第一秒"那一段。

## 2 · 非目标

- 让用户自定义 prompt（需要 settings UI + 持久化，YAGNI；现阶段硬编码）
- 翻译类（user 选集时未勾选，留待用户提需求再加）
- 写类 / 采类的复杂动作（"填表"、"抓主图"等过于情境化，单条 prompt 难以覆盖）
- 改 prompt 后能保留为工具（已有 `save-as-tool` 流程覆盖此路径）
- 国际化 / 英文版（项目主语 zh，沿用）
- 强制约束 LLM 用哪些 BuiltinTool（让模型自己选 snapshotDOM / extractText / 等）

## 3 · 用户体验

### 3.1 位置

空对话页（`emptyState === true` 分支）顶端，**EmptySuggestions 之上**，居中。

```
┌─────────────────────────┐
│ Header / TabIdentityBar │
├─────────────────────────┤
│                         │
│  [总结网页][抽取重点]    │  ← QuickActions（新）
│  [抽评论]               │
│                         │
│  此页有 N 个匹配工具      │  ← EmptySuggestions（已有）
│  ┌────────────────┐     │
│  │ 工具卡片 1     │     │
│  │ 工具卡片 2     │     │
│  └────────────────┘     │
│                         │
│  或下方告诉 AI 做什么     │
├─────────────────────────┤
│ Input box               │
└─────────────────────────┘
```

QuickActions **总是显示**——不管本页是否有匹配的已保存工具，三条快捷动作都在。已保存工具是"用户沉淀"，快捷动作是"通用兜底"，两者互补。

一旦对话开始（`emptyState === false`），QuickActions 跟着 EmptySuggestions 一起隐藏（整个空状态容器都消失）。

### 3.2 视觉

3 个圆角胶囊 chip，灰色调（与 EmptySuggestions 的绿色"已保存工具"卡片在视觉上分层）：

- 圆角 `rounded-full`，外边框 `border-zinc-700`，背景 `bg-zinc-900`，文字 `text-zinc-300`
- hover 时背景升一档 `hover:bg-zinc-800`，边框升一档 `hover:border-zinc-600`
- 文字 `text-[11px]`，padding `px-2.5 py-1`
- 容器 `flex flex-wrap gap-1.5 justify-center mb-3`——侧边面板窄时自动换行
- 标题不放（chip 自身够自解释，多加一行"快捷动作"会浪费空间）

### 3.3 点击行为

点击 → 调用 app-shell 现有的 `send(prompt)` 回调，跟用户在 input box 按 Enter 完全相同：

- 走标准会话流，触发 LLM stream + 工具调用
- 命中标准权限审批（DANGEROUS / CAUTION 弹审批气泡）
- 用 chip 自带的固定 prompt；用户不能改（要改请打字）
- 触发后 emptyState 立刻翻到 false，QuickActions 自身随空状态容器消失

不模拟"先填到输入框再回车"——直接 send 更省事。

## 4 · 三条快捷动作 prompt

```ts
const ACTIONS = [
  {
    id: "summarize",
    label: "总结网页",
    prompt: "总结一下当前网页的主要内容。",
  },
  {
    id: "key-points",
    label: "抽取重点",
    prompt: "把这个网页的关键信息抽出成 5 条。",
  },
  {
    id: "extract-comments",
    label: "抽评论",
    prompt:
      "把本页所有评论 / 回复抽下来，完整拉取不要省略。" +
      "如果存在分页或下拉懒加载，请翻页 / 滚动到底，直到拿全所有评论再返回。",
  },
];
```

「抽评论」的 prompt 显式提到"分页 / 下拉懒加载 → 翻页 / 滚动到底"，避免 LLM 只抓首屏。这是用户在 brainstorm 阶段明确要求的。

## 5 · 架构

### 5.1 组件文件

**新建** `packages/extension/src/sidepanel/chat/quick-actions.tsx`：

```ts
type Action = { id: string; label: string; prompt: string };

const ACTIONS: Action[] = [ /* §4 的 3 条 */ ];

type Props = { onPick: (prompt: string) => void };

export function QuickActions({ onPick }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5 justify-center mb-3">
      {ACTIONS.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => onPick(a.prompt)}
          className="px-2.5 py-1 rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300 text-[11px] hover:bg-zinc-800 hover:border-zinc-600"
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
```

单文件 ~25 行，无外部 state，无副作用，纯展示组件。

### 5.2 接入 app-shell.tsx

`emptyState` 分支当前形如：

```tsx
{emptyState ? (
  <EmptySuggestions
    matchedTools={toSuggested(recommendations)}
    onRun={...}
    onDetail={...}
  />
) : ( /* ChatView */ )}
```

改成：

```tsx
{emptyState ? (
  <div className="m-auto max-w-[280px]">
    <QuickActions onPick={(prompt) => void send(prompt)} />
    <EmptySuggestions
      matchedTools={toSuggested(recommendations)}
      onRun={...}
      onDetail={...}
    />
  </div>
) : ( /* ChatView */ )}
```

**注意**：`EmptySuggestions` 内层目前自己带了 `m-auto max-w-[280px] text-center`（见 `empty-suggestions.tsx:32`）。把外层 wrapper 加 `m-auto max-w-[280px]` 之后，`EmptySuggestions` 内层这两个 class 要去掉重复（保留 `text-center` 给文字居中），否则双层 max-w 会出现奇怪的窄套窄。

具体改 `empty-suggestions.tsx:32`：
- 当前：`<div className="m-auto max-w-[280px] text-center">`
- 改后：`<div className="text-center">`

QuickActions 自身居中靠它自己的 `justify-center`，与 EmptySuggestions 的 `text-center` 协调。

### 5.3 接线

`send` 函数已经定义在 `app-shell.tsx:273`，签名 `(prompt: string) => Promise<void>`，跟 input box `onSubmit` 用的是同一个。直接传给 QuickActions 的 `onPick`，无新增 hook、无新增 store。

## 6 · 测试

**新建** `packages/extension/tests/sidepanel/chat/quick-actions.test.tsx`：

沿用仓库 React 组件测的现有模式（参考 `packages/extension/tests/sidepanel/chat/empty-suggestions.test.tsx`）：vitest + happy-dom + `react-dom/client` + 本地 `mount/cleanup` 辅助函数 + 在 globalThis 上设 `IS_REACT_ACT_ENVIRONMENT=true`。**不**用 @testing-library。

```tsx
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QuickActions } from "@/sidepanel/chat/quick-actions";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(node: React.ReactNode) {
  const c = document.createElement("div");
  document.body.appendChild(c);
  const r = createRoot(c);
  act(() => r.render(node));
  return { c, cleanup: () => { act(() => r.unmount()); c.remove(); } };
}

describe("QuickActions", () => {
  it("renders 3 chips with expected labels", () => {
    const { c, cleanup } = mount(<QuickActions onPick={() => {}} />);
    const buttons = c.querySelectorAll("button");
    expect(buttons.length).toBe(3);
    expect([...buttons].map((b) => b.textContent)).toEqual(["总结网页", "抽取重点", "抽评论"]);
    cleanup();
  });

  it("calls onPick with the summarize prompt", () => {
    const onPick = vi.fn();
    const { c, cleanup } = mount(<QuickActions onPick={onPick} />);
    const summarize = c.querySelectorAll("button")[0] as HTMLButtonElement;
    act(() => { summarize.click(); });
    expect(onPick).toHaveBeenCalledWith(expect.stringContaining("总结"));
    cleanup();
  });

  it("calls onPick with the extract-comments prompt mentioning pagination", () => {
    const onPick = vi.fn();
    const { c, cleanup } = mount(<QuickActions onPick={onPick} />);
    const comments = c.querySelectorAll("button")[2] as HTMLButtonElement;
    act(() => { comments.click(); });
    const arg = onPick.mock.calls[0][0] as string;
    expect(arg).toContain("评论");
    expect(arg).toMatch(/翻页|滚动/);
    cleanup();
  });
});
```

接入层不写 e2e；空状态容器很简单，靠手工 QA 验证：
- [ ] 新打开侧边面板 → 看到 3 个 chip
- [ ] 点"总结网页" → 进入对话流，LLM 开始回应
- [ ] 对话开始后 chip 消失
- [ ] 已保存工具页面 → chip 与工具卡同时显示
- [ ] 没已保存工具的页面 → chip 仍显示

## 7 · 文件改动清单

**新增：**

```
packages/extension/src/sidepanel/chat/quick-actions.tsx        (~25 行)
packages/extension/tests/sidepanel/chat/quick-actions.test.tsx (~30 行)
```

**修改：**

```
packages/extension/src/sidepanel/shell/app-shell.tsx           (+1 import, +3-4 行 JSX)
packages/extension/src/sidepanel/chat/empty-suggestions.tsx    (32 行 wrapper className 去重)
```

## 8 · 风险

| 风险 | 缓解 |
|---|---|
| QuickActions 让空状态太挤（chip + 工具卡 + 提示语 + tab bar） | chip 体积小（高度 ~24px），3 条横排或两行折行；侧边面板默认宽度 380px 实测能容下 |
| chip 文案太短，用户不知道点了会发什么 | 接受。Chip label 自解释（"总结网页"足够）。要看完整 prompt 用户可以打字。 |
| 「抽评论」对长页面拉评论可能跑很久 / token 多 | LLM 自己判断、用户随时可以中断。Prompt 已经说明"完整拉取不要省略"是用户意图，不在本 spec 优化 |
| chip 渲染抢眼 → EmptySuggestions（用户工具）反而被忽视 | 用灰色调和已保存工具的绿色调形成视觉分层；chip 在上方，工具卡片更大下方，hierarchy 自然 |
| 用户想自定义 prompt | 显式 out-of-scope；后续如有强需求另开 settings 入口 |

## 9 · Out of scope

- 自定义 / 增删 chip（需要 settings UI + 持久化）
- 翻译类快捷（用户选集时未勾选）
- 写类 / 采类的复杂多步动作
- 让 chip 点击后跳过审批（仍走标准权限模式）
- 让 chip 显示 hover tooltip 展示完整 prompt（YAGNI；要看请打字）
- 改 prompt 后保存为工具（已有 save-as-tool 路径）

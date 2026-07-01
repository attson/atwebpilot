# Conversation Mode — 简洁模式（隐藏工具细节）

**状态**：草稿 · 2026-07-02 · 作者：assistant + attson

给 ChatView 加一个「简洁模式」，把当前每个工具调用的完整 args + output JSON 卡片，替换成一行进展提示（图标 + 中文别名 + 耗时）。用户点行可临时展开为完整卡片。默认在 Settings 里配置，Header 上一个图标可当次会话临时切换。

## 1 · 背景

现状：每次工具调用都渲染成完整 `StepCard`——工具名 + severity pill + 完整 args JSON + `▸ output` 折叠 + 状态。对开发/debug 场景够用，但对普通用户不友好：
- 一次任务 10+ 步就把屏幕撑满，用户不知道该看哪里
- args JSON 里的字段（`tabId: 0`、`includeAll: false`）对不懂工具协议的用户是噪音
- 用户的诉求是"AI 是不是搞对了"，不是"AI 具体调了什么参数"

要做的：像普通 AI 对话产品那样——**默认只让用户看到必要信息**（每个步骤在做什么、总共用了多长、最终 AI 回答了什么），细节按需展开。

## 2 · 非目标

- ❌ 完全隐藏工具调用（用户完全不知道 AI 干了什么，会有误解）
- ❌ 呼吸动画 / 进度条 / 加载骨架屏
- ❌ 每张卡片单独持久化"展开/收起"状态（页面刷新就重置）
- ❌ tooltip 展示完整 args（要看直接点开）
- ❌ 工具历史时间线视图
- ❌ 改 MessageBubble / 系统气泡 / 保存为工具卡片
- ❌ 保存 chatMode 到 IDB（session 生命周期内有效；每次新会话继承 settings 默认值）
- ❌ 国际化英文版

## 3 · 用户体验

### 3.1 模式名称

- **简洁模式**（compact）：一行进展提示；默认值
- **详细模式**（full）：现在的完整卡片；开发者用

内部 enum 保留 `"compact"` / `"full"`；仅 UI 文案改为「简洁 / 详细」。

### 3.2 一行进展提示形态

简洁模式下每个工具渲染成：

```
✓ 获取页面信息                        2ms
✓ 抓页面快照                          2ms
✓ 找匹配元素                          3ms
⟳ 点击元素                                (spinner, running…)
✗ 点击元素  uid not found — call takeSnapshot first
```

- 左侧图标（lucide-react，与 PR #36 一致）：
  - `Loader2 animate-spin` — running / draft / awaiting（不需人工审批）
  - `Check text-emerald-500` — ok
  - `X text-red-500` — error
  - `Circle text-zinc-500` — skipped / denied
- 中间：
  - **只显示中文别名**（`text-zinc-200`，主体色）——如 "获取页面信息"、"抓页面快照"
  - **无别名的工具回退到工具原名**（英文，`font-mono text-zinc-400`）——避免完全不认识的操作漏出
- 右侧：
  - 耗时 `Nms`（zinc-500 小号）
  - error 状态时不显示耗时（腾位置给错误摘要）
- error 行：`errorMessage` 附在别名之后，`text-red-400`，单行 ellipsis
- 整行 `cursor-pointer hover:bg-zinc-800/60` — 点了 toggle 该 card 单独展开为 StepCard
- 展开后：以完整 StepCard 出现在同一位置；再点行头（或 StepCard 上的空白处）可收回

### 3.3 审批 / 报错例外

- **awaiting 且需要人工审批**（severity=caution/dangerous，未预批） → **强制显示完整 StepCard**（含 args + 审批按钮），不管当前是不是简洁模式
- 审批通过或跳过后 → 状态变 running/skipped → 自动收回一行
- **error** → **保持一行**，摘要信息见 3.2；用户主动点行可展开完整卡片（含 args 便于定位）

### 3.4 AssistantBubble summary 处理

现有 AssistantBubble 顶部有 `▸ N 次工具调用 · ✓12 · ✗1` 的可折叠 summary（[assistant-bubble.tsx:47-89](packages/extension/src/sidepanel/components/assistant-bubble.tsx)）。

**详细模式**：保持不变（summary 可点开折叠内含 StepCard 列表；live/awaiting 自动展开）。

**简洁模式**：保留 summary，采用**三态默认展开策略**：
- **Live 中 / 有 awaiting**：自动展开（用户能看到实时进展）
- **Done / idle**：自动折叠回一行汇总（`✓ 14 步` 或 `✓13 · ✗1 · 待审 0`），保持 chatbot 干净感
- **用户点击 summary**：显式覆盖上面两条，一直生效直到会话下一次状态变化

实现用一个 `useState<boolean | undefined>(undefined)`：
```ts
const [userOverride, setUserOverride] = useState<boolean | undefined>(undefined);
const autoOpen = isLive || hasAwaiting;
const effectiveOpen = userOverride !== undefined ? userOverride : autoOpen;
// summary 点击：setUserOverride(!effectiveOpen)
```

用户 override 之后，如果再次进入 live（比如"重新生成"），`autoOpen` 会强制展开但 `userOverride` 依然生效——这场景是罕见的，可接受；如果实测困扰，后续再加"live 时清空 override"逻辑。

Summary 文案简化：`14 步` 或带出错时 `✓13 · ✗1`；比现在 "N 次工具调用" 更短。

### 3.5 开关位置与作用域

- **Settings → 外观**：新增一个 select `默认聊天视图`：`简洁模式（推荐）` / `详细模式`。首次装默认 `简洁模式`
- **Header 右侧**：新增一个图标按钮（lucide `Eye` 详细模式 / `EyeOff` 简洁模式）。tooltip：`当前：简洁模式，点切换`。**只影响当前会话**，不写回 Settings
- 每次新会话初始化时 `session.chatMode = settings.defaultChatMode`

## 4 · 架构

### 4.1 新增文件

```
packages/extension/src/sidepanel/lib/tool-labels.ts                     (~40 行)
packages/extension/src/sidepanel/components/step-row.tsx                (~80 行)
packages/extension/tests/sidepanel/lib/tool-labels.test.ts              (~20 行)
packages/extension/tests/sidepanel/components/step-row.test.tsx         (~90 行)
```

### 4.2 修改文件

```
packages/shared/src/types.ts                                            (+1 字段 defaultChatMode)
packages/extension/src/sidepanel/chat/settings-store.ts                 (+1 DEFAULTS 项)
packages/extension/src/sidepanel/drawers/settings/section-appearance.tsx (加一行 select)
packages/extension/src/sidepanel/chat/session-store.ts                  (+chatMode 字段 + action)
packages/extension/src/sidepanel/shell/header.tsx                       (加 Eye/EyeOff 按钮 + 2 props)
packages/extension/src/sidepanel/shell/app-shell.tsx                    (初始化 chatMode + 传参)
packages/extension/src/sidepanel/components/assistant-bubble.tsx        (根据 chatMode 切 StepRow/StepCard/summary)
```

### 4.3 `tool-labels.ts`

```ts
/** 中文别名表：工具名 → 中文一句话名。未映射的工具在 UI 上直接显示原名（英文）。*/
export const TOOL_LABELS: Record<string, string> = {
  // Snapshot / query
  snapshotDOM: "抓 DOM 结构",
  takeSnapshot: "抓页面快照",
  querySelector: "找单个元素",
  querySelectorAll: "找匹配元素",
  extractText: "提取文本",
  extractImages: "提取图片",
  getPageInfo: "获取页面信息",
  getValue: "读取输入值",
  extractFormState: "读表单状态",

  // Flow
  scroll: "滚动页面",
  waitFor: "等待",
  navigate: "页面导航",

  // Actions
  click: "点击元素",
  clickByUid: "点击元素",
  fillInput: "填入值",
  fillByUid: "填入值",
  fillForm: "批量填表",
  setCheckbox: "勾选/取消",
  selectOption: "下拉选项",
  submitForm: "提交表单",
  hover: "悬停",
  focus: "聚焦",
  pressKey: "按键",
  uploadFile: "上传文件",

  // Storage / danger
  readStorage: "读 storage",
  writeStorage: "写 storage",
  httpRequest: "发请求",
  runJS: "执行脚本",

  // Cross-tab
  listTabs: "列出 tab",
  openTab: "开新 tab",
  attachTab: "挂载 tab",
  detachTab: "取消挂载",
  closeTab: "关闭 tab",
  switchToTab: "切换 tab",

  // Meta
  screenshot: "截图",
  askUser: "征求确认",
  searchBookmarks: "搜书签",
  searchHistory: "搜历史",
  downloadImage: "下载图片",

  // Visual
  highlightElement: "高亮元素",
  highlightText: "高亮文字",
};

export function labelFor(toolName: string): string | null {
  return TOOL_LABELS[toolName] ?? null;
}
```

### 4.4 `step-row.tsx`

```tsx
import { Check, X, Loader2, Circle } from "lucide-react";
import type { StepCardState } from "../chat/session-store";
import { labelFor } from "../lib/tool-labels";

type Props = {
  card: StepCardState;
  onExpand: () => void;
};

function icon(status: StepCardState["status"]) {
  if (status === "ok") return <Check size={12} className="text-emerald-500 shrink-0" />;
  if (status === "error") return <X size={12} className="text-red-500 shrink-0" />;
  if (status === "skipped" || status === "denied")
    return <Circle size={12} className="text-zinc-500 shrink-0" />;
  return <Loader2 size={12} className="text-zinc-400 animate-spin shrink-0" />;
}

export function StepRow({ card, onExpand }: Props) {
  const alias = labelFor(card.name);
  const isError = card.status === "error";
  const isDone = card.status === "ok";
  return (
    <button
      type="button"
      onClick={onExpand}
      className="w-full flex items-center gap-2 px-2 py-1 rounded text-[11px] hover:bg-zinc-800/60 text-left"
    >
      {icon(card.status)}
      {alias ? (
        <span className="text-zinc-200 shrink-0">{alias}</span>
      ) : (
        <span className="font-mono text-zinc-400 shrink-0">{card.name}</span>
      )}
      {isError && (
        <span className="text-red-400 truncate min-w-0">
          {card.error ?? "执行失败"}
        </span>
      )}
      {isDone && typeof card.ms === "number" && (
        <span className="ml-auto text-zinc-500 shrink-0">{card.ms}ms</span>
      )}
    </button>
  );
}
```

### 4.5 Settings 字段

`packages/shared/src/types.ts`：

```diff
 export type LlmSettings = {
   ...
+  /** 聊天视图默认模式：compact = 简洁模式（一行进展），full = 详细模式（完整卡片）*/
+  defaultChatMode?: "compact" | "full";
 };
```

`packages/extension/src/sidepanel/chat/settings-store.ts` DEFAULTS：

```diff
 const DEFAULTS: LlmSettings = {
   ...
+  defaultChatMode: "compact",
 };
```

`section-appearance.tsx` 新增一行 select（style 参照现有主题 select）：

```tsx
<div className="flex items-center gap-2">
  <span className="w-20 text-zinc-400">默认视图</span>
  <select
    value={settings.defaultChatMode ?? "compact"}
    onChange={(e) => void settings.save({ defaultChatMode: e.target.value as "compact" | "full" })}
    className="bg-zinc-800 px-2 py-1 rounded"
  >
    <option value="compact">简洁（推荐）</option>
    <option value="full">详细</option>
  </select>
</div>
```

### 4.6 Session state

`session-store.ts`：

```diff
 export type SessionData = {
   ...
+  chatMode: "compact" | "full";
 };

 export function makeEmptySession(tabId: number, url = ""): SessionData {
   return {
     ...
+    chatMode: "compact",
   };
 }

+export function setChatMode(tabId: number, mode: "compact" | "full"): void {
+  patchSession(tabId, (s) => ({ ...s, chatMode: mode }));
+}
```

`useSession` legacy hook 追加：
```ts
setChatMode: (m: "compact" | "full") => setChatMode(tabId, m),
```

`rehydrateFromPersisted` 里，chatMode 不从 `PersistedSessionData` 读（不持久化），保持 `makeEmptySession` 的默认 `"compact"`。

**Rehydrated session 的边界情况**：AppShell 的 seed useEffect（§4.7）只在 `messages.length === 0 && cards.length === 0` 时生效。一个已存在消息、从 IDB 恢复的会话不会被 seed —— 其 chatMode 保持 `"compact"` 默认，即使 settings 默认是 `"full"`。已知折中，用户可通过 Header 图标一键切回 full。不做特殊处理（否则要么覆盖用户显式的 header toggle、要么加一个"用户是否显式改过"标志复杂化状态机）。

### 4.7 AppShell 初始化 + 传参

在 AppShell 已有的 "seed permissionMode from defaultPermissionMode" 那个 useEffect 附近，新增类似的 seed：

```tsx
useEffect(() => {
  if (!settings.loaded || currentTabId == null) return;
  // 新会话（无 message、无 card）时，chatMode 跟随当前 settings 默认
  if (session.messages.length === 0 && session.cards.length === 0) {
    const target = settings.defaultChatMode ?? "compact";
    if (session.chatMode !== target) {
      setChatMode(currentTabId, target);
    }
  }
}, [settings.loaded, settings.defaultChatMode, currentTabId, session]);
```

`<Header>` 增加 props：
```tsx
<Header
  debugBadge={session.debugBadge}
  onNewChat={onNewChat}
  chatMode={session.chatMode}
  onToggleChatMode={() => {
    if (currentTabId != null) {
      setChatMode(currentTabId, session.chatMode === "compact" ? "full" : "compact");
    }
  }}
/>
```

`<ChatView>` 无变化（chatMode 由内部通过 `useSession()` 读取，也可以从 AssistantBubble 里 `useSession` 直接读；我们让 AssistantBubble 读 store 更简单）。

### 4.8 Header 加按钮

```diff
-import { Plus, History, Wrench, Settings, Bug } from "lucide-react";
+import { Plus, History, Wrench, Settings, Bug, Eye, EyeOff } from "lucide-react";
 ...
 type Props = {
   debugBadge: DebugBadge;
   onNewChat: () => void;
+  chatMode: "compact" | "full";
+  onToggleChatMode: () => void;
 };
```

在图标行开头（`<IconBtn label="新会话" ...>` 之前）插入：
```tsx
<IconBtn
  label={props.chatMode === "compact" ? "当前简洁模式，点切换详细" : "当前详细模式，点切换简洁"}
  onClick={props.onToggleChatMode}
>
  {props.chatMode === "compact" ? <EyeOff size={14} /> : <Eye size={14} />}
</IconBtn>
```

（EyeOff = 隐藏细节 = compact；Eye = 展开细节 = full。视觉上 Eye 打开 = 看到所有细节。）

### 4.9 AssistantBubble 分模式渲染

```tsx
import { useSession } from "../chat/session-store";
...
export function AssistantBubble({ ... }: Props) {
  const chatMode = useSession().chatMode;
  const allCards: StepCardState[] = [...];
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setExpanded((s) => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  // ── compact 分支 ─────────────────
  if (chatMode === "compact") {
    const done = allCards.filter((c) => c.status === "ok").length;
    const errs = allCards.filter((c) => c.status === "error").length;
    const summary = errs > 0 ? `✓${done} · ✗${errs}` : `${allCards.length} 步`;

    // 三态默认展开：live/awaiting 自动展开；done 折叠；用户 override
    const autoOpen = isLive || hasAwaiting;
    const summaryOpen = userOverride !== undefined ? userOverride : autoOpen;

    return (
      <div className="bg-zinc-800/60 rounded p-2 text-xs flex flex-col gap-1.5">
        {allCards.length > 0 && (
          <>
            <button
              onClick={() => setUserOverride(!summaryOpen)}
              className="self-start text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
            >
              <span>{summaryOpen ? "▾" : "▸"}</span>
              <span>{summary}</span>
            </button>
            {summaryOpen && (
              <div className="flex flex-col gap-0.5">
                {allCards.map((card) => {
                  // awaiting 需人工审批时强制完整卡
                  const mustExpand =
                    (card.status === "awaiting" && needsApproval(card)) ||
                    expanded.has(card.toolUseId);
                  return mustExpand ? (
                    <StepCard
                      key={card.toolUseId}
                      card={card}
                      onApprove={onApprove}
                      needsManualApproval={needsApproval(card)}
                    />
                  ) : (
                    <StepRow
                      key={card.toolUseId}
                      card={card}
                      onExpand={() => toggle(card.toolUseId)}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
        {text && <div className="whitespace-pre-wrap">{text}</div>}
        {/* 复制/重生成 actions 保留原样 */}
      </div>
    );
  }

  // ── full 分支 ─── 保留现有实现 ─
  const hasAwaiting = ...;
  const [open, setOpen] = useState<boolean>(isLive || hasAwaiting);
  // ...（当前实现原样保留）
}
```

**注意 hooks order**：React 规则要求每次 render 调用同样多同样序的 hooks。chatMode 切换时如果一个分支多一个 `useState`、另一个分支少一个，切换那一次 render 会报 "hooks order changed"。

**方案**：所有 `useState` 无条件调用在组件顶部（`useSession()`、`useState<Set<string>>(new Set())`、原有的 `useState<boolean>(...)` 全部提前），然后再按 `chatMode` 分支 return 不同 JSX。`open` 只在 full 分支的 JSX 里被消费，`expanded` 只在 compact 分支消费——但 useState 本身照常执行。React 不看你消不消费，只看 hooks 调用顺序。

```tsx
export function AssistantBubble({ ... }: Props) {
  const chatMode = useSession().chatMode;
  const allCards: StepCardState[] = [ /* 组装 */ ];
  const hasAwaiting = allCards.some(...);

  // 所有 hooks 都无条件调用
  const [open, setOpen] = useState<boolean>(isLive || hasAwaiting); // for full
  const [expanded, setExpanded] = useState<Set<string>>(new Set()); // for compact StepRow toggle
  const [userOverride, setUserOverride] = useState<boolean | undefined>(undefined); // for compact summary

  if (chatMode === "compact") {
    /* 使用 expanded / setExpanded */
    return <CompactBranch />;
  }
  /* 使用 open / setOpen — 现有实现 */
  return <FullBranch />;
}
```

## 5 · 数据流

```
Settings.defaultChatMode ──┐
                            ├─→ AppShell useEffect: setChatMode(session.chatMode = default)
                            │      when session is fresh
Header EyeOff/Eye click ────┴─→ setChatMode(session.chatMode = toggle)

AssistantBubble reads useSession().chatMode
   ├─ compact → StepRow per card (awaiting override → StepCard)
   └─ full    → 现有 summary + StepCards
```

## 6 · 测试

### 6.1 `tool-labels.test.ts`

- `labelFor("takeSnapshot")` 返回 "抓页面快照"
- `labelFor("unknownTool")` 返回 `null`
- 表里所有 key 都是 `TOOL_DEFS` 里存在的工具名（防止 typo）—— 用 `toMatch` 遍历

### 6.2 `step-row.test.tsx`

沿用 quick-actions.test.tsx 的 mount/cleanup：

- 渲染 ok 卡（有别名）：显示 `✓` 图标 + 中文别名 + `Nms`；**不**显示英文工具名
- 渲染 ok 卡（无别名）：显示 `✓` 图标 + 英文工具名（fallback）+ `Nms`
- 渲染 error 卡：显示 `✗` + 别名 + error message；无 `ms`
- 渲染 running 卡：显示 spinner 图标；无 `ms`
- 点击整行触发 `onExpand`

### 6.3 手工 QA

- [ ] 首次装：默认简洁模式；live 时汇总展开、逐条追加行
- [ ] 任务完成：汇总自动折叠为一行 `N 步`
- [ ] 点汇总头：手动展开／折叠，覆盖自动行为
- [ ] Settings 切详细模式：新对话看到完整卡
- [ ] Header 图标切换：只影响当前会话，Settings 里不动
- [ ] 简洁模式下点单行：展开为 StepCard；再点收回
- [ ] 简洁模式下危险工具（如 `httpRequest withCredentials`）：审批时自动完整卡
- [ ] 简洁模式下工具报错：一行显示 error message；点开看完整
- [ ] 出错时汇总显示 `✓13 · ✗1`
- [ ] 无中文别名的工具：一行显示原英文名

## 7 · 风险

| 风险 | 缓解 |
|---|---|
| chatMode 切换触发 React hooks order changed | AssistantBubble 里所有 `useState` 无条件调用；`open` 与 `expanded` 都定义，只按 chatMode 决定用哪个 |
| 中文别名与实际工具行为不匹配（别名过时） | Task 里加 sanity test：TOOL_LABELS 的 key 必须都在 `TOOL_DEFS` 里；PR 时 lint 层面就报错 |
| 用户简洁模式下不知道 AI 干了什么 | 每一行足够描述性（icon + 中文别名 + 耗时）；点开一秒看到完整；awaiting 强制展开 |
| Header 图标含义不清 | tooltip 明确写「当前简洁模式，点切换详细」；Eye/EyeOff 图标常见语义 |
| 详细模式用户被"降级"到简洁模式 | Settings 迁移逻辑：`defaultChatMode` 为 `undefined`（老用户）时按 `"compact"` 默认；用户能立刻在 Header 一键切详细，或改 Settings |
| 现有 AssistantBubble 的复制/重生成按钮丢失 | compact 分支保留 `复制 / 重生成` actions 代码块（原样搬） |
| 现有 e2e / 单测断言依赖 summary "N 次工具调用" 文本 | grep 一下所有测试引用；如果击中，改测试匹配 compact 模式或让测试跑详细模式 |

## 8 · Out of scope

- 单独持久化"当前展开哪几张卡"到 IDB
- 呼吸动画 / 进度条 / spinner 变体
- 悬停 tooltip 预览完整 args
- 工具时间线视图
- 保存为工具 / 系统气泡 / MessageBubble 改造
- 记住上次 Header 切换过后的 chatMode（新会话仍从 Settings 默认起）
- 国际化英文版
- 关闭 chat mode 后完全隐藏工具行（用户想更极端可以后续加一个 "hide-all" 选项）

# 侧边面板会话持久化与多会话历史 — 设计文档

- 日期：2026-05-19
- 状态：草案，待评审
- 范围：把现有 per-tab 内存会话扩展为 IndexedDB 持久化；同 tab 支持多轮会话历史 + 新建会话；跨 sidepanel 收开、跨浏览器重启都不丢
- 前置：Plan 4（Per-Tab 会话）、多 tab 上下文（`2026-05-14-multi-tab-context-design.md`）

## 1. 背景与目标

当前会话状态全部存于 sidepanel 内的 zustand store（`src/sidepanel/chat/session-store.ts`），不写任何持久存储。这导致：

- 关 sidepanel / sidepanel reload / 扩展更新 → 全部 active session 丢失
- 关 tab → 会话进 `closedSessions` 内存列表，**5 分钟** TTL，过期丢失
- 浏览器重启 → 一切归零

用户实际体验里"长任务"和"分时段往返同一个站点"的场景很常见，目前的"内存即一切"显然不够。同时，"一个 tab 一个会话"的限制也很硬：一旦开始操作，就只能在那条对话里改、没法在同一个 tab 上开新会话又随时回到旧的。

目标：

- 持久化业务历史到 IndexedDB，关 sidepanel / 重启浏览器都不丢
- 同 tab / 同 URL 支持多个历史会话；可"新建会话"开空白、可从历史"恢复"任意一条接着聊
- 持久化对失败/损坏鲁棒：写失败不影响主功能，读失败降级为空白

非目标：

- 不持久化 UI 偏好（折叠状态、`inputDraft`、`approveAllSafe` 开关等），每次 sidepanel 打开重置
- 不实现"关 sidepanel 后台继续跑会话"——架构搬迁过大，留给后续 spec
- 不跨设备同步（不接 chrome.storage.sync、不连云）
- 不持久化 attached tabs 的"信任状态"跨重启（attached tab 列表会随会话存下来，但恢复时要重新校验对应 tab 是否还存在）

## 2. 产品决策

| 决策点 | 选择 |
|---|---|
| 持久化范围 | 只持久化业务历史（messages / cards / executedSteps / tokenUsage / roundCount / attachedTabs / url / runRecordId / errorMessage）。UI 偏好不持久化 |
| 主键策略 | tabId 主 + URL 副。sidepanel 启动先按 tabId 查 active；不命中按 URL 找历史候选 |
| URL 命中时的恢复 UX | 弹 banner（参照现有 `closed-sessions-banner.tsx` 风格）"恢复 / 丢弃 / 更多" |
| 多会话心智模型 | 一个 tab 任一时刻仅一个 active 会话；其余 archived，可"恢复"切换 |
| 历史保留策略 | 每 URL 最多 20 条 archived，超出按 updatedAt 淘汰最老的（cascade 删对应 runs 行） |
| 关 tab 行为 | 直接归档到该 URL 的持久化历史；**删除现有 5 分钟内存 `closedSessions` 列表** |
| 存储后端 | IndexedDB（与现有 `runs` / `tools` 同 DB，schema 版本号 +1） |
| 写入策略 | sidepanel mutation 触发 debounced 300ms 写；`beforeunload` flush |
| 持久化的真值定位 | 持久化是"加速恢复"层；内存 zustand 是 source of truth。写/读失败降级为"这次没存上"，主功能不受影响 |
| URL 比较粒度 | **严格相等**（含 query / fragment）。理由：同站不同 query 通常是不同任务上下文（例如不同商品详情页），合并会"串味"。未来可加规范化策略，本期不做 |

## 3. 数据模型

新增 IDB store `chat_sessions`：

```ts
// shared/types.ts
export type PersistedSessionData = Pick<SessionData,
  | "messages"
  | "cards"
  | "executedSteps"
  | "tokenUsage"
  | "roundCount"
  | "attachedTabs"
  | "url"
  | "runRecordId"
  | "errorMessage"
>;
// 排除：abortController（不可序列化）、streamingAssistantText（瞬时）、
//      status / showSaveDialog / logs / logsOpen / inputDraft / approveAllSafe（UI/偏好）

export type PersistedSession = {
  id: string;             // uuid，会话主键
  url: string;            // 最近一次活动时的 URL
  lastTabId: number;      // 最近一次活动时的 tabId
  status: "active" | "archived";
  data: PersistedSessionData;
  createdAt: number;      // epoch ms
  updatedAt: number;      // epoch ms
};
```

**索引**：

| 名称 | 字段 | 用途 |
|---|---|---|
| `by_url_status` | `(url, status)` | 列出某 URL 下 active / archived |
| `by_lastTabId_status` | `(lastTabId, status)` | sidepanel 启动按 tabId 查 active |
| `by_url_updatedAt` | `(url, updatedAt)` | drawer / banner 按时间倒序列历史 |

**约束**：单一 URL 下最多一行 status="active"；archived ≤ 20，超出淘汰最老。

## 4. 组件

### 新增文件

| 文件 | 职责 |
|---|---|
| `src/sidepanel/chat/persistence/sessions-storage.ts` | IDB CRUD：`putSession` / `getActiveByTabId` / `listArchivedByUrl` / `archiveActive` / `restoreArchived` / `pruneOverLimit(url)` / `clearAllForUrl` / `cascadeDeleteRuns(sessionRunIds)` |
| `src/sidepanel/chat/persistence/auto-persist.ts` | 订阅 zustand `sessionsByTab`，debounced 300ms 把每个 active session 写入 IDB；`beforeunload` flush |
| `src/sidepanel/chat/persistence/hydrate.ts` | sidepanel 启动时按 tabId 查 active，命中即写回 zustand；不命中返回 URL 候选 list 供 banner |
| `src/sidepanel/components/url-recovery-banner.tsx` | 命中 URL 时显示"恢复 / 丢弃 / 更多"banner |
| `src/sidepanel/components/session-history-drawer.tsx` | ≡ 按钮打开的历史 drawer，列该 URL 下 archived 列表，每条带"恢复"/"删除"；底部"清空此 URL 历史" |
| `src/background/tab-close-archiver.ts` | 监听 `chrome.tabs.onRemoved`，把 IDB 中 `lastTabId=该 tab && status=active` 的行标 archived |

### 修改文件

| 文件 | 改动 |
|---|---|
| `src/sidepanel/chat/session-store.ts` | 删 `closedSessions` / `closeTab` / `restoreClosed` / `pruneClosed` / `CLOSED_TTL_MS` 全套；加 `startNewSession(tabId)`（归档当前 + 开新空白）、`restoreFromArchive(sessionId, tabId)` |
| `src/sidepanel/chat/closed-sessions-pruner.ts` | **删除整个文件** |
| `src/sidepanel/components/closed-sessions-banner.tsx` | **删除**，被 `url-recovery-banner` 替代 |
| `src/sidepanel/app.tsx` | boot 时挂 `hydrate` + `auto-persist`；接 `url-recovery-banner` |
| `src/sidepanel/pages/chat-page.tsx` | 顶上加 ➕"新建会话"按钮 + ≡ 历史按钮 |
| `src/shared/types.ts` | `PersistedSession` / `PersistedSessionData` 类型 |
| `src/background/storage/db.ts`（或同等 IDB 启动文件） | `onupgradeneeded`：dbVersion v1→v2，加 `chat_sessions` store 与 3 个索引 |

### 边界与依赖

- `auto-persist` 只读 zustand、只写 IDB，不碰 UI 渲染
- `hydrate` 只写 zustand、只读 IDB，sidepanel boot 调一次
- `tab-close-archiver` 跑在 background SW，不依赖 sidepanel 在线
- IDB schema 与现有 `runs` / `tools` 共存于同 DB，dbName 复用，版本号 v1→v2
- `runs` 表里的 step log 与 `chat_sessions` 通过 `runRecordId` 关联；evict archived session 时 cascade 删对应 run

## 5. 数据流

### 5.1 主流程：用户聊天 → 持久化

```
用户发消息 / 工具返回
  → sessionsByTab[tabId] mutation（zustand）
  → auto-persist 订阅器观察
  → debounce 300ms（合并连续 mutation）
  → putSessionData(id, data, lastTabId, url)：
      读 IDB 当前行；如果 status==="archived"（已被 background 或别处归档），
      直接 abort 本次写（不复活已归档会话）；否则 update data/lastTabId/url/updatedAt，
      status 保持当前值不动。
  → IDB 写完，无 UI 反馈
```

**关键不变量**：auto-persist 永远不写 `status` 字段。`status` 只能由三个明确入口改：`startNewSession`、`restoreFromArchive`、`tab-close-archiver`。这避免了 status 在多写源间被 flip-flop。

### 5.2 "新建会话"按钮

```
点 ➕
  → 当前 active SessionData 从 zustand 拿出
  → IDB: 当前那行 status:"active" → "archived"、updatedAt=now
  → pruneOverLimit(url)：若该 url 下 archived >20，删最老 + cascade 删 runs
  → zustand sessionsByTab[tabId] = makeEmptySession(tabId, url)
  → 新空 session 第一次有消息时再 putSession 写新行
```

### 5.3 关 tab → 归档

```
chrome.tabs.onRemoved(tabId)（background SW）
  → IDB: 查 by_lastTabId_status，命中 status=active 的那行
  → update status:"archived"、updatedAt=now
  → pruneOverLimit(url)
```

**关键**：background 不负责"会话内容"，只标 status。内容由 sidepanel 的 auto-persist 保证及时写入 IDB。

**与 sidepanel auto-persist 的并发**：sidepanel 也监听 `chrome.tabs.onRemoved`（直接订阅 `chrome.runtime.onMessage` 收 background 转发的事件，避免双重监听语义），收到后立即：
1. flush 该 tab 对应的 debounced 写
2. 从 zustand `sessionsByTab` 删除该 tabId
3. 不再有针对该 tabId 的进一步 mutation

background 的 IDB status update 与 sidepanel 的 flush 同时进行，两者写的目标都是同一行：sidepanel 写最终内容（status 不变 / 还是 active），background 紧随其后写 status=archived。两次写都基于 `id` 主键 update，最终结果是"有最新内容的 archived 行"。如果 sidepanel 已经关闭，则只有 background 写、内容停留在最近一次 auto-persist 的状态——这是已知的"最差情况下损失最后 ≤300ms"，可接受。

### 5.4 Sidepanel 启动

```
sidepanel.app boot
  → currentTabId = await chrome.tabs.getCurrent().id
  → currentUrl   = await chrome.tabs.get(currentTabId).url
  → const active = await IDB.getActiveByTabId(currentTabId)
  → if (active && active.url === currentUrl):
      // 场景 1：同浏览器会话内 sidepanel 重开
      rehydrate to zustand
      sanitizeRestoredSession(session)  // 见 §6
      return
  → const candidates = await IDB.listArchivedByUrl(currentUrl, limit=5)
  → if (candidates.length > 0):
      // 场景 2：浏览器重启或换 tab 但同 URL
      show url-recovery-banner with candidates[0]（最新一条）+"更多"
  → else:
      // 场景 3：全新
      empty session
```

### 5.5 URL-recovery banner 交互

- "恢复" → `restoreArchived(candidates[0].id, currentTabId)`：那行 status:"archived" → "active"，`lastTabId=currentTabId`，rehydrate 到 zustand
- "丢弃" → 删那一行（不影响其它历史）
- "更多" → 打开 history drawer，所有 archived 都列出

### 5.6 History drawer 交互

- 按 `by_url_updatedAt` 倒序列 20 条
- 每条 = 首条 user message 30 字预览 + 消息数 + 相对时间
- "恢复" → `restoreFromArchive`：先把当前 active（若有）归档，再把目标改 active + lastTabId=currentTabId + rehydrate
- "删除" → 单条删 + cascade 删 runs
- "清空此 URL 历史" → bulk 删 + cascade 删 runs

## 6. 错误处理与边界情况

| 失败点 / 情况 | 处理 |
|---|---|
| **IDB 写失败**（quota / lock / 临时） | `putSession` try/catch，logger.warn，**不阻塞 UI**；in-memory state 是 source of truth，下次 mutation 还会再尝试。连续 5 次写失败弹 toast "持久化失败，会话不会保存" |
| **IDB 读失败 / 数据损坏**（hydrate 时） | 单条 try/catch，broken 行跳过当作"没有"，让用户拿到空白 session。背景静默删除 broken 行 |
| **Schema 迁移失败**（v1→v2 `onupgradeneeded` 抛错） | 持久化层 disable（fall back 到纯内存），banner 报"持久化不可用，会话不会跨 sidepanel 保留"。不影响主功能 |
| **`chrome.tabs.get` 失败**（tabId 已无效） | 当作 tab 不存在；hydrate 时校验 attachedTabs 过滤失效项；onRemoved 收到 tabId 按 IDB lastTabId 查即可 |
| **恢复的 session 状态是 streaming/running**（`sanitizeRestoredSession`） | rehydrate 时 `status` 强制设为 `aborted`，`errorMessage="会话从持久化恢复，流式响应被中断"`，让用户重发 |
| **`attachedTabs` 里的 tabId 在恢复时已不存在** | 启动时 `chrome.tabs.get` 校验，移除失效 attached；记一条系统消息 |
| **同 URL 多窗口并行打开 sidepanel** | active 行 lastTabId 是"最近活动者"，两窗口 last-write-wins；可接受（messages append-only、写都是完整覆盖、不会丢） |
| **debounce 期间用户关 sidepanel** | `beforeunload` flush 一次未完成的 debounce |
| **runs cascade 删失败** | 静默；runs 表无限增长比错乱安全，下次启动 best-effort 重试 |
| **恢复时该 URL 的当前 active 已经存在另一条** | 把现有 active 自动归档（隐式"新建会话"），再把目标恢复成 active。drawer / banner 共用此路径 |

通用原则：持久化是"加速恢复"的一层，**不是 source of truth**。任何写/读失败都降级为"这次没存上"，主功能不受影响。

## 7. 测试

### 7.1 单元测试（vitest + `fake-indexeddb`）

| 文件 | 覆盖 |
|---|---|
| `tests/sidepanel/chat/persistence/sessions-storage.test.ts` | CRUD：put → getActiveByTabId 命中 / 不命中、listArchivedByUrl 倒序与分页、archiveActive 切 status、pruneOverLimit 删第 21 条、cascade 删 runs |
| `tests/sidepanel/chat/persistence/auto-persist.test.ts` | debounce 合并（300ms 内 5 次 mutation 只触发 1 次写）、`beforeunload` flush、写失败不抛 |
| `tests/sidepanel/chat/persistence/hydrate.test.ts` | 三场景：tabId 命中 / URL 命中 / 全无；`sanitizeRestoredSession` 把 streaming/running → aborted；attachedTabs 校验过滤失效 tab |
| `tests/sidepanel/chat/session-store.test.ts`（扩展） | `startNewSession` 归档当前 + 开空白；`restoreFromArchive` 先归档当前再恢复目标；删 `closedSessions` 相关旧测试 |
| `tests/background/tab-close-archiver.test.ts` | `chrome.tabs.onRemoved` 触发 → IDB 对应行 status 切换 + pruneOverLimit |
| `tests/sidepanel/components/url-recovery-banner.test.tsx` | render 候选、恢复按钮、丢弃按钮、"更多"打开 drawer |
| `tests/sidepanel/components/session-history-drawer.test.tsx` | 列表渲染、恢复时归档当前、删除单条、清空整 URL |

### 7.2 手测清单（PR Test plan）

- [ ] sidepanel 内多次 reload → 当前会话保留
- [ ] 浏览器整个关掉重开 → 同 URL banner 出现，恢复后消息齐全
- [ ] 关 tab 后 reopen 同 URL 新 tab → banner 出现
- [ ] 单 URL 连续新建 25 个会话 → IDB 中只剩 20 条 archived（最老 5 条被 evict、对应 runs 也删了）
- [ ] 流式中途关 sidepanel → 重开后该会话 status 是 aborted、可以重发
- [ ] 恢复一个 attachedTabs 里 tab 已关的会话 → 系统消息提示 + 列表里那个 tab 消失
- [ ] history drawer "清空此 URL 历史" → 全清

## 8. 迁移

- **现有 in-memory `closedSessions`**：丢弃。本次 release 上线时如果用户 sidepanel 里有未保存的 closedSessions 内存数据，会随升级清空（一次性损失，可接受 —— 它本来就是 5 分钟 TTL，不算稳定数据）
- **IDB schema**：现有 `runs` / `tools` 在 v1，新加 `chat_sessions` store 升 v2；`onupgradeneeded` 只新建 store + 索引，不改老 store

## 9. 风险

- **IDB 写量**：debounce 300ms 已经合并大部分突发；最坏情况单会话每秒 ~3 次写、单条 ~10KB，可接受
- **大 tool 输出撑爆 storage**：单条 session.data 上限不限制；如果用户跑了带百兆图片的工具，单条可能很大。未来可加"按字节数 prune"二级策略，本期不做
- **删 `closedSessions` 的 UX 风险**：现有 banner UX 用户可能熟悉，被替换后短期不适应；但 URL banner + history drawer 提供的能力更强，应该是净增值

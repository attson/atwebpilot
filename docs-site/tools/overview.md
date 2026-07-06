<!-- ⚠ 自动生成 —— 修改源在 packages/shared/src/llm/builtin-tool-defs.ts；跑 `pnpm gen` 重生 -->


# 工具参考总览

共 **41** 个内置工具，按类别与 severity 分组：

| 类别 | 说明 | 数量 |
|---|---|---|
| [探查](/tools/inspect) | 页面读取 · safe | 14 |
| [操作](/tools/action) | 页面写入 · caution | 8 |
| [危险](/tools/danger) | 提交 / 发 cookie 请求 / runJS · dangerous | 6 |
| [元 / 视觉](/tools/meta) | 跨 tab / bookmark / history / 视觉 | 13 |

## Severity 说明

- 🟢 **safe**：自动执行，无需审批
- 🟡 **caution**：默认自动（依权限模式）；`read` 模式下要审
- 🔴 **dangerous**：默认每次要审；`trust` 模式下按白名单放行；`yolo` 模式全自动（危险）

## 速查表

| 工具 | Severity | 类别 | 摘要 |
|---|---|---|---|
| `askUser` | 🟢 safe | meta | [ASK] 向用户主动征询（不是执行操作）。任务有多个候选 / 二次确认 / 缺关键信息时调用。返回 {choice}  |
| `attachTab` | 🟡 caution | meta | [META] 请求把已打开的 tab 纳入会话 attachedTabs；未预批准时会向用户索取审批。 |
| `click` | 🟡 caution | action | [ACT] 点击选择器命中的元素。required=false 时找不到不报错。会经过审阅（caution）。 |
| `clickByUid` | 🟡 caution | action | [ACT·UID] 用 takeSnapshot 返回的 uid 点击元素。比 selector 版稳定。 |
| `closeTab` | 🟢 safe | meta | [META] 真正关闭一个 tab。**只能关 attachedTabs 里的 tab**（防止误关用户其它窗口）。 |
| `detachTab` | 🟢 safe | meta | [META] 从会话 attachedTabs 移除 tab；不关闭该 tab。 |
| `downloadImage` | 🟡 caution | meta | [ACT] 把一个 URL 下载到本地（Chrome Downloads）。返回 {downloadId, filena |
| `extractFormState` | 🟢 safe | inspect | [FAST·USE BEFORE FILL] 把 &lt;form&gt; 内所有可填字段读成 {name: value |
| `extractImages` | 🟢 safe | inspect | [FAST] 在 root 范围内提取所有 &lt;img&gt; 的 src/data-src/srcset；incl |
| `extractText` | 🟢 safe | inspect | [FAST] 提取选择器命中元素的文本。single=true 返回字符串，否则返回数组。 |
| `fillByUid` | 🟡 caution | action | [ACT·UID] 用 takeSnapshot 返回的 uid 填值（input/textarea/contented |
| `fillForm` | 🟡 caution | action | [BATCH·ACT] 一次性填多个字段。每项写 selector + value 或 uid + value。返回 { |
| `fillInput` | 🟡 caution | action | [ACT] 往 input/textarea/contenteditable 填值；触发 input/change 事件 |
| `focus` | 🟢 safe | inspect | [ACT] 把焦点给某元素（触发 focus / focusin）。 |
| `getPageInfo` | 🟢 safe | inspect | [FAST·READ] 读当前页基本信息：URL / title / hostname / 语言 / OpenGraph |
| `getValue` | 🟢 safe | inspect | [FAST] 读 input/select/textarea/contenteditable 的当前值。 |
| `highlightElement` | 🟢 safe | meta | [VISUAL] 给页面某元素加红色虚线框（默认 3s 自动消失），让用户看清你说的是哪个。仅视觉，不改 DOM。 |
| `highlightText` | 🟢 safe | meta | [VISUAL] 在页面文本里高亮某段文字（黄色背景，3s 后还原）。仅找到第一次出现的位置。 |
| `hover` | 🟢 safe | inspect | [ACT] 把鼠标悬停在元素上（触发 mouseenter / mouseover / mousemove）。 |
| `httpRequest` | 🟡 caution | danger | [ACT] 通过后台代理发请求。withCredentials=true 时带 cookie（dangerous，要审阅 |
| `listTabs` | 🟡 caution | meta | [META] 列出所有窗口的可访问 tab；返回 [{tabId, windowId, url, title, atta |
| `navigate` | 🟢 safe | inspect | [ACT] 页面导航：后退 / 前进 / 重载 / 跳转。**优先**用本工具而不是 runJS('location.h |
| `openTab` | 🟡 caution | meta | [META] 打开新 tab，成功后自动加入会话 attachedTabs（source=ai-open）。返回 {ta |
| `pressKey` | 🟡 caution | action | [ACT] 模拟键盘事件（keydown + 可打印字符 keypress + keyup）。 |
| `querySelector` | 🟢 safe | inspect | [FAST] 返回首个匹配元素的浅层摘要 (tag/id/classes/text/attrs)。仅探查用。 |
| `querySelectorAll` | 🟢 safe | inspect | [FAST] 返回所有匹配元素的浅层摘要数组。 |
| `readStorage` | 🔴 dangerous | danger | [DANGER] 读 localStorage 或 sessionStorage 指定 key。需要审阅。 |
| `runJS` | 🟡 caution | danger | [LAST RESORT·DANGER] 在 MAIN world 注入并执行 async 函数体（receives ` |
| `screenshot` | 🟢 safe | meta | [VISION] 截当前 tab 可见区域为 PNG（自动作为 image block 注入下轮）。用于视觉调试 sel |
| `scroll` | 🟢 safe | inspect | [FLOW] 滚动页面。to 可为 'bottom' / 'top' / number。max 是滚动次数；untilS |
| `searchBookmarks` | 🟢 safe | meta | [META] 搜索浏览器书签（chrome.bookmarks.search）。返回 [{id, title, url} |
| `searchHistory` | 🟢 safe | meta | [META] 搜索浏览器历史。daysBack 默认 7。返回 [{url, title, lastVisitTime, |
| `selectOption` | 🟡 caution | action | [ACT] &lt;select&gt; 元素按 value 或 label 选项。同时给两者时优先 value。 |
| `setCheckbox` | 🟡 caution | action | [ACT] 设置 checkbox 勾选状态；派发 change 事件。 |
| `snapshotDOM` | 🟢 safe | inspect | [FIRST·LEGACY] 返回页面 DOM 简化树（tag/id/classes/直接文本/children）。 |
| `submitForm` | 🔴 dangerous | danger | [CONFIRM·DANGER] 提交 &lt;form&gt;。会触发服务端动作（下单、留言等），用户必须审阅。 |
| `switchToTab` | 🟢 safe | meta | [META] 把 Chrome 前台切到目标 tab。tabId 必须已在 attachedTabs 或当前 tab。 |
| `takeSnapshot` | 🟢 safe | inspect | [FIRST·UID] 抓取页面 accessibility snapshot：返回 [{uid, role, name |
| `uploadFile` | 🔴 dangerous | danger | [CONFIRM·DANGER] 把后端代理拉到的文件填到 &lt;input type=file&gt;。某些站点会拒 |
| `waitFor` | 🟢 safe | inspect | [FLOW] 等待固定 ms，或等待选择器出现（带 timeoutMs 兜底）。 |
| `writeStorage` | 🔴 dangerous | danger | [DANGER] 写 localStorage 或 sessionStorage。改站点状态，需要审阅。 |

# 配置

打开扩展设置页（Header 里齿轮图标）。

## LLM

| 字段 | 说明 |
|---|---|
| Provider | Anthropic / OpenAI（也支持 OpenAI 兼容协议接 LiteLLM / Azure / Ollama 等） |
| Endpoint | 留空 = 默认；也可填自定义 base URL（例如 `https://api.deepseek.com/v1`） |
| Model | 下拉建议或自由输入（如 `claude-sonnet-4-6`、`gpt-4o-mini`、`deepseek-chat`） |
| API Key | 「仅本次会话保存」勾选 = 关浏览器即清；否则存 `chrome.storage.local` |
| max_tokens | 单次 LLM 响应上限（默认 4096） |
| 最大轮数 | 一次会话最多 LLM round 数（默认 20） |
| 优化模型 | 「优化提示词」按钮用的模型；留空 = 用对话模型 |
| 续作 nudge 次数 | 模型说完没调工具时再问一遍是否真完成（默认 1） |

API Key **不**会进 IndexedDB，也**不**会被「导出工具库」带走。

## 外观

- **主题**：深色 / 浅色 / 跟随系统
- **默认视图**：
  - **简洁**（推荐）— 每个工具调用一行进展提示，点行展开看细节
  - **详细** — 每步显示完整参数 / 输出

Header 上一个眼睛图标可当次会话临时切换，不写回默认。

## 权限模式

顶部工具栏切换：

- **read** — 仅 safe 工具自动跑；其他都要审阅
- **default**（默认）— safe 与 caution 自动；dangerous 每次要审
- **trust** — safe、caution、白名单里的 dangerous 自动
- **yolo** — 全部自动（危险！）

## 危险工具白名单

`trust` 模式下可以逐个勾选允许的 dangerous 工具（如 `httpRequest(withCredentials)`）。

## Coordinator（可选）

远程 WS 服务器地址；填了后扩展可被远程派发工具步。见 [Coordinator](/advanced/coordinator)。

## 下一步

- [第一条任务](/guide/first-task)

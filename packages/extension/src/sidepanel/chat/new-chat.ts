/**
 * "新建对话" 共用流程。sidepanel header 的 [+] 按钮和 widget panel header
 * 的 [+] 按钮都走这里,保证归档/清理路径一致。
 *
 * 1. flush 所有待落盘的 persist 队列(避免半写状态)
 * 2. 当前 tab 若有 active session,archive 到 IDB(可从历史 drawer 恢复)
 * 3. 该 URL 下的 archived 会话 pruning(每 URL ≤20)+ cascade 删对应 runs
 * 4. startNewSession(tabId)
 * 5. 清 auto-persist 的追踪状态
 *
 * 调用方自行清空自己的输入框 draft(sidepanel / widget 各持一份)。
 */
import { startNewSession } from "./session-store";
import {
  archiveActive,
  cascadeDeleteRuns,
  getActiveByTabId,
  pruneOverLimit,
} from "./persistence/sessions-storage";
import { flushAllPending, clearPersistStateFor } from "./persistence/auto-persist";

export async function newChatForTab(tabId: number): Promise<void> {
  await flushAllPending();
  const cur = await getActiveByTabId(tabId);
  if (cur) {
    await archiveActive(cur.id);
    const evicted = await pruneOverLimit(cur.url);
    if (evicted.length) await cascadeDeleteRuns(evicted);
  }
  startNewSession(tabId);
  clearPersistStateFor(tabId);
}

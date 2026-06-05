import { useEffect, useState } from "react";
import {
  loadConfig,
  saveConfig,
  loadToken,
  saveToken,
  clearToken,
  loadAllowRemoteChat,
  saveAllowRemoteChat,
  type CoordinatorConfig
} from "../../background/coordinator-state";

export function CoordinatorSettingsPage() {
  const [wsUrl, setWsUrl] = useState("");
  const [token, setToken] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [allowRemoteChat, setAllowRemoteChat] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const cfg = await loadConfig();
      if (cfg) {
        setWsUrl(cfg.ws_url);
        setEnabled(cfg.enabled);
      }
      const t = await loadToken();
      if (t) setToken(t);
      const allow = await loadAllowRemoteChat();
      setAllowRemoteChat(allow);
      setLoaded(true);
    })();
  }, []);

  async function handleConnect() {
    const cfg: CoordinatorConfig = { ws_url: wsUrl, enabled: true };
    await saveConfig(cfg);
    if (token) await saveToken(token);
    setEnabled(true);
    setSavedMsg("已连接");
  }

  async function handleDisconnect() {
    await saveConfig({ ws_url: wsUrl, enabled: false });
    setEnabled(false);
    setSavedMsg("已断开");
  }

  async function handleClearToken() {
    await clearToken();
    setToken("");
    setSavedMsg("Token 已清除");
  }

  if (!loaded) return <div className="p-4">载入中…</div>;

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">Coordinator 连接</h2>

      <p className="text-sm text-gray-600">
        把扩展作为 worker 接到一个 coordinator（本地 daemon 或远程 server）。Phase 2
        仅支持手动 paste token；6 位配对码 + daemon UX 在 Phase 3 完成。
      </p>

      <label className="block">
        <span className="text-sm font-medium">WS URL</span>
        <input
          type="text"
          className="mt-1 block w-full rounded border px-2 py-1"
          placeholder="ws://localhost:7842/worker"
          value={wsUrl}
          onChange={(e) => setWsUrl(e.target.value)}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Token</span>
        <input
          type="password"
          className="mt-1 block w-full rounded border px-2 py-1"
          placeholder="wpk_..."
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
      </label>

      <div className="flex gap-2">
        {enabled ? (
          <button
            type="button"
            className="rounded bg-gray-200 px-3 py-1 text-sm"
            onClick={handleDisconnect}
          >
            断开
          </button>
        ) : (
          <button
            type="button"
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
            disabled={!wsUrl || !token}
            onClick={handleConnect}
          >
            连接
          </button>
        )}
        {token && (
          <button
            type="button"
            className="rounded bg-red-100 px-3 py-1 text-sm text-red-700"
            onClick={handleClearToken}
          >
            清 Token
          </button>
        )}
      </div>

      {savedMsg && <div className="text-sm text-green-700">{savedMsg}</div>}

      <label className="flex items-start gap-2 border-t pt-3">
        <input
          type="checkbox"
          className="mt-1"
          checked={allowRemoteChat}
          onChange={async (e) => {
            const v = e.target.checked;
            setAllowRemoteChat(v);
            await saveAllowRemoteChat(v);
          }}
        />
        <span className="text-sm">
          允许 coordinator 远程驱动 chat session 和危险工具
          <br />
          <span className="text-xs text-gray-500">
            开启后，连接的 coordinator 可以在你的浏览器里运行任意工具。仅在你信任该 coordinator 时勾选。
          </span>
        </span>
      </label>

      <div className="border-t pt-3 text-xs text-gray-500">
        <div>状态: {enabled ? "已配置（启用）" : "已配置（关闭）"}</div>
        <div>连接状态请看 chrome://serviceworker-internals 或 SW 日志。Phase 3 会接入实时状态推送。</div>
      </div>
    </div>
  );
}

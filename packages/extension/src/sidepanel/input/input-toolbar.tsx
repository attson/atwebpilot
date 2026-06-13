import { useState } from "react";
import type { AttachedTab } from "@atwebpilot/shared/types";
import type { PermissionMode } from "../chat/severity";
import { AboveInputTabs } from "./above-input-tabs";
import { InputBox } from "./input-box";
import { MentionPicker, type MentionTabOption } from "./mention-picker";
import { PermissionModePill } from "./permission-mode-pill";

export type InputStatus = "idle" | "streaming" | "awaiting" | "error";

type Props = {
  // input state
  value: string;
  onChange: (v: string) => void;
  onSubmit: (text: string) => void;
  onStop: () => void;

  // chips
  currentTabUrl: string;
  attachedTabs: AttachedTab[];
  pickableTabs: MentionTabOption[];
  onAttachTab: (opt: MentionTabOption) => void;
  onDetachTab: (tabId: number) => void;
  onOpenTabPicker: () => void;

  // permission mode
  permissionMode: PermissionMode;
  onPermissionChange: (m: PermissionMode) => void;
  trustedDangerTools: string[];
  onTrustedChange: (next: string[]) => void;

  // status meta
  status: InputStatus;
  roundCount: number;
  maxRounds: number;
  tokensIn: number;
  tokensOut: number;
};

function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return k >= 100 ? `${Math.round(k)}k` : `${k.toFixed(1)}k`;
}

export function InputToolbar(props: Props) {
  const [mentionOpen, setMentionOpen] = useState(false);
  const tokenTotal = props.tokensIn + props.tokensOut;

  return (
    <div className="bg-zinc-950">
      <AboveInputTabs
        currentTabUrl={props.currentTabUrl}
        attachedTabs={props.attachedTabs}
        onDetach={props.onDetachTab}
        onAddTab={props.onOpenTabPicker}
      />

      <div className="border-t border-zinc-800 bg-zinc-900 px-3 py-2 space-y-2 relative">
        <InputBox
          value={props.value}
          onChange={props.onChange}
          onSubmit={() => props.onSubmit(props.value)}
          onAtTrigger={() => setMentionOpen(true)}
          disabled={props.status === "streaming"}
        />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 relative">
            <PermissionModePill
              mode={props.permissionMode}
              onChange={props.onPermissionChange}
              trustedDangerTools={props.trustedDangerTools}
              onTrustedChange={props.onTrustedChange}
            />
            <button
              type="button"
              aria-label="@ 引用 tab"
              className="px-2 py-1 rounded-md text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 text-[11px]"
              onClick={() => setMentionOpen((o) => !o)}
            >
              @
            </button>
            {mentionOpen && (
              <MentionPicker
                tabs={props.pickableTabs}
                onPick={(opt) => {
                  setMentionOpen(false);
                  props.onAttachTab(opt);
                }}
                onClose={() => setMentionOpen(false)}
              />
            )}
          </div>

          <div className="flex items-center gap-2 text-[10px]">
            {props.roundCount > 0 && (
              <span className="text-zinc-500" data-testid="round-pill">
                {props.roundCount}/{props.maxRounds}
              </span>
            )}
            {tokenTotal > 0 && (
              <span className="text-zinc-500" data-testid="token-meter">
                {formatTokens(tokenTotal)}
              </span>
            )}
            {props.status === "streaming" ? (
              <button
                type="button"
                onClick={props.onStop}
                aria-label="停止"
                className="px-3 py-1 rounded-md bg-red-900 text-red-100 text-[12px] hover:bg-red-800"
              >
                ■
              </button>
            ) : (
              <button
                type="button"
                aria-label="发送"
                disabled={!props.value.trim()}
                onClick={() => props.onSubmit(props.value)}
                className="px-3 py-1 rounded-md bg-blue-700 text-white text-[12px] hover:bg-blue-600 disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                ↑
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

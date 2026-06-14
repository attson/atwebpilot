import { useRef, useState } from "react";
import type { AttachedTab, ImagePart } from "@atwebpilot/shared/types";
import type { PermissionMode } from "../chat/severity";
import { StagedImages } from "../components/staged-images";
import { AboveInputTabs } from "./above-input-tabs";
import { InputBox } from "./input-box";
import {
  MentionPicker,
  type MentionTabOption,
  type MentionToolOption,
  type MentionBookmarkOption,
} from "./mention-picker";
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
  pickableTools: MentionToolOption[];
  pickableBookmarks: MentionBookmarkOption[];
  onAttachTab: (opt: MentionTabOption) => void;
  onMentionTool: (opt: MentionToolOption) => void;
  onMentionBookmark: (opt: MentionBookmarkOption) => void;
  onDetachTab: (tabId: number) => void;
  onOpenTabPicker: () => void;

  // permission mode
  permissionMode: PermissionMode;
  onPermissionChange: (m: PermissionMode) => void;
  trustedDangerTools: string[];
  onTrustedChange: (next: string[]) => void;

  // images
  stagedImages: ImagePart[];
  onImageFiles: (files: File[]) => void;
  onRemoveImage: (idx: number) => void;

  /** "选元素" 按钮回调（向 content script 发 startCapture） */
  onStartCapture: () => void;

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
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-zinc-950">
      <AboveInputTabs
        currentTabUrl={props.currentTabUrl}
        attachedTabs={props.attachedTabs}
        onDetach={props.onDetachTab}
        onAddTab={props.onOpenTabPicker}
      />
      <StagedImages images={props.stagedImages} onRemove={props.onRemoveImage} />

      <div className="border-t border-zinc-800 bg-zinc-900 px-3 py-2 space-y-2 relative">
        <InputBox
          value={props.value}
          onChange={props.onChange}
          onSubmit={() => props.onSubmit(props.value)}
          onAtTrigger={() => setMentionOpen(true)}
          onImageFiles={props.onImageFiles}
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
            <button
              type="button"
              aria-label="加图片"
              className="px-2 py-1 rounded-md text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 text-[11px]"
              onClick={() => fileRef.current?.click()}
            >
              📎
            </button>
            <button
              type="button"
              aria-label="选元素"
              title="点页面任意元素，selector 自动回填"
              className="px-2 py-1 rounded-md text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 text-[11px]"
              onClick={props.onStartCapture}
            >
              🎯
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              multiple
              hidden
              onChange={(e) => {
                const list = e.target.files;
                if (!list || list.length === 0) return;
                props.onImageFiles(Array.from(list));
                e.target.value = "";
              }}
            />
            {mentionOpen && (
              <MentionPicker
                tabs={props.pickableTabs}
                tools={props.pickableTools}
                bookmarks={props.pickableBookmarks}
                onPickTab={(opt) => {
                  setMentionOpen(false);
                  props.onAttachTab(opt);
                }}
                onPickTool={(opt) => {
                  setMentionOpen(false);
                  props.onMentionTool(opt);
                }}
                onPickBookmark={(opt) => {
                  setMentionOpen(false);
                  props.onMentionBookmark(opt);
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

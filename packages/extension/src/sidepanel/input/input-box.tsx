import { useEffect, useRef } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onAtTrigger?: () => void;
  /** Called when the user pastes, drops or picks image files. Caller is
   *  responsible for size/type validation + staging. */
  onImageFiles?: (files: File[]) => void;
  canSubmit?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** 右下角浮动动作槽位（如「优化提示词」按钮）。有值时 textarea 自动 padding 让位。 */
  rightAction?: React.ReactNode;
};

const MIN_PX = 56;
const MAX_PX = 200;

/**
 * Auto-growing multi-line textarea.
 * - Enter sends (`onSubmit`); Shift+Enter inserts a newline.
 * - Typing `@` calls `onAtTrigger` to surface the mention picker.
 */
export function InputBox({
  value,
  onChange,
  onSubmit,
  onAtTrigger,
  onImageFiles,
  canSubmit,
  disabled,
  placeholder,
  rightAction,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function imagesFromClipboard(items: DataTransferItemList | null): File[] {
    const out: File[] = [];
    if (!items) return out;
    for (const it of Array.from(items)) {
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f && f.type.startsWith("image/")) out.push(f);
      }
    }
    return out;
  }
  function imagesFromList(files: FileList | null): File[] {
    if (!files) return [];
    return Array.from(files).filter((f) => f.type.startsWith("image/"));
  }

  useEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.style.height = "auto";
    const next = Math.min(MAX_PX, Math.max(MIN_PX, t.scrollHeight));
    t.style.height = `${next}px`;
  }, [value]);

  return (
    <div className="relative">
      <textarea
        ref={ref}
        data-testid="input-box"
        value={value}
        disabled={disabled}
        placeholder={placeholder ?? "告诉 AI 你要做什么…"}
        onChange={(e) => {
          const next = e.target.value;
          if (onAtTrigger && next.length > value.length && next.endsWith("@")) {
            onAtTrigger();
          }
          onChange(next);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !disabled) {
            e.preventDefault();
            if (canSubmit ?? !!value.trim()) onSubmit();
          }
        }}
        onPaste={(e) => {
          if (!onImageFiles) return;
          const imgs = imagesFromClipboard(e.clipboardData?.items ?? null);
          if (imgs.length > 0) {
            e.preventDefault();
            onImageFiles(imgs);
          }
        }}
        onDragOver={(e) => {
          if (onImageFiles) e.preventDefault();
        }}
        onDrop={(e) => {
          if (!onImageFiles) return;
          const imgs = imagesFromList(e.dataTransfer?.files ?? null);
          if (imgs.length > 0) {
            e.preventDefault();
            onImageFiles(imgs);
          }
        }}
        className={`w-full resize-none bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-[12px] placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-700 disabled:opacity-50 ${rightAction ? "pr-8 pb-6" : ""}`}
        style={{ minHeight: MIN_PX, maxHeight: MAX_PX }}
      />
      {rightAction}
    </div>
  );
}

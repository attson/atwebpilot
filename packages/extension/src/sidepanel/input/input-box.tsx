import { useEffect, useRef } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onAtTrigger?: () => void;
  disabled?: boolean;
  placeholder?: string;
};

const MIN_PX = 56;
const MAX_PX = 200;

/**
 * Auto-growing multi-line textarea.
 * - Enter sends (`onSubmit`); Shift+Enter inserts a newline.
 * - Typing `@` calls `onAtTrigger` to surface the mention picker.
 */
export function InputBox({ value, onChange, onSubmit, onAtTrigger, disabled, placeholder }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.style.height = "auto";
    const next = Math.min(MAX_PX, Math.max(MIN_PX, t.scrollHeight));
    t.style.height = `${next}px`;
  }, [value]);

  return (
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
          if (value.trim()) onSubmit();
        }
      }}
      className="w-full resize-none bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-[12px] placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-700 disabled:opacity-50"
      style={{ minHeight: MIN_PX, maxHeight: MAX_PX }}
    />
  );
}

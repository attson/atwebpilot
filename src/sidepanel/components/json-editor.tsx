import { useState } from "react";

export function JsonEditor(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <textarea
        spellCheck={false}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => {
          props.onChange(e.target.value);
          try {
            if (e.target.value.trim()) JSON.parse(e.target.value);
            setErr(null);
          } catch (er) {
            setErr(er instanceof Error ? er.message : String(er));
          }
        }}
        className="w-full h-64 p-2 font-mono text-xs bg-zinc-900 text-zinc-100 rounded border border-zinc-800"
      />
      {err && <span className="text-red-400 text-xs">JSON parse: {err}</span>}
    </div>
  );
}

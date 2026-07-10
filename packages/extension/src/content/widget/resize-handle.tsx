import { useRef } from "react";

type Props = {
  size: { w: number; h: number };
  onResize: (w: number, h: number) => void;
  onCommit: (w: number, h: number) => void;
  minW?: number; minH?: number; maxW?: number; maxH?: number;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function ResizeHandle({
  size, onResize, onCommit,
  minW = 320, minH = 360, maxW = 720, maxH = 900,
}: Props) {
  const dragRef = useRef<{ startX: number; startY: number; w0: number; h0: number } | null>(null);
  const latestRef = useRef({ w: size.w, h: size.h });

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, w0: size.w, h0: size.h };
    latestRef.current = { w: size.w, h: size.h };
    (e.target as Element).setPointerCapture?.(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    // Widget is anchored at right:X, bottom:Y — dragging bottom-right corner
    // means dx>0 SHRINKS width (panel is to the left of cursor). To match
    // intuition, invert dx.
    const w = clamp(dragRef.current.w0 - dx, minW, maxW);
    const h = clamp(dragRef.current.h0 + dy, minH, maxH);
    latestRef.current = { w, h };
    onResize(w, h);
  }

  function onPointerUp() {
    if (!dragRef.current) return;
    dragRef.current = null;
    onCommit(latestRef.current.w, latestRef.current.h);
  }

  return (
    <div
      data-testid="widget-resize-handle"
      className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        background:
          "linear-gradient(-45deg, transparent 40%, rgb(113 113 122) 40%, rgb(113 113 122) 45%, transparent 45%, transparent 55%, rgb(113 113 122) 55%, rgb(113 113 122) 60%, transparent 60%)",
      }}
    />
  );
}

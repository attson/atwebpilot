import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { FAB } from "./fab";
import { startWidgetStoreSync } from "./store";

function WidgetApp() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <FAB onToggle={() => setOpen((v) => !v)} active={open} />
      {/* Panel added in Task 11 */}
      {open && (
        <div
          style={{
            position: "fixed",
            right: 72,
            bottom: 16,
            zIndex: 2147483645,
          }}
          className="w-[320px] h-[480px] bg-zinc-900 text-zinc-100 rounded-lg border border-zinc-700 shadow-2xl flex items-center justify-center"
        >
          <span className="text-xs text-zinc-400">Panel — Task 11 will fill this</span>
        </div>
      )}
    </>
  );
}

export function bootstrap(shadow: ShadowRoot): () => void {
  const container = document.createElement("div");
  shadow.appendChild(container);
  const root = ReactDOM.createRoot(container);
  const dispose = startWidgetStoreSync();
  root.render(
    <React.StrictMode>
      <WidgetApp />
    </React.StrictMode>
  );
  return () => {
    root.unmount();
    dispose();
    container.remove();
  };
}

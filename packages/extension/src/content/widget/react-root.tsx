import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { FAB } from "./fab";
import { Panel } from "./panel";
import { startWidgetStoreSync } from "./store";

function WidgetApp() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <FAB onToggle={() => setOpen((v) => !v)} active={open} />
      {open && (
        <Panel onClose={() => setOpen(false)} onMinimize={() => setOpen(false)} />
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

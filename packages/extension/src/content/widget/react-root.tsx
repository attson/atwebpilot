import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { FAB } from "./fab";
import { Panel } from "./panel";
import { startWidgetStoreSync } from "./store";
import { installApprovalListener } from "@/sidepanel/chat/approval";

function WidgetApp() {
  const [open, setOpen] = useState(false);

  // Install cross-process approval relay: decisions from sidepanel are
  // forwarded into the widget's local approversByTab map (and vice-versa
  // via WidgetApprover.resolve → broadcastApprovalDecision).
  useEffect(() => {
    return installApprovalListener();
  }, []);

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

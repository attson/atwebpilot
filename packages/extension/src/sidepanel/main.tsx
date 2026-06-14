import React from "react";
import ReactDOM from "react-dom/client";
import { AppShell } from "./shell/app-shell";
import { ThemeProvider } from "./shell/theme-provider";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  </React.StrictMode>
);

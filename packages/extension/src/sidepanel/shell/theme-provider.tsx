import { useEffect } from "react";
import { useSettings } from "@/sidepanel/chat/settings-store";

export type Theme = "light" | "dark" | "system";

function systemPrefers(): "light" | "dark" {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(resolved: "light" | "dark") {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", resolved);
}

/**
 * Reads `settings.theme` (`light` / `dark` / `system`) and writes
 * `data-theme="light|dark"` to `<html>`. The Tailwind zinc palette in
 * `theme.css` consumes that attribute via CSS variables.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSettings((s) => s.theme);
  const loaded = useSettings((s) => s.loaded);
  const load = useSettings((s) => s.load);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  useEffect(() => {
    const t: Theme = theme ?? "dark";
    if (t !== "system") {
      apply(t);
      return;
    }
    apply(systemPrefers());
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => apply(systemPrefers());
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [theme]);

  return <>{children}</>;
}

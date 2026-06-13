import { CoordinatorSettingsPage } from "@/sidepanel/pages/coordinator-settings-page";

/**
 * Thin wrapper that embeds the existing CoordinatorSettingsPage as a section
 * inside SettingsDrawer. Keeps the (complex) coordinator state machine code
 * in one place during refactor; can be inlined later if pages/ is fully retired.
 */
export function SectionCoordinator() {
  return (
    <section className="bg-zinc-900 rounded p-1 text-xs">
      <CoordinatorSettingsPage />
    </section>
  );
}

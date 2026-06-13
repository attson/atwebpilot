import { useEffect } from "react";
import { useSettings } from "@/sidepanel/chat/settings-store";
import { useUi } from "@/sidepanel/chat/ui-store";
import { Drawer } from "@/sidepanel/shell/drawer";
import { SectionLlm } from "./settings/section-llm";
import { SectionPermissions } from "./settings/section-permissions";
import { SectionMounting } from "./settings/section-mounting";
import { SectionCoordinator } from "./settings/section-coordinator";
import { SectionAdvanced } from "./settings/section-advanced";

export function SettingsDrawer() {
  const opened = useUi((s) => s.openedDrawer);
  const close = useUi((s) => s.close);
  const settings = useSettings();
  const open = opened === "settings";

  useEffect(() => {
    if (open && !settings.loaded) void settings.load();
  }, [open, settings]);

  return (
    <Drawer open={open} title="设置" onClose={close}>
      <div className="p-3 flex flex-col gap-3">
        <SectionLlm />
        <SectionPermissions />
        <SectionMounting />
        <SectionCoordinator />
        <SectionAdvanced />
      </div>
    </Drawer>
  );
}

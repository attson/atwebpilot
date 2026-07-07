import { useUi } from "@/sidepanel/chat/ui-store";
import { Drawer } from "@/sidepanel/shell/drawer";
import { ScenariosPage } from "@/sidepanel/pages/scenarios-page";

export function ScenariosDrawer() {
  const opened = useUi((s) => s.openedDrawer);
  const close = useUi((s) => s.close);
  const isOpen = opened === "scenarios";

  return (
    <Drawer open={isOpen} title="场景库" onClose={close}>
      {isOpen && <ScenariosPage />}
    </Drawer>
  );
}

import { afterEach, describe, expect, it } from "vitest";
import { useUi } from "@/sidepanel/chat/ui-store";

afterEach(() => {
  useUi.getState().close();
});

describe("ui-store", () => {
  it("starts closed", () => {
    expect(useUi.getState().openedDrawer).toBeNull();
    expect(useUi.getState().drawerSubPath).toBeNull();
  });

  it("opens and closes a drawer", () => {
    useUi.getState().open("history");
    expect(useUi.getState().openedDrawer).toBe("history");
    useUi.getState().close();
    expect(useUi.getState().openedDrawer).toBeNull();
  });

  it("carries subPath for tool detail", () => {
    useUi.getState().open("tools", "tool-id-42");
    expect(useUi.getState().drawerSubPath).toBe("tool-id-42");
    useUi.getState().close();
    expect(useUi.getState().drawerSubPath).toBeNull();
  });

  it("switching drawers resets subPath", () => {
    useUi.getState().open("tools", "tool-id-42");
    useUi.getState().open("history");
    expect(useUi.getState().openedDrawer).toBe("history");
    expect(useUi.getState().drawerSubPath).toBeNull();
  });
});

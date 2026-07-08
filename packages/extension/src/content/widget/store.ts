import { installBroadcastSubscriber } from "@/sidepanel/chat/session-store";

// Widget directly imports sidepanel session-store; because widget is an
// independent bundle it gets its own zustand instance.  State is kept in
// sync across the two instances via chrome.runtime broadcast messages.
export function startWidgetStoreSync(): () => void {
  return installBroadcastSubscriber();
}

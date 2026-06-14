import { create } from "zustand";

export type AskUserKind = "select" | "confirm" | "text";

export type AskUserOption = { id: string; label: string; description?: string };

export type AskUserRequest = {
  id: string;
  prompt: string;
  kind: AskUserKind;
  options?: AskUserOption[];
};

export type AskUserResult =
  | { cancelled: true }
  | { kind: "select"; choice: string }
  | { kind: "confirm"; ok: boolean }
  | { kind: "text"; value: string };

type Pending = {
  request: AskUserRequest;
  resolve: (r: AskUserResult) => void;
};

type State = {
  current: Pending | null;
  ask: (req: AskUserRequest) => Promise<AskUserResult>;
  resolve: (r: AskUserResult) => void;
  cancel: () => void;
};

let counter = 0;
function nextId(): string {
  counter += 1;
  return `ask-${counter}`;
}

export const useIntervention = create<State>((set, get) => ({
  current: null,
  ask: (req) => {
    return new Promise<AskUserResult>((resolve) => {
      const id = req.id ?? nextId();
      const reqWithId = { ...req, id };
      set({ current: { request: reqWithId, resolve } });
    });
  },
  resolve: (r) => {
    const cur = get().current;
    if (!cur) return;
    cur.resolve(r);
    set({ current: null });
  },
  cancel: () => {
    const cur = get().current;
    if (!cur) return;
    cur.resolve({ cancelled: true });
    set({ current: null });
  },
}));

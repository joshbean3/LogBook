import type { AssistantProposal, AssistantThread, AssistantTurn } from '@logbook/shared';
import { useSyncExternalStore } from 'react';

/**
 * The conversation as this device shows it: the server's live thread (docs/system.md §7), hydrated from
 * `GET /assistant/thread`, plus the turn being typed and the reply as it streams in. Nothing is kept in storage: the
 * server holds the thread, so closing the sheet, reloading or opening another device never loses it.
 */
export interface StreamingTurn {
  text: string;
}
interface State {
  threadId: string | null;
  turns: AssistantTurn[];
  /** The reply arriving now, while it arrives. */
  streaming: StreamingTurn | null;
  busy: boolean;
}
let state: State = { threadId: null, turns: [], streaming: null, busy: false };
const subs = new Set<() => void>();
const set = (next: Partial<State>) => {
  state = { ...state, ...next };
  subs.forEach((f) => f());
};

export const assistantStore = {
  get: () => state,
  /** The server's thread, as loaded or after a new one starts. A reply in flight keeps its place. */
  hydrate: (t: AssistantThread) => {
    if (state.busy && state.threadId === t.id) return;
    set({ threadId: t.id, turns: t.turns });
  },
  push: (t: AssistantTurn) => set({ turns: [...state.turns, t] }),
  setBusy: (busy: boolean) => set({ busy, streaming: busy ? state.streaming : null }),
  stream: (delta: string) => set({ streaming: { text: (state.streaming?.text ?? '') + delta } }),
  endStream: () => set({ streaming: null }),
  setProposal: (p: AssistantProposal) => set({ turns: state.turns.map((t) => (t.proposal?.id === p.id ? { ...t, proposal: p } : t)) }),
  reset: (threadId: string | null) => set({ threadId, turns: [], streaming: null }),
  subscribe: (f: () => void) => {
    subs.add(f);
    return () => void subs.delete(f);
  },
};

export const useAssistantState = () => useSyncExternalStore(assistantStore.subscribe, assistantStore.get, assistantStore.get);
export const useAssistantTurns = () => useAssistantState().turns;

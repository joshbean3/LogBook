import type { AssistantProposal, AssistantTurn, Attachment } from '@logbook/shared';
import { useSyncExternalStore } from 'react';

/**
 * The conversation with the assistant, kept for the session (and across a reload, in sessionStorage) so closing the sheet
 * never loses it. One conversation; "New" clears it.
 */
const KEY = 'logbook.assistant';
let turns: AssistantTurn[] = (() => {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? (v as AssistantTurn[]) : [];
  } catch {
    return [];
  }
})();
const subs = new Set<() => void>();
/**
 * The files sent with a user turn, kept in memory only (sessionStorage keeps the names and small previews): the assistant
 * can look again at a photo for as long as the app is open.
 */
const fileData = new WeakMap<AssistantTurn, Attachment[]>();
const emit = () => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(turns.slice(-40)));
  } catch {
    /* private mode: kept in memory only */
  }
  subs.forEach((f) => f());
};

export const assistantStore = {
  get: () => turns,
  push: (t: AssistantTurn, files?: Attachment[]) => {
    if (files?.length) fileData.set(t, files);
    turns = [...turns, t];
    emit();
  },
  filesOf: (t: AssistantTurn) => fileData.get(t),
  setProposal: (p: AssistantProposal) => {
    turns = turns.map((t) => (t.proposal?.id === p.id ? { ...t, proposal: p } : t));
    emit();
  },
  clear: () => {
    turns = [];
    emit();
  },
  subscribe: (f: () => void) => {
    subs.add(f);
    return () => void subs.delete(f);
  },
};

export const useAssistantTurns = () => useSyncExternalStore(assistantStore.subscribe, assistantStore.get, assistantStore.get);

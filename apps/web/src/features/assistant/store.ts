import type { AssistantLive, AssistantProposal, AssistantTurn, Attachment } from '@logbook/shared';
import { useSyncExternalStore } from 'react';

/**
 * The conversation with the assistant, kept for the session (and across a reload, in sessionStorage) so closing the sheet
 * never loses it. One conversation; "New" clears it. Whether an ask is out (and since when) lives here too, so closing
 * the sheet and opening it again still shows it working.
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
/** When the ask now out started (ms), or null. Memory only: a reload loses the job anyway. */
let busySince: number | null = null;
/** The answer being written (its words so far, what it is doing), and the job to stop it by. Memory only. */
let live: AssistantLive | null = null;
let jobId: string | null = null;
/** Bumped by "New": an answer that comes back for a cleared conversation is dropped. */
let generation = 0;
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
  busySince: () => busySince,
  generation: () => generation,
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
  /** Takes off the last turn when it is an ask that did not go through (Retry sends again without it). */
  dropError: () => {
    if (!turns[turns.length - 1]?.error) return;
    turns = turns.slice(0, -1);
    emit();
  },
  setBusy: (since: number | null) => {
    busySince = since;
    if (since === null) {
      live = null;
      jobId = null;
    }
    subs.forEach((f) => f());
  },
  live: () => live,
  setLive: (l: AssistantLive | null) => {
    live = l;
    subs.forEach((f) => f());
  },
  jobId: () => jobId,
  setJob: (id: string | null) => {
    jobId = id;
  },
  /** Takes off the last assistant turn (Regenerate asks again without it). */
  dropLastAnswer: () => {
    if (turns[turns.length - 1]?.role !== 'assistant') return;
    turns = turns.slice(0, -1);
    emit();
  },
  clear: () => {
    turns = [];
    generation++;
    busySince = null;
    live = null;
    jobId = null;
    emit();
  },
  subscribe: (f: () => void) => {
    subs.add(f);
    return () => void subs.delete(f);
  },
};

export const useAssistantTurns = () => useSyncExternalStore(assistantStore.subscribe, assistantStore.get, assistantStore.get);
export const useAssistantBusy = () => useSyncExternalStore(assistantStore.subscribe, assistantStore.busySince, assistantStore.busySince);

export const useAssistantLive = () => useSyncExternalStore(assistantStore.subscribe, assistantStore.live, assistantStore.live);

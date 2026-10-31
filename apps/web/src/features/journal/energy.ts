import { useSyncExternalStore } from 'react';

/**
 * The day's energy (1 to 5), the one datum the logbook adds to what happened. The API has no field for it yet, so it lives in
 * this browser's localStorage under one key (a map of date to value); nothing is written into the entry's text. When the
 * server grows an `energy` column on a day record, this store is what to replace.
 */
const KEY = 'logbook.energy';
type Map = Record<string, number>;
let cache: Map | null = null;
let version = 0;
const listeners = new Set<() => void>();

const read = (): Map => {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Map) : {};
  } catch {
    cache = {};
  }
  return cache;
};

export const getEnergy = (date: string): number | null => read()[date] ?? null;

export const setEnergy = (date: string, value: number | null): void => {
  const m = { ...read() };
  if (value == null) delete m[date];
  else m[date] = value;
  cache = m;
  version++;
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* private mode: it holds for this session */
  }
  for (const cb of [...listeners]) cb();
};

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/** The day's energy, live. */
export const useEnergy = (date: string): number | null => useSyncExternalStore(subscribe, () => getEnergy(date), () => null);

/** A number that changes on any day's energy change, for a list that reads many days through `getEnergy`. */
export const useEnergyVersion = (): number => useSyncExternalStore(subscribe, () => version, () => 0);

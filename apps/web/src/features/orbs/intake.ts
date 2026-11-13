import { shiftDays, type ISODate } from '@logbook/shared';

/**
 * What a bootstrap from the network brought for Orbs, taken off it before it is cached (`fetchBootstrap`, as `serverTime`
 * is): the account's copy of the Orbs store, and the server's time. Kept apart from the cached bootstrap so its identity
 * does not change with every sync, and kept in memory only: a bootstrap read from the phone's saved copy says nothing here.
 *
 * `has` is the capability: `'rewards' in bootstrap`. A server from before Orbs sends no such key, and the phone then makes
 * no request for rewards at all. Nothing is known until this session's first answer from the network.
 */
export interface Intake {
  /** The server keeps a copy (the key is there, even when its value is null). */
  has: boolean;
  /** The account's copy as it came: untrusted, read with `parseRewards`. */
  rewards: unknown;
  /** Which answer this is, counted from 1. */
  n: number;
}
let intake: Intake | null = null;
/** The server's clock at the last answer, and this device's steady clock at that moment. */
let server: { ms: number; tick: number } | null = null;
const listeners = new Set<(i: Intake) => void>();
const tick = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());

/** Called by `fetchBootstrap` with the raw answer, before `rewards` and `serverTime` are dropped from it. */
export const takeBootstrap = (raw: Record<string, unknown>) => {
  const at = typeof raw.serverTime === 'string' ? Date.parse(raw.serverTime) : NaN;
  if (!Number.isNaN(at)) server = { ms: at, tick: tick() };
  intake = { has: 'rewards' in raw, rewards: raw.rewards ?? null, n: (intake?.n ?? 0) + 1 };
  for (const f of listeners) f(intake);
};
export const getIntake = (): Intake | null => intake;
export const onIntake = (f: (i: Intake) => void) => {
  listeners.add(f);
  return () => void listeners.delete(f);
};
/** May this phone ask the server about rewards? Only once a bootstrap from the network has carried the key. */
export const canSyncOrbs = (): boolean => intake?.has === true;

/** How long a server time is trusted for: after this the device's own date stands alone. */
const FRESH_MS = 36 * 3600_000;
/**
 * The server's date now (UTC), from its last answer plus the time this device's steady clock says has passed since, so it
 * does not move when the device's date is changed by hand. Undefined when no answer came this session, or it is too old to
 * lean on: a day beyond this date plus one does not count (`reconcile`).
 */
export const serverDayNow = (): ISODate | undefined => {
  if (!server) return undefined;
  const passed = tick() - server.tick;
  if (passed < 0 || passed > FRESH_MS) return undefined;
  return new Date(server.ms + passed).toISOString().slice(0, 10);
};
/** The last day this device's date may be and still count: the server's date plus one (a phone ahead of UTC). */
export const lastDayAllowed = (): ISODate | undefined => {
  const d = serverDayNow();
  return d ? shiftDays(d, 1) : undefined;
};

/** Tests only. */
export const resetIntakeForTest = () => {
  intake = null;
  server = null;
  listeners.clear();
};

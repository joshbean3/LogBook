import { compact, forSync, mergeRewards, parseRewards, sameRewards, tidy, type Rewards } from '@logbook/shared';
import { api, beforeSignOut } from '@/api/client';
import { isLeaving } from '@/lib/account';
import { canSyncOrbs, getIntake, onIntake, type Intake } from './intake';
import { getOrbs, onOrbsChange, orbsOwner, persistOrbs, setOrbs } from './store';

/**
 * The account's copy of the Orbs store, as a progressive extra (the pattern of api/prefsSync.ts). The phone's own copy is
 * the one the app reads, so everything works against a server that has never heard of `PUT /me/rewards`.
 *
 * - **The capability is `'rewards' in bootstrap`** (intake.ts), from an answer of this session. Without it this module
 *   makes no request at all, ever: an older server would answer 404 to each one.
 * - **Never through the outbox.** The outbox reads a 404 as a change that could not be saved and says so in a toast. A
 *   send here that fails is dropped without a word and tried again after the next change, or the next time the app is
 *   hidden or opened: the whole store goes each time and the server merges, so nothing is lost by a miss.
 * - **What goes:** closed days and the ledgers (`forSync`). Open days are never sent: each phone recomputes them from the
 *   synced facts. Only for the signed-in account: a store that is not this account's is neither sent nor merged.
 * - **What comes back** is the merged store. It is merged into this phone's with the same shared `mergeRewards`.
 * - **When:** a while after a change that touched what is sent (idle), when the page is hidden, and once before Sign out
 *   (2.5 s at most), which is the last moment the session can still carry it.
 */
const IDLE_MS = 2500;
/** What the last send carried, by the parts that are sent: a change to an open day alone sends nothing. */
let sent: Rewards | null = null;
let timer: ReturnType<typeof setTimeout> | 0 = 0;
let inFlight: Promise<void> | null = null;
let started = false;

/** Is there something the server has not been told? The maps are compared by identity (they are replaced, never edited) and the closed days by their count. */
const closedCount = (s: Rewards) => {
  let n = 0;
  for (const d in s.days) if (s.days[d]!.c) n++;
  return n;
};
const differs = (a: Rewards, b: Rewards | null): boolean =>
  !b || a.once !== b.once || a.challenges !== b.challenges || a.keepsakes !== b.keepsakes || a.off !== b.off || a.set !== b.set || a.wt !== b.wt || a.seen !== b.seen || a.startedOn !== b.startedOn || closedCount(a) !== closedCount(b);

/**
 * Merge the account's copy into this phone's. `theirs` is untrusted (the bootstrap, or the route's answer). The store in
 * memory keeps its identity when the merge brings nothing new. Returns whether the server's copy already holds everything
 * this phone would send, or null when there was nothing to merge.
 */
const adopt = (theirs: unknown): { told: boolean } | null => {
  const uid = orbsOwner();
  const mine = getOrbs();
  if (!uid || !mine) return null;
  const parsed = parseRewards(theirs, uid);
  if (!parsed) return null;
  const merged = tidy(mergeRewards(mine, parsed));
  if (!sameRewards(merged, mine)) setOrbs(merged);
  return { told: sameRewards(forSync(compact(merged, merged.clock)), parsed) };
};

/** One send of the whole store, if there is anything to say. Resolves either way; never throws; never toasts. */
export const sendOrbs = (): Promise<void> => {
  if (inFlight) return inFlight;
  const mine = getOrbs();
  if (!canSyncOrbs() || !mine || isLeaving() || mine.userId !== orbsOwner() || !differs(mine, sent)) return Promise.resolve();
  const body = forSync(compact(mine, mine.clock));
  inFlight = api<{ rewards?: unknown }>('/me/rewards', { method: 'PUT', json: body })
    .then(
      (r) => {
        // changed while the request was out: that change is told by the next send
        const quiet = getOrbs() === mine;
        sent = mine;
        const a = adopt(r?.rewards);
        if (quiet && a?.told) sent = getOrbs();
      },
      // a failure of any kind is dropped without a word: the whole store goes again after the next change
      () => undefined,
    )
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
};

const sendSoon = () => {
  if (timer || !canSyncOrbs()) return;
  timer = setTimeout(() => {
    timer = 0;
    void sendOrbs();
  }, IDLE_MS);
};

/** Which bootstrap answer has been taken in (an answer can arrive before the store is opened: it then waits for it). */
let handled = 0;
/** The bootstrap brought the account's copy: take it in, and tell the server what it does not have. */
const onBootstrap = (i: Intake) => {
  if (!i.has || !getOrbs() || i.n === handled) return;
  handled = i.n;
  const a = i.rewards ? adopt(i.rewards) : null;
  if (a?.told) sent = getOrbs();
  else sendSoon();
};

/**
 * Start once, when the shell mounts. Until a bootstrap of this session says the server keeps a copy, nothing here asks
 * it anything.
 */
export const startOrbsSync = () => {
  if (started) return;
  started = true;
  onIntake(onBootstrap);
  onOrbsChange(() => {
    const mine = getOrbs();
    if (!mine || !canSyncOrbs()) return;
    const waiting = getIntake();
    if (waiting && waiting.n !== handled) return onBootstrap(waiting);
    if (differs(mine, sent)) sendSoon();
  });
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function')
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void sendOrbs();
    });
  // Sign out: one send while the session can still carry it, then the wipe (lib/account.ts) takes the device's copy
  beforeSignOut.add(async () => {
    persistOrbs();
    await sendOrbs();
  });
};

/** Tests only. */
export const resetOrbsSyncForTest = () => {
  sent = null;
  if (timer) clearTimeout(timer);
  timer = 0;
  inFlight = null;
  started = false;
  handled = 0;
};

/**
 * Progress's context row and status words (docs/shape-system.md §3, context chips; §2, status words): where runs come from and
 * when Strava last answered, the block the day belongs to, and how a metric's status reads on a tile. Pure: the page and the
 * tests share them.
 */
import { fmtDate, mondayOf, shiftDays, type ISODate, type PlanBlock } from '@logbook/shared';
import type { TrendTone } from '@/ui/charts';
import { agoWords } from './feed';
import type { MetricModel } from './metrics';

const WEEK_MS = 7 * 86_400_000;
const noon = (d: ISODate) => Date.parse(`${d}T12:00:00Z`);

/** The block a day belongs to: its name and which week ("Week 3 of 12"), or the next one and when it starts. */
export const blockWords = (blocks: readonly PlanBlock[], date: ISODate): { title: string; sub: string } | null => {
  const live = blocks.filter((b) => b.end >= date).sort((a, b) => (a.start < b.start ? -1 : 1));
  const b = live.find((x) => x.start <= date) ?? live[0];
  if (!b) return null;
  const weeks = Math.max(1, Math.round((noon(b.end) - noon(mondayOf(b.start))) / WEEK_MS));
  if (b.start > date) return { title: b.name, sub: `Starts ${b.start <= shiftDays(date, 6) ? fmtDate('dowLong', b.start) : fmtDate('md', b.start)}` };
  const wk = Math.floor((noon(mondayOf(date)) - noon(mondayOf(b.start))) / WEEK_MS) + 1;
  return { title: b.name, sub: `Week ${Math.min(wk, weeks)} of ${weeks}` };
};

export interface StravaState {
  connected: boolean;
  lastSyncAt: string | null;
  syncing: boolean;
  error: string | null;
}

/**
 * The Strava chip: what it says and what a tap does. Connected: "Synced 6 m ago" (no tap; nothing to open). Paused: the
 * words in orange, a tap opens Data sources. Not connected while Strava is offered: "Connect" opens the primer. Strava not
 * offered on this server: runs are the ones marked done by hand.
 */
export const stravaChip = (offered: boolean, s: StravaState | null, now: number): { title: string; sub: string; tone: 'ok' | 'warn' | 'off'; tap: 'connect' | 'settings' | null } => {
  if (s?.connected) {
    if (s.syncing) return { title: 'Strava', sub: 'Syncing…', tone: 'ok', tap: null };
    if (s.error) return { title: 'Strava', sub: 'Sync paused', tone: 'warn', tap: 'settings' };
    const a = agoWords(s.lastSyncAt, now);
    return { title: 'Strava', sub: a ? `Synced ${a}` : 'Not synced yet', tone: 'ok', tap: null };
  }
  if (offered) return { title: 'Strava', sub: 'Not connected', tone: 'off', tap: 'connect' };
  return { title: 'Runs', sub: 'Marked done by hand', tone: 'off', tap: null };
};

/** How a metric's status reads on its tile: navy with a check on your usual, orange with an arrow off it, grey before then. */
export const trendTone = (m: Pick<MetricModel, 'standing' | 'value' | 'hasData'> & { variant: { invert?: boolean } }): TrendTone => {
  if (!m.hasData || m.value == null || !m.standing) return 'none';
  if (m.standing === 'within') return 'ok';
  // pace: a smaller number is up the chart, so "below" (faster) points up, the way the line goes
  const up = m.standing === 'above';
  return (m.variant.invert ? !up : up) ? 'up' : 'down';
};

/** A tile has room for two short lines: the learning period keeps its count ("Learning, 9 of 14 days"). */
export const tileStatus = (status: string) => status.replace(/^Building your normal: /, 'Learning, ');

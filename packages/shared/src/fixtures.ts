/** Test fixtures: sessions, activities and snapshots in the shapes the web's log cache produces. Not exported from the package. */
import type { Snapshot } from './status.js';
import type { Activity, Session } from './types.js';

export const sess = (p: Partial<Session> & Pick<Session, 'date' | 'kind'>): Session => ({
  id: p.id ?? `s-${p.date}-${p.kind}-${p.type ?? ''}`,
  position: 0,
  type: null,
  title: null,
  details: null,
  miles: null,
  minutes: null,
  blockId: null,
  movedFrom: null,
  mark: null,
  ...p,
});

export const act = (date: string, miles: number, extra: Partial<Activity> = {}): Activity => ({
  id: `a-${date}-${miles}-${extra.kind ?? 'run'}`,
  date,
  time: '07:40',
  name: 'Morning Run',
  sportType: 'Run',
  kind: 'run',
  miles,
  movingSec: miles * 540,
  elevFt: 0,
  avgHr: null,
  maxHr: null,
  cadence: null,
  laps: null,
  perfAt: null,
  polyline: null,
  ...extra,
});

export const snapOf = (sessions: Session[], acts: Activity[], today: string, sets: Record<string, number> = {}): Snapshot => ({
  today,
  sessionsOn: (d) => sessions.filter((s) => s.date === d),
  activitiesOn: (d) => acts.filter((a) => a.date === d),
  liftSetCountOn: (d) => sets[d] ?? 0,
});

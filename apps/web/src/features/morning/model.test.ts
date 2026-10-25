import { MORNING_DEFAULTS, normalizeMorningSettings, type Session } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { morningOf, rowsOf, workName } from './model';

const sess = (p: Partial<Session> & Pick<Session, 'date' | 'kind'>): Session => ({
  id: p.id ?? `s-${p.date}-${p.kind}`,
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
// MORNING_DEFAULTS: alarm 7:20, Easy 5 at 9:00/mi, back 8:30, the routine fixed at 8:40 (10 min free), leave 9:30
const run = [sess({ date: '2026-10-23', kind: 'run', type: 'Easy', miles: 5 })];
const st = MORNING_DEFAULTS;
const ids = (r: { id: string }[]) => r.map((x) => x.id).join(',');

describe('rowsOf while an alarm drag holds the row set (feel review 1 FL1)', () => {
  it('without a kept set, a later alarm takes Free away and brings the late note', () => {
    expect(ids(rowsOf(morningOf(run, null, st), 'today'))).toBe('wake,work,free,shower,ready,smoothie,prep');
    expect(ids(rowsOf(morningOf(run, null, st, { wake: 455 }), 'today', true))).toBe('wake,work,late,shower,ready,smoothie,prep');
  });
  it('with the set the drag began with, Free stays at 0 min and the late note waits', () => {
    const rows = rowsOf(morningOf(run, null, st, { wake: 455 }), 'today', true, { free: true, late: false });
    expect(ids(rows)).toBe('wake,work,free,shower,ready,smoothie,prep');
    const free = rows.find((r) => r.id === 'free')!;
    expect(free.sub).toBe('0 min · routine at 8:45');
    expect(free.at).toBe(525);
  });
  it('a drag that began late keeps its late note when the alarm comes back in time', () => {
    const rows = rowsOf(morningOf(run, null, st, { wake: 440 }), 'today', true, { free: false, late: true });
    expect(ids(rows)).toBe('wake,work,late,shower,ready,smoothie,prep');
  });
});

describe('row words', () => {
  it('a session typed Run is not "Run run" (FL10)', () => {
    expect(workName('run', 'Easy')).toBe('Easy run');
    expect(workName('run', 'Run')).toBe('Run');
    expect(workName('run', 'Long run')).toBe('Long run');
    expect(workName('gym', 'Strength')).toBe('Strength');
  });
  it('an empty routine says how long Free is, not "routine at" (FL15)', () => {
    const empty = normalizeMorningSettings({ ...st, after: { ...st.after, shower: 0, ready: 0, smoothie: 0, prep: 0 } });
    const free = rowsOf(morningOf(run, null, empty), 'today').find((r) => r.id === 'free');
    expect(free?.sub).toBe('10 min');
  });
});

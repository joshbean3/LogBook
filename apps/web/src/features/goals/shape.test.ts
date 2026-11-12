import type { Aim } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { goalsOf } from './shape';

const g = (over: Record<string, unknown> = {}) => ({ id: 'g1', level: 'day', period: '2026-11-12', text: 'Ship it', original: null, why: null, status: 'open', reflection: null, steps: [], createdAt: '2026-11-12T08:00:00Z', updatedAt: '2026-11-12T08:00:00Z', closedAt: null, ...over });

describe('goals as the app reads them, whatever the server or the saved copy holds', () => {
  it('hands a clean list back as it came, the same array', () => {
    const list = [g(), g({ id: 'g2', level: 'week', period: '2026-11-09', steps: [{ id: 's1', text: 'One', done: true }] })] as Aim[];
    expect(goalsOf(list)).toBe(list);
  });

  it('reads anything that is not a list as no goals', () => {
    for (const raw of [null, undefined, 'oops', 42, { goals: [] }]) expect(goalsOf(raw)).toEqual([]);
  });

  it('drops a row that is not a goal: no id, no words, an unknown level, a period that is not one', () => {
    const rows = [
      null,
      'a goal',
      g({ id: undefined }),
      g({ id: 'a', text: null }),
      g({ id: 'b', text: 42 }),
      g({ id: 'c', text: '   ' }),
      g({ id: 'd', level: 'decade', period: '2020' }),
      g({ id: 'e', period: 'yesterday' }),
      g({ id: 'f', period: null }),
      g({ id: 'h', level: 'month', period: '2026-13' }),
      g({ id: 'i', level: 'year', period: 'MMXXVI' }),
      g({ id: 'j', period: '2026-02-30' }),
      g({ id: 'ok' }),
    ];
    expect(goalsOf(rows).map((x) => x.id)).toEqual(['ok']);
  });

  it('gives a goal from before steps existed an empty list, and keeps only the steps that are steps', () => {
    expect(goalsOf([g({ steps: undefined })])[0]!.steps).toEqual([]);
    expect(goalsOf([g({ steps: null })])[0]!.steps).toEqual([]);
    const steps = [null, 'a', { id: 1, text: 'no id' }, { id: 's', text: null, done: true }, { id: 'ok', text: 'Draft', done: 'yes' }, { id: 'ok2', text: 'Send', done: true }];
    expect(goalsOf([g({ steps })])[0]!.steps).toEqual([
      { id: 'ok', text: 'Draft', done: false },
      { id: 'ok2', text: 'Send', done: true },
    ]);
  });

  it('reads an answer it does not know as still open, and anything else that is not text as none', () => {
    const [x] = goalsOf([g({ status: 'paused', original: 7, why: {}, reflection: [], closedAt: 5, createdAt: null, updatedAt: undefined })]);
    expect(x).toMatchObject({ status: 'open', original: null, why: null, reflection: null, closedAt: null, createdAt: '', updatedAt: '' });
    expect(goalsOf([g({ status: null })])[0]!.status).toBe('open');
  });

  it('keeps one goal for a period: the first', () => {
    expect(goalsOf([g({ id: 'first' }), g({ id: 'second', text: 'Other' })]).map((x) => x.id)).toEqual(['first']);
  });

  it('keeps a week that does not start on a Monday (it can still be answered) and a provisional id', () => {
    expect(goalsOf([g({ id: 'tmp-goal-week-2026-11-11', level: 'week', period: '2026-11-11' })])).toHaveLength(1);
  });
});

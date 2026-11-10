import { afterEach, describe, expect, it } from 'vitest';
import { NOW_BUDGET, nowBudgetState, paintOf, registerNowMark, resetNowBudget } from './nowBudget';

afterEach(() => resetNowBudget());

describe('the Sunrise budget (guide 3.5)', () => {
  it('lets three elements be Sunrise and turns the rest Night Ink', () => {
    const strip = registerNowMark('strip');
    const pointer = registerNowMark('pointer');
    const badge = registerNowMark('badge');
    const badge2 = registerNowMark('badge');
    expect(NOW_BUDGET).toBe(3);
    expect([strip, pointer, badge, badge2].map((m) => paintOf(m.id))).toEqual(['now', 'now', 'now', 'ink']);
  });

  it('yields by priority, not by arrival: a later pointer outranks an earlier badge', () => {
    const badge = registerNowMark('badge');
    const strip = registerNowMark('strip');
    const node = registerNowMark('pointer');
    const tick = registerNowMark('pointer');
    expect([badge, strip, node, tick].map((m) => paintOf(m.id))).toEqual(['ink', 'now', 'now', 'now']);
  });

  it('shows at most one Sunrise badge, the first to register (the dock before the tab)', () => {
    const dock = registerNowMark('badge');
    const tab = registerNowMark('badge');
    expect([paintOf(dock.id), paintOf(tab.id)]).toEqual(['now', 'ink']);
    dock.release();
    expect(paintOf(tab.id)).toBe('now');
  });

  it('gives a yielded mark its Sunrise back when a higher one goes', () => {
    const strip = registerNowMark('strip');
    const a = registerNowMark('pointer');
    const b = registerNowMark('pointer');
    const stamp = registerNowMark('stamp');
    expect(paintOf(stamp.id)).toBe('ink');
    a.release();
    expect(paintOf(stamp.id)).toBe('now');
    expect(nowBudgetState().map((m) => m.paint)).toEqual(['now', 'now', 'now']);
    void strip;
    void b;
  });
});

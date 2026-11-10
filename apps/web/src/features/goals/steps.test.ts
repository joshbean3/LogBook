import type { Aim, GoalStep } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { statusAfterSteps, stepChange, stepsLocked } from './Steps';

const st = (...done: boolean[]): GoalStep[] => done.map((d, i) => ({ id: `s${i}`, text: `step ${i}`, done: d }));
const g = (status: Aim['status'], steps: GoalStep[]) => ({ status, steps });

describe('a steps save and the goal status', () => {
  it('finishes an open goal when its last step is checked', () => {
    expect(statusAfterSteps(g('open', st(true, false)), st(true, true))).toBe('done');
  });
  it('opens a done goal again when a step is unchecked', () => {
    expect(statusAfterSteps(g('done', st(true, true)), st(true, false))).toBe('open');
  });
  it('never moves the status when a step is removed', () => {
    // the old bug: removing the one unchecked step finished the goal (with the celebration)
    expect(statusAfterSteps(g('open', st(true, true, false)), st(true, true))).toBeUndefined();
    // and removing the steps of a done goal opened it again
    expect(statusAfterSteps(g('done', st(true, true)), st(true))).toBeUndefined();
    expect(statusAfterSteps(g('done', st(true)), [])).toBeUndefined();
  });
  it('never moves the status when a step is added', () => {
    expect(statusAfterSteps(g('done', st(true)), st(true, false))).toBeUndefined();
    expect(statusAfterSteps(g('open', []), st(false))).toBeUndefined();
  });
  it('leaves a done goal done when one of its open steps is checked', () => {
    expect(statusAfterSteps(g('done', st(false, false)), st(true, false))).toBeUndefined();
  });
  it('reads what changed', () => {
    expect(stepChange(st(false), st(true))).toEqual({ why: 'toggle', toggled: true });
    expect(stepChange(st(false, false), st(true, true))).toEqual({ why: null });
    expect(stepChange(st(false), st(false, false))).toEqual({ why: 'add' });
  });
  it('locks the steps of an answered goal', () => {
    expect(stepsLocked({ status: 'partly' })).toBe(true);
    expect(stepsLocked({ status: 'missed' })).toBe(true);
    expect(stepsLocked({ status: 'done' })).toBe(false);
  });
});

import { zGoal } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { GOAL_CARD } from './controls';
import { GOALS } from './model';

describe('goal choice cards', () => {
  it('give every goal an icon and one plain line', () => {
    for (const g of zGoal.options) {
      const card = GOAL_CARD[g];
      expect(card, g).toBeTruthy();
      expect(card.Icon, g).toBeTruthy();
      expect(card.line.length, g).toBeGreaterThan(0);
      // one short sentence or two, ending in a full stop, no em dashes (docs/brand.md voice)
      expect(card.line.length, g).toBeLessThanOrEqual(48);
      expect(card.line).toMatch(/\.$/);
      expect(card.line).not.toMatch(/—/);
    }
  });
  it('cover exactly the goals the question offers', () => {
    expect(Object.keys(GOAL_CARD).sort()).toEqual(GOALS.map((g) => g.id).sort());
  });
});

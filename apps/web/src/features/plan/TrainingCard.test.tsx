import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { setLiveDate, useIsLive } from '../day/live';
import { CardScope } from './TrainingCard';

/** A part of the card, as Today's parts ask: is my day's page the live one? (HeroHorizon, the deck, the Close card.) */
const Part = ({ date }: { date: string }) => <i>{useIsLive(date) ? 'live' : 'still'}</i>;

describe('the training card on Fitness is the page on screen', () => {
  afterEach(() => setLiveDate(null));

  it('is live while Today is on today', () => {
    setLiveDate('2026-11-12');
    expect(renderToStaticMarkup(<CardScope><Part date="2026-11-12" /></CardScope>)).toContain('live');
  });

  /*
   * Known defect, in features/day (not this folder's to change): the card on Fitness asks Today's day pager whether it is
   * live. Page Today to yesterday, open Fitness: today's card there draws as a neighbour page (the sun does not travel, the
   * dusk light does not breathe, no now mark). Nothing is lost and every control works; it is the card's motion only.
   * The fix: live.ts gets a scope (a context that `useIsLive` reads before its store), and `CardScope` provides it.
   * `it.fails` passes while the defect stands and fails the day it is fixed: then make it a plain `it`.
   */
  it.fails('is live whatever day Today is paged to', () => {
    setLiveDate('2026-11-11');
    expect(renderToStaticMarkup(<CardScope><Part date="2026-11-12" /></CardScope>)).toContain('live');
  });
});

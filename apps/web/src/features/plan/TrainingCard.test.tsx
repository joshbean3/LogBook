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

  // the card on Fitness has its own scope (live.ts LiveScope): which day Today is paged to does not still its motion
  it('is live whatever day Today is paged to', () => {
    setLiveDate('2026-11-11');
    expect(renderToStaticMarkup(<CardScope><Part date="2026-11-12" /></CardScope>)).toContain('live');
  });
});

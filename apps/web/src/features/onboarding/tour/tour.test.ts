import { describe, expect, it } from 'vitest';
import { scrollFor } from './engine';
import { dotsLabel, TOUR_ALL, tourPage, tourPages } from './Tour';
import { backAction, TOUR_HOME, TOUR_PATH, tourExit, tourFrom, tourStart } from './route';

describe('the tour’s pages', () => {
  it('is one page per place, in the order of the tabs, then the assistant', () => {
    expect(tourPages(true).map((p) => p.key)).toEqual(['today', 'goals', 'plan', 'journal', 'ask']);
    // each is headed with the place’s own name, as its tab writes it
    expect(tourPages(true).map((p) => p.title)).toEqual(['Today', 'Goals', 'Fitness', 'Journal', 'The assistant']);
  });

  it('has no Fitness page with Fitness off, and nothing else changes', () => {
    expect(tourPages(false).map((p) => p.key)).toEqual(['today', 'goals', 'journal', 'ask']);
    expect(tourPages(false)).toEqual(TOUR_ALL.filter((p) => p.key !== 'plan'));
  });

  it('says what each place is for in one short line, in the product’s voice', () => {
    for (const p of TOUR_ALL) {
      // one line at 390 pt wide is about 48 characters of Inter 15; the assistant’s line carries its caution and takes two
      expect(p.lede.length).toBeLessThanOrEqual(p.key === 'ask' ? 96 : 48);
      const words = `${p.title} ${p.lede}`;
      // no em dash, no name for the assistant but its own, no tab that is gone
      expect(words).not.toMatch(/—|–/);
      expect(words).not.toMatch(/\b(coach|AI|bot|Logbook)\b/);
      expect(words).not.toMatch(/\bLearned\b|What I learned|\bProgress tab\b|\bHabits tab\b/);
    }
    // the assistant’s page keeps the caution
    expect(TOUR_ALL.find((p) => p.key === 'ask')!.lede).toMatch(/It can be wrong, so check anything important\./);
  });
});

describe('the dots', () => {
  it('announce the page and how many there are, with Fitness on and off', () => {
    expect(dotsLabel(0, tourPages(true).length)).toBe('Page 1 of 5');
    expect(dotsLabel(4, tourPages(true).length)).toBe('Page 5 of 5');
    expect(dotsLabel(0, tourPages(false).length)).toBe('Page 1 of 4');
    expect(dotsLabel(3, tourPages(false).length)).toBe('Page 4 of 4');
  });

  it('never name a page that is not there', () => {
    // a page number kept from a longer tour (Fitness was on, six pages once) lands on the last page
    expect(tourPage(5, 4)).toBe(3);
    expect(dotsLabel(5, 4)).toBe('Page 4 of 4');
    expect(tourPage(-2, 5)).toBe(0);
    expect(tourPage(Number.NaN, 5)).toBe(0);
    expect(tourPage(2.7, 5)).toBe(2);
    expect(tourPage(3, 0)).toBe(0);
  });
});

describe('the stage’s scroll', () => {
  // a page 800 tall seen through a window 400 tall
  it('stays where it is when the part is already in the window', () => {
    expect(scrollFor(0, 100, 300, 400, 800)).toBe(0);
    expect(scrollFor(120, 200, 400, 400, 800)).toBe(120);
  });

  it('moves just far enough to bring a part below the window into it, with a little air', () => {
    expect(scrollFor(0, 500, 600, 400, 800)).toBe(208);
    expect(scrollFor(0, 500, 600, 400, 800, 0)).toBe(200);
  });

  it('moves up for a part above the window', () => {
    expect(scrollFor(300, 100, 200, 400, 800)).toBe(92);
  });

  it('never scrolls past the page’s ends', () => {
    expect(scrollFor(0, 700, 800, 400, 800)).toBe(400);
    expect(scrollFor(200, 0, 50, 400, 800)).toBe(0);
    // a page shorter than the window does not scroll at all
    expect(scrollFor(0, 100, 300, 400, 320)).toBe(0);
  });

  it('shows a part taller than the window from its top', () => {
    expect(scrollFor(0, 200, 760, 400, 800)).toBe(192);
  });
});

describe('the tour by itself', () => {
  it('lives at its own address under first run’s', () => {
    expect(TOUR_PATH).toBe('/welcome/how');
    expect(TOUR_HOME).toBe('/today');
  });

  it('ends where it was opened from: one step back when the opener said so, else Today', () => {
    expect(tourExit(tourFrom())).toBe('back');
    // a link, a reload, or some other page’s state: there is no page to go back to
    expect(tourExit(null)).toBe('home');
    expect(tourExit(undefined)).toBe('home');
    expect(tourExit({})).toBe('home');
    expect(tourExit({ from: '/settings' })).toBe('home');
    expect(tourExit('back')).toBe('home');
  });

  it('opens on the page its opener names (a tab’s first-visit tip), and still ends one step back', () => {
    const on = tourPages(true).map((p) => p.key);
    const off = tourPages(false).map((p) => p.key);
    expect(tourStart(tourFrom('today'), on)).toBe(0);
    expect(tourStart(tourFrom('goals'), on)).toBe(1);
    expect(tourStart(tourFrom('plan'), on)).toBe(2);
    expect(tourStart(tourFrom('journal'), on)).toBe(3);
    // with Fitness off the Journal is the third page, and a Fitness page that is not there is the first
    expect(tourStart(tourFrom('journal'), off)).toBe(2);
    expect(tourStart(tourFrom('plan'), off)).toBe(0);
    expect(tourExit(tourFrom('goals'))).toBe('back');
    // no page named, or a state that is not the tour's: the first page
    expect(tourFrom()).toEqual({ tourBack: true });
    for (const state of [tourFrom(), null, undefined, {}, 'goals', { start: 7 }, { start: 'nowhere' }, { tourBack: true, start: null }]) expect(tourStart(state, on)).toBe(0);
  });

  it('turns back a page with the chevron, and leaves from the first page', () => {
    expect(backAction(0)).toBe('leave');
    expect(backAction(1)).toBe('turn');
    expect(backAction(4)).toBe('turn');
  });
});

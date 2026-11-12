import { Fragment, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { nowBudgetState, registerNowMark, resetNowBudget } from '@/ui/nowBudget';
import { FarHills, type FarHill } from './FarHills';
import { marksOf, sunAt, wayAhead } from './horizon';
import { lightPoints, lightsWay, pathSegments, stopStates, sunProgress, waypoints, type StopState } from './logic';
import { PathCheck, PathLine, PathStop } from './PathLine';
import { Poster } from './Poster';
import { PosterScene } from './PosterScene';
import { WeekLights } from './WeekLights';

// Pressable reads the app's one context menu and its navigation (mounted in main.tsx): here a plain button stands in
vi.mock('@/ui/Pressable', () => ({
  Pressable: ({ children, className = '', label, press, onPress, ...rest }: { children?: ReactNode; className?: string; label?: string; press?: string; onPress?: () => void } & Record<string, unknown>) => (
    <button type="button" className={`pressable ${className}`} data-press={press} aria-label={label} {...rest}>
      {children}
    </button>
  ),
}));

/**
 * The poster kit at its edges: nothing, one, hundreds; huge and tiny text; numbers that are not numbers; lists that are
 * shorter or longer than the type says (data from a server is only as good as its shape). Nothing here may throw, and
 * no drawing may carry a NaN, an Infinity or an "undefined" into the page.
 */
const count = (html: string, part: string) => html.split(part).length - 1;
const clean = (html: string) => {
  expect(html).not.toMatch(/NaN|Infinity|undefined|\[object Object\]/);
  return html;
};
const LONG = 'Supercalifragilistic '.repeat(24).trim(); // about 500 characters
const WIDE = 'W'.repeat(300); // one word with nowhere to break

describe('PathLine at its edges', () => {
  it('draws an empty list with no stops, and one stop with no line out of it', () => {
    expect(clean(renderToStaticMarkup(<PathLine label="To-dos">{[]}</PathLine>))).toBe('<ul class="pth" aria-label="To-dos"></ul>');
    const one = clean(renderToStaticMarkup(<PathLine><PathStop state="next" title="Only" /></PathLine>));
    expect(count(one, '<li')).toBe(1);
    expect(one).toContain('out-none');
  });

  it('carries 300 stops with one light and an unbroken line', () => {
    const states = stopStates(Array.from({ length: 300 }, (_, i) => i < 120));
    const html = clean(renderToStaticMarkup(<PathLine>{states.map((s, i) => <PathStop key={i} id={`t${i}`} state={s} title={`To-do ${i}`} />)}</PathLine>));
    expect(count(html, '<li')).toBe(300);
    expect(count(html, 'class="pth-lit"')).toBe(1);
    const segs = pathSegments(states);
    for (let i = 0; i < segs.length - 1; i++) expect(segs[i]!.out).toBe(segs[i + 1]!.in);
  });

  it('skips children that are nothing, and renders anything that is not a stop as it is', () => {
    const html = clean(
      renderToStaticMarkup(
        <PathLine>
          {null}
          {false}
          {undefined}
          <PathStop state="done" title="A" />
          {0 > 1 ? <PathStop state="ahead" title="never" /> : null}
          <li className="own">Own row</li>
          <PathStop state="next" title="B" />
        </PathLine>,
      ),
    );
    expect(count(html, 'pth-stop')).toBe(2);
    expect(html).toContain('<li class="own">Own row</li>');
    // the two stops are neighbors on the line, whatever sits between them
    expect(html).toMatch(/is-done in-solid out-solid/);
  });

  it('stops inside a fragment or another component still draw (no line of their own unless they set one)', () => {
    const Wrapped = ({ title }: { title: string }) => <PathStop state="ahead" title={title} />;
    const html = clean(
      renderToStaticMarkup(
        <PathLine>
          <Fragment>
            <PathStop state="done" title="In a fragment" />
            <PathStop state="next" title="Also" />
          </Fragment>
          <Wrapped title="Wrapped" />
        </PathLine>,
      ),
    );
    expect(count(html, 'pth-stop')).toBe(3);
    expect(html).toContain('in-none out-none');
  });

  it('a stop outside any PathLine, with no title, or with a title that is one emoji or 500 characters, draws', () => {
    for (const title of [undefined, '', ' ', '🏃', '🏃‍♀️🏳️‍🌈', LONG, WIDE, 'שלום עולם', 'line one\nline two', '<script>alert(1)</script>']) {
      const html = clean(renderToStaticMarkup(<PathStop state="next" title={title} tag="Next" subtitle={title} trailing={<PathCheck onPress={() => undefined} label="x" />} />));
      expect(count(html, '<li')).toBe(1);
      expect(html).not.toContain('<script>');
    }
  });

  it('two stops with one id, stops with no id, and two lit stops all draw', () => {
    const html = clean(
      renderToStaticMarkup(
        <PathLine>
          <PathStop id="same" state="next" title="A" />
          <PathStop id="same" state="next" title="B" />
          <PathStop state="ahead" title="C" />
          <PathStop state={'bogus' as StopState} title="D" />
        </PathLine>,
      ),
    );
    expect(count(html, '<li')).toBe(4);
  });

  it('the states of a list that is not flags default to open, never to a crash', () => {
    expect(stopStates([] as boolean[])).toEqual([]);
    expect(stopStates([undefined, null, 0, 'yes'] as unknown as boolean[])).toEqual(['next', 'ahead', 'ahead', 'done']);
    expect(pathSegments(['bogus' as StopState])).toEqual([{ in: 'dots', out: 'none' }]);
  });
});

describe('Poster at its edges', () => {
  it('draws with no band, no title, no meta and no scene', () => {
    const html = clean(renderToStaticMarkup(<Poster title={undefined as unknown as string} scene={null} />));
    expect(html).toContain('po-title');
    expect(html).not.toContain('po-band');
    clean(renderToStaticMarkup(<Poster title="" band={{ label: '', words: '' }} />));
  });

  it('carries a 300-character title and band words on both grounds and both sizes', () => {
    for (const ground of ['day', 'dusk'] as const)
      for (const size of ['full', 'slim'] as const) {
        const html = clean(renderToStaticMarkup(<Poster ground={ground} size={size} title={WIDE} now={LONG} meta={LONG} band={{ label: LONG, words: WIDE, second: LONG, onPress: () => undefined }} />));
        expect(html).toContain(`is-${ground} is-${size}`);
        expect(count(html, WIDE)).toBe(2);
      }
  });

  it('gives every poster on a page its own ids', () => {
    const html = renderToStaticMarkup(
      <>
        {Array.from({ length: 12 }, (_, i) => (
          <Fragment key={i}>
            <Poster title={`Poster ${i}`} />
            <FarHills hills={[{ caption: 'a' }, { caption: 'b' }, { caption: 'c' }]} />
            <WeekLights days={[]} tonight="lit" />
          </Fragment>
        ))}
      </>,
    );
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(36);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('PosterScene at its edges', () => {
  it.each([
    ['nothing to count', { total: 0, done: 0 }],
    ['more done than there is', { total: 3, done: 9 }],
    ['a negative count', { total: -4, done: -1 }],
    ['counts that are not numbers', { total: Number.NaN, done: Number.NaN }],
    ['no end of them', { total: Number.POSITIVE_INFINITY, done: Number.POSITIVE_INFINITY }],
    ['hundreds', { total: 300, done: 120 }],
    ['fractions', { total: 2.5, done: 1.5 }],
    ['progress below zero', { progress: -3 }],
    ['progress past one', { progress: 7 }],
    ['progress that is not a number', { progress: Number.NaN }],
    ['progress without end', { progress: Number.POSITIVE_INFINITY }],
    ['a text where a number goes', { total: '3' as unknown as number, done: 'x' as unknown as number }],
  ])('draws with %s', (_name, props) => {
    for (const size of ['full', 'slim'] as const) {
      const html = clean(renderToStaticMarkup(<PosterScene size={size} lit {...props} />));
      expect(html).toContain('<svg');
      expect(count(html, 'po-mark-disc')).toBeLessThanOrEqual(10);
    }
  });

  it('the sun’s place is always a number from 0 to 1', () => {
    for (const [d, t] of [[Number.NaN, 3], [3, Number.NaN], [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY], [-1, 3], [9, 3], [1, 0], [1, -3], [0, 0]] as const) {
      const f = sunProgress(d, t);
      expect(Number.isFinite(f)).toBe(true);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
    for (const f of [Number.NaN, -1, 2, Number.POSITIVE_INFINITY]) {
      expect(sunAt(f).every(Number.isFinite)).toBe(true);
      expect(Array.isArray(wayAhead(f))).toBe(true);
      expect(marksOf({ planned: 3, done: 1 }, f).every((m) => Number.isFinite(m.share))).toBe(true);
    }
  });
});

describe('FarHills at its edges', () => {
  const hill = (i: number, more: Partial<FarHill> = {}): FarHill => ({ caption: `Hill ${i}`, words: `Goal ${i}`, ...more });
  it.each([0, 1, 2, 3, 5])('draws with %i hills (three at most)', (n) => {
    const hills = Array.from({ length: n }, (_, i) => hill(i)) as unknown as readonly [FarHill, FarHill, FarHill];
    const html = clean(renderToStaticMarkup(<FarHills hills={hills} />));
    expect(count(html, 'class="fh-hill')).toBe(Math.min(n, 3));
  });
  it('draws with every hill carrying a plus, with no words, and with huge words', () => {
    const html = clean(renderToStaticMarkup(<FarHills title={LONG} hills={[hill(0, { plus: true, onPress: () => undefined }), hill(1, { plus: true, words: undefined }), hill(2, { plus: true, words: WIDE, value: LONG })]} />));
    expect(count(html, 'is-plus')).toBe(3);
  });
  it('draws when the list is missing altogether', () => {
    expect(() => renderToStaticMarkup(<FarHills hills={undefined as unknown as readonly [FarHill, FarHill, FarHill]} />)).not.toThrow();
  });
});

describe('WeekLights at its edges', () => {
  const day = (lit: boolean, letter = 'M') => ({ letter, lit });
  it.each([0, 1, 3, 6, 10, 60])('draws with %i days before tonight', (n) => {
    for (const tonight of ['waiting', 'lit'] as const) {
      const html = clean(renderToStaticMarkup(<WeekLights days={Array.from({ length: n }, (_, i) => day(i % 2 === 0))} tonight={tonight} label="x" />));
      expect(count(html, 'wl-letter')).toBe(n + 1);
    }
  });
  it('a missing tonight reads as waiting; a missing list, letter or flag draws', () => {
    const html = clean(renderToStaticMarkup(<WeekLights days={[day(true), { letter: undefined as unknown as string, lit: undefined as unknown as boolean }]} tonight={undefined as unknown as 'waiting'} />));
    expect(html).toContain('wl-wait');
    expect(() => renderToStaticMarkup(<WeekLights days={undefined as unknown as []} tonight="lit" />)).not.toThrow();
  });
  it('the lights and their way are numbers for any count', () => {
    for (const n of [0, 1, 2, 7, 11, 200]) expect(lightPoints(n).flat().every(Number.isFinite)).toBe(true);
    for (const n of [-1, Number.NaN, 2.5]) expect(Array.isArray(lightPoints(n))).toBe(true);
    expect(lightsWay([], false).flat().every(Number.isFinite)).toBe(true);
    expect(waypoints([[0, 0], [0, 0]], 7)).toEqual([]);
    expect(waypoints([[0, 0], [10, 0]], 0).length).toBeGreaterThan(0);
  });
});

describe('the now-mark budget with five lit marks on a screen', () => {
  it('the first three keep Sunrise, the rest yield to ink, and none is lost; releasing one promotes the next', () => {
    resetNowBudget();
    const marks = Array.from({ length: 5 }, () => registerNowMark('pointer'));
    expect(nowBudgetState().map((m) => m.paint)).toEqual(['now', 'now', 'now', 'ink', 'ink']);
    marks[0]!.release();
    marks[0]!.release();
    expect(nowBudgetState().map((m) => m.paint)).toEqual(['now', 'now', 'now', 'ink']);
    for (const m of marks) m.release();
    expect(nowBudgetState()).toEqual([]);
  });
  it('five lit posters on one page all draw', () => {
    const html = clean(
      renderToStaticMarkup(
        <>
          {Array.from({ length: 5 }, (_, i) => (
            <Poster key={i} title="x" scene={<PosterScene lit total={3} done={1} />} path={<PathLine><PathStop state="next" title="t" /></PathLine>} />
          ))}
        </>,
      ),
    );
    expect(html.match(/class="po-sun( is-quiet)?"/g)).toHaveLength(5);
  });
});

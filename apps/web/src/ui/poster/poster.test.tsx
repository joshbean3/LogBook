import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FarHills } from './FarHills';
import { HZ, marksOf, sunAt, wayAhead, WAY } from './horizon';
import { LIGHT_CLEAR, lightPoints, lightsWay, pathSegments, stopStates, sunProgress } from './logic';
import { PathCheck, PathLine, PathStop } from './PathLine';
import { Poster } from './Poster';
import { PosterScene } from './PosterScene';
import { WeekLights } from './WeekLights';

// Pressable reads the app's one context menu and its navigation (mounted in main.tsx): here a plain button stands in,
// with the same class, label and attributes
vi.mock('@/ui/Pressable', () => ({
  Pressable: ({ children, className = '', label, press, onPress, ...rest }: { children?: ReactNode; className?: string; label?: string; press?: string; onPress?: () => void } & Record<string, unknown>) => (
    <button type="button" className={`pressable ${className}`} data-press={press} aria-label={label} {...rest}>
      {children}
    </button>
  ),
}));

const count = (html: string, part: string) => html.split(part).length - 1;

describe('stopStates', () => {
  it('lights the first open item and leaves the rest ahead', () => {
    expect(stopStates([true, false, false])).toEqual(['done', 'next', 'ahead']);
    expect(stopStates([false, false])).toEqual(['next', 'ahead']);
  });
  it('keeps a done item after the next one done (ticked out of order)', () => {
    expect(stopStates([false, true, false])).toEqual(['next', 'done', 'ahead']);
  });
  it('has no next when everything is done, or there is nothing', () => {
    expect(stopStates([true, true])).toEqual(['done', 'done']);
    expect(stopStates([])).toEqual([]);
  });
});

describe('pathSegments', () => {
  it('is solid behind the next stop and dotted ahead (a goal with three to-dos, one done)', () => {
    expect(pathSegments(['done', 'next', 'ahead', 'add'])).toEqual([
      { in: 'solid', out: 'solid' },
      { in: 'solid', out: 'dots' },
      { in: 'dots', out: 'dots' },
      { in: 'dots', out: 'none' },
    ]);
  });
  it('is dotted all the way with nothing done (nothing set: the lit stop, then Add)', () => {
    expect(pathSegments(['next', 'add'])).toEqual([
      { in: 'dots', out: 'dots' },
      { in: 'dots', out: 'none' },
    ]);
  });
  it('stays solid through every done stop, and turns dotted after the last when none is next', () => {
    expect(pathSegments(['done', 'done', 'add'])).toEqual([
      { in: 'solid', out: 'solid' },
      { in: 'solid', out: 'dots' },
      { in: 'dots', out: 'none' },
    ]);
  });
  it('never draws a solid stretch out of the next stop', () => {
    expect(pathSegments(['next', 'done', 'ahead']).map((s) => s.out)).toEqual(['dots', 'dots', 'none']);
  });
  it('starts at the first stop without a lead, and each stretch reads the same from both ends', () => {
    const segs = pathSegments(['ahead', 'ahead', 'add'], { lead: false });
    expect(segs[0]!.in).toBe('none');
    for (const states of [['done', 'next', 'ahead', 'add'], ['done', 'done', 'next'], ['next', 'done', 'add']] as const) {
      const s = pathSegments(states);
      for (let i = 0; i < s.length - 1; i++) expect(s[i]!.out).toBe(s[i + 1]!.in);
      expect(s[s.length - 1]!.out).toBe('none');
    }
  });
  it('is empty for no stops', () => {
    expect(pathSegments([])).toEqual([]);
  });
});

describe('sunProgress', () => {
  it('is done over total, held between 0 and 1', () => {
    expect(sunProgress(1, 3)).toBeCloseTo(1 / 3);
    expect(sunProgress(3, 3)).toBe(1);
    expect(sunProgress(5, 3)).toBe(1);
    expect(sunProgress(-1, 3)).toBe(0);
  });
  it('rests on the horizon with nothing to count', () => {
    expect(sunProgress(0, 0)).toBe(0);
    expect(sunProgress(2, 0)).toBe(0);
  });
});

describe('the horizon', () => {
  it('draws the way only ahead of the sun, clear of the open marks', () => {
    expect(wayAhead(0).length).toBe(WAY.filter((d) => d.x >= HZ.x0 + 25.5).length);
    const [sx] = sunAt(2 / 3);
    const way = wayAhead(2 / 3, marksOf({ planned: 3, done: 2 }, 2 / 3));
    expect(way.length).toBeGreaterThan(0);
    expect(way.every((d) => d.x >= sx + 25.5)).toBe(true);
    expect(wayAhead(1)).toEqual([]);
  });
  it('fills one mark per item done', () => {
    expect(marksOf({ planned: 3, done: 1 }, 1 / 3).map((m) => m.lit)).toEqual([true, false, false]);
  });
});

describe('the week’s lights', () => {
  it('rise from left to right and end at tonight', () => {
    const pts = lightPoints(7);
    expect(pts).toHaveLength(7);
    expect(pts[0]).toEqual([30, 96]);
    expect(pts[6]![0]).toBeCloseTo(312);
    expect(pts[6]![1]).toBeCloseTo(46);
    for (let i = 1; i < 7; i++) {
      expect(pts[i]![0]).toBeGreaterThan(pts[i - 1]![0]);
      expect(pts[i]![1]).toBeLessThan(pts[i - 1]![1]);
    }
  });
  it('keep the way clear of every light, further once tonight is lit', () => {
    const lit = [false, false, false, true, false, true];
    const pts = lightPoints(7);
    const [tx, ty] = pts[6]!;
    const near = (way: readonly (readonly [number, number])[]) => Math.min(...way.map(([x, y]) => Math.hypot(x - tx, y - ty)));
    const waiting = lightsWay(lit, false);
    const saved = lightsWay(lit, true);
    expect(waiting.length).toBeGreaterThan(saved.length);
    expect(near(waiting)).toBeGreaterThanOrEqual(LIGHT_CLEAR.tonightWaiting);
    expect(near(saved)).toBeGreaterThanOrEqual(LIGHT_CLEAR.tonightLit);
  });
});

describe('PosterScene', () => {
  it('rests an Apricot sun on the horizon with the way to its place when nothing is set', () => {
    const html = renderToStaticMarkup(<PosterScene />);
    expect(html).toContain('po-sun is-quiet');
    expect(html).toContain('translate(0px, 0px)');
    expect(html).toContain('po-target');
    expect(count(html, 'po-way')).toBe(wayAhead(0).length);
    expect(html).not.toContain('po-mark');
  });
  it('moves a Sunrise sun to done over total and marks each item', () => {
    const html = renderToStaticMarkup(<PosterScene lit total={3} done={1} />);
    expect(html).not.toContain('is-quiet');
    expect(html).toContain(`translate(${HZ.W / 3}px`);
    expect(count(html, 'class="po-mark"')).toBe(3);
    expect(count(html, 'po-mark-disc is-lit')).toBe(1);
  });
  it('blooms the rings and drops the way when everything is done', () => {
    const html = renderToStaticMarkup(<PosterScene lit total={2} done={2} />);
    expect(count(html, 'po-ring is-on')).toBe(1);
    expect(html).toContain('po-ring is-outer is-on');
    expect(html).not.toContain('po-target');
    expect(html).not.toContain('po-way');
  });
  it('draws no sun on the slim strip', () => {
    const html = renderToStaticMarkup(<PosterScene size="slim" lit total={3} done={1} />);
    expect(html).toContain('viewBox="0 40 358 48"');
    expect(html).not.toContain('po-sun');
    expect(html).not.toContain('po-mark');
    expect(html).toContain('po-hill-1');
  });
  it('gives each instance its own gradient ids', () => {
    const html = renderToStaticMarkup(
      <>
        <PosterScene />
        <PosterScene />
      </>,
    );
    const ids = [...html.matchAll(/id="([^"]+-sky)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});

describe('Poster', () => {
  it('sets the title, the meta line with its first words apart, and the band', () => {
    const html = renderToStaticMarkup(<Poster title="What would make today count?" now="Today" meta="14 h left" band={{ label: 'An idea · from Fitness', words: 'Bike 40 min, before lunch' }} />);
    expect(html).toContain('<h2 class="po-title is-lead">What would make today count?</h2>');
    expect(html).toContain('<b class="po-now">Today</b> · 14 h left');
    expect(html).toContain('An idea · from Fitness');
    expect(html).toContain('Bike 40 min, before lunch');
    expect(html).toContain('po is-day is-full');
    expect(html).toContain('po-scene');
    expect(html).not.toContain('<button');
  });
  it('makes the band a button with a chevron when it opens something, and keeps the trailing control outside it', () => {
    const html = renderToStaticMarkup(<Poster title="Goal" band={{ label: 'Today', words: 'Next: Renew passport', onPress: () => {}, pressLabel: 'Open Today', trailing: <PathCheck label="Goal done" onPress={() => {}} /> }} />);
    expect(html).toContain('aria-label="Open Today"');
    expect(html).toContain('lucide-chevron-right');
    expect(html).toMatch(/<\/button><span class="po-band-end"><button/);
  });
  it('draws the slim strip under a slim poster, and no day scene at dusk', () => {
    expect(renderToStaticMarkup(<Poster size="slim" title="T" />)).toContain('po-scene is-slim');
    const dusk = renderToStaticMarkup(
      <Poster ground="dusk" title="T" scene={<i id="own" />}>
        <p>controls</p>
      </Poster>,
    );
    expect(dusk).toContain('po is-dusk is-full');
    expect(dusk).not.toContain('po-scene');
    expect(dusk).toContain('<i id="own"></i>');
    expect(dusk).toContain('<div class="po-ctl"><p>controls</p></div>');
    expect(renderToStaticMarkup(<Poster ground="dusk" title="T" />)).not.toContain('po-scene');
  });
});

describe('PathLine', () => {
  const html = renderToStaticMarkup(
    <PathLine label="To-dos">
      <PathStop id="a" state="done" title="Book dentist appointment" />
      <PathStop id="b" state="next" tag="Next" title="Email Alex about the race" trailing={<PathCheck label="Email Alex about the race, done" onPress={() => {}} />} />
      <PathStop id="c" state="ahead" title="Renew passport" />
      <PathStop state="add" title="Add a to-do" onPress={() => {}} />
    </PathLine>,
  );
  it('draws each stretch from its stops’ states', () => {
    expect(html).toContain('pth-stop is-done in-solid out-solid');
    expect(html).toContain('pth-stop is-next in-solid out-dots is-hl has-end');
    expect(html).toContain('pth-stop is-ahead in-dots out-dots');
    expect(html).toContain('pth-stop is-add in-dots out-none');
  });
  it('lights one stop, tags it, and strikes the done one with a spoken "Done"', () => {
    expect(count(html, 'pth-lit')).toBe(1);
    expect(html).toContain('<span class="pth-tag">Next</span>');
    expect(html).toContain('<span class="pth-title is-struck"><span class="sr-only">Done: </span>Book dentist appointment</span>');
    expect(html).toContain('aria-label="Email Alex about the race, done"');
    expect(html).toContain('<ul class="pth" aria-label="To-dos">');
  });
  it('makes a pressable row a button and leaves the others plain', () => {
    expect(count(html, '<button')).toBe(2);
    expect(html).toMatch(/<button[^>]*class="pressable pth-main"[^>]*>.*Add a to-do/);
  });
  it('starts at the first stop without a lead, and takes a stop’s own content without the highlight', () => {
    const own = renderToStaticMarkup(
      <PathLine lead={false}>
        <PathStop state="next">
          <b>Set this goal</b>
        </PathStop>
        <PathStop state="ahead" node="dot" caption="Tomorrow · Fri 13" title="Easy 3" subtitle="Z2, conversational" chevron onPress={() => {}} />
      </PathLine>,
    );
    expect(own).toContain('pth-stop is-next in-none out-dots"');
    expect(own).toContain('<b>Set this goal</b>');
    expect(own).toContain('pth-stop is-ahead in-dots out-none is-dot');
    expect(own).toContain('<span class="pth-cap">Tomorrow · Fri 13</span>');
    expect(own).toContain('<span class="pth-sub">Z2, conversational</span>');
    expect(own).toContain('pth-chev');
  });
  it('lets a wrapped stop set its own line', () => {
    const Wrapped = () => <PathStop state="done" title="Wrapped" lineIn="solid" lineOut="dots" />;
    expect(renderToStaticMarkup(<Wrapped />)).toContain('pth-stop is-done in-solid out-dots');
  });
});

describe('FarHills', () => {
  const html = renderToStaticMarkup(
    <FarHills
      hills={[
        { caption: '2026 · 50 days left', words: 'Half marathon under 2:00', onPress: () => {} },
        { caption: 'November' },
        { caption: 'This week · 4 days left', words: 'Set this week’s goal', plus: true, value: '0 of 5', onPress: () => {} },
      ]}
    />,
  );
  it('lays three hills far to near, each with its mark', () => {
    expect(html.indexOf('fh-hill is-far')).toBeLessThan(html.indexOf('fh-hill is-mid'));
    expect(html.indexOf('fh-hill is-mid')).toBeLessThan(html.indexOf('fh-hill is-near'));
    expect(count(html, 'fh-node is-set')).toBe(1);
    expect(count(html, 'fh-node is-plus')).toBe(1);
    expect(count(html, 'class="fh-node"')).toBe(1);
  });
  it('makes only the hills that open something buttons, with a chevron where there are words', () => {
    expect(count(html, '<button')).toBe(2);
    expect(count(html, 'fh-chev')).toBe(2);
    expect(html).toContain('<span class="fh-value">0 of 5</span>');
    expect(html).toContain('aria-label="Further out"');
  });
});

describe('WeekLights', () => {
  const days = [
    { letter: 'F', lit: false },
    { letter: 'S', lit: false },
    { letter: 'S', lit: false },
    { letter: 'M', lit: true },
    { letter: 'T', lit: false },
    { letter: 'W', lit: true },
  ];
  it('shows kept days as lights, missed ones as open rings, and tonight waiting', () => {
    const html = renderToStaticMarkup(<WeekLights days={days} tonight="waiting" />);
    expect(count(html, 'class="wl-lamp"')).toBe(2);
    expect(count(html, 'wl-dim')).toBe(4);
    expect(count(html, 'wl-wait')).toBe(22);
    expect(html).not.toContain('wl-tonight');
    expect(html).toContain('>Tonight</text>');
    expect(html).toContain('aria-hidden="true"');
  });
  it('lights tonight with two rings once saved, without the entrance on a first view', () => {
    const html = renderToStaticMarkup(<WeekLights days={days} tonight="lit" label="3 lines kept this week" />);
    expect(html).toContain('wl-lamp is-tonight');
    expect(count(html, 'wl-ring')).toBe(2);
    expect(html).not.toContain('wl-wait');
    expect(html).not.toContain('is-fresh');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="3 lines kept this week"');
  });
  it('is a picture with no buttons until a day can be picked; then each day before tonight is a button with its name', () => {
    expect(renderToStaticMarkup(<WeekLights days={days} tonight="waiting" label="The week" />)).not.toContain('wl-hit');
    const named = days.map((d, i) => ({ ...d, name: `Day ${i + 1}` }));
    const html = renderToStaticMarkup(<WeekLights days={named} tonight="waiting" label="The week" onPick={() => undefined} />);
    expect(count(html, 'class="wl-hit"')).toBe(6);
    expect(count(html, 'role="button"')).toBe(6);
    expect(html).toContain('aria-label="Day 4"');
    // buttons inside a picture would be hidden from VoiceOver: the picture is a group with the same name
    expect(html).toContain('role="group"');
    expect(html).not.toContain('role="img"');
    expect(html).toContain('aria-label="The week"');
    // tonight is not one of them
    expect(html).not.toContain('aria-label="Tonight"');
  });
});

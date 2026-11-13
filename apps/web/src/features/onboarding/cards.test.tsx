import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DockSample, FitnessSample, JournalSample, sampleDay, sampleFitness, TodaySample } from './cards';

// Pressable reads the app's one context menu and its navigation (mounted in main.tsx), and a now mark asks the shell
// which page is on screen: here a plain button and a plain answer stand in
vi.mock('@/ui/Pressable', () => ({
  Pressable: ({ children, className = '', label, press, onPress, ...rest }: { children?: ReactNode; className?: string; label?: string; press?: string; onPress?: () => void } & Record<string, unknown>) => (
    <button type="button" className={`pressable ${className}`} data-press={press} aria-label={label} {...rest}>
      {children}
    </button>
  ),
}));
vi.mock('@/ui/nowBudget', () => ({ useNowMark: () => 'now', usePageShown: () => true }));

const count = (html: string, part: string) => html.split(part).length - 1;

describe('the sample log behind the Fitness poster', () => {
  it('runs four days a week: Monday, Wednesday, Thursday and Sunday', () => {
    expect(sampleDay('2026-03-02').planned).toBe(4);
    expect(sampleDay('2026-03-03').planned).toBe(0);
    expect(sampleDay('2026-03-04').planned).toBe(5.5);
    expect(sampleDay('2026-03-05').planned).toBe(4);
    expect(sampleDay('2026-03-08').planned).toBe(6.5);
  });
  it('has run every day before the sample today, and nothing from today on', () => {
    expect(sampleDay('2026-03-04')).toMatchObject({ done: 5.5, runs: 1 });
    expect(sampleDay('2026-03-05')).toMatchObject({ done: 0, runs: 0 });
    expect(sampleDay('2026-03-08')).toMatchObject({ done: 0, runs: 0 });
  });
  it('holds nothing before its thirteen weeks, or after this week', () => {
    expect(sampleDay('2025-12-07').planned).toBe(0);
    expect(sampleDay('2025-12-08').planned).toBe(2);
    expect(sampleDay('2026-03-09').planned).toBe(0);
  });
  it('gives the card and the chart the same week, counted by the app’s own rules', () => {
    const f = sampleFitness();
    // the training card's band (heroScene)
    expect(f.scene.mode).toBe('day');
    expect(f.scene.label).toBe('Runs this week');
    expect(f.scene.count).toBe('2 of 4');
    expect(f.scene.second).toBe('9.5 of 20 mi');
    // no workouts in the sample: the band draws no Runs / Workouts pill
    expect(f.scene.views).toEqual(['runs']);
    // the chart at its usual range: thirteen weekly bars, the last one this week with its plan still ahead
    expect(f.span.unit).toBe('week');
    expect(f.marks).toHaveLength(13);
    expect(f.marks.at(-1)).toMatchObject({ current: true, value: 9.5, ahead: 10.5 });
    expect(f.marks.slice(0, -1).every((m) => m.value > 0 && m.ahead === 0)).toBe(true);
    expect(f.readout.big).toBe('167');
    expect(f.readout.context).toBe('mi in 3 months');
    expect(f.today).toBe(4);
  });
});

describe('the welcome pager’s posters', () => {
  const pictures: [string, React.JSX.Element][] = [
    ['Today', <TodaySample live />],
    ['Fitness', <FitnessSample live />],
    ['Journal', <JournalSample />],
  ];
  it.each(pictures)('%s is one picture to a screen reader, and nothing in it takes a touch or the focus', (name, el) => {
    const html = renderToStaticMarkup(el);
    expect(count(html, 'role="img"')).toBe(1);
    expect(html).toMatch(new RegExp(`^<div class="sm [a-z-]+" role="img" aria-label="${name} in Orby\\. `));
    expect(html).toContain('<div class="sm-in" inert="" aria-hidden="true">');
  });
  it('Today is the day poster with a goal set: the to-dos counted on the band, one lit Next stop with its check', () => {
    const html = renderToStaticMarkup(<TodaySample live />);
    expect(html).toContain('Finish the report');
    expect(html).toContain('To-dos today');
    expect(html).toContain('of 3 done');
    expect(count(html, 'pth-stop is-next')).toBe(1);
    expect(count(html, 'pth-check')).toBe(1);
    expect(html).toContain('Add a to-do');
    // "Set this goal" is the app's Sky button: the pager keeps its one Sky button for Get started
    expect(html).not.toContain('btn primary');
  });
  it('Today holds no light and no Sunrise sun while its page is not the one on screen', () => {
    const html = renderToStaticMarkup(<TodaySample live={false} />);
    expect(count(html, 'pth-stop is-next')).toBe(0);
    expect(count(html, 'pth-check')).toBe(0);
    expect(html).toContain('po-sun is-quiet');
  });
  it('Fitness is the training card over the Progress chart', () => {
    const html = renderToStaticMarkup(<FitnessSample live />);
    expect(html).toContain('class="hero aura halo-upcoming hz-card"');
    expect(html).toContain('Easy 4');
    expect(html).toContain('Runs this week');
    expect(html).toContain('2 of 4');
    expect(html).toContain('class="card ph ph-plain no-seg"');
    expect(html).toContain('mi in 3 months');
  });
  it('Journal is the dusk poster with tonight waiting and the line already started', () => {
    const html = renderToStaticMarkup(<JournalSample />);
    expect(html).toContain('po is-dusk');
    expect(html).toContain('What did you learn today?');
    expect(html).toContain('This week · 3 days written');
    expect(html).toContain('Tonight’s line lights the fourth');
    expect(html).toContain('On my run today I learned');
    expect(count(html, 'wl-wait')).toBeGreaterThan(0);
  });
  it('the assistant’s bar is the dock’s, with the screen’s one Orb', () => {
    const html = renderToStaticMarkup(<DockSample />);
    expect(html).toContain('Ask or change anything');
    expect(count(html, 'lb-orb ')).toBe(1);
    const all = pictures.map(([, el]) => renderToStaticMarkup(el)).join('');
    expect(count(all, 'lb-orb')).toBe(0);
  });
});

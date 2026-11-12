import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HEALTH_READS, HEALTH_READS_LINE, HEALTH_SAVED_NOTE, HEALTH_TRUST, healthPitch, healthPlace, importDoneWords, importWords, savedWords } from './healthCopy';

const here = path.dirname(fileURLToPath(import.meta.url));
const files = (dir: string) =>
  fs
    .readdirSync(dir)
    .filter((f) => /\.(tsx?|css)$/.test(f) && !/\.test\./.test(f))
    .map((f) => ({ name: `${path.basename(dir)}/${f}`, text: fs.readFileSync(path.join(dir, f), 'utf8') }));
const settings = files(here);
const health = files(path.join(here, '..', 'health'));
const hits = (list: typeof settings, re: RegExp) => list.filter((f) => re.test(f.text)).map((f) => f.name);

describe('what Settings says about Apple Health', () => {
  it('names exactly sleep, heart rate variability and resting heart rate', () => {
    expect(HEALTH_READS.map(([title]) => title)).toEqual(['Sleep', 'Heart rate variability', 'Resting heart rate']);
    expect(HEALTH_READS_LINE).toBe('Sleep, heart rate variability and resting heart rate');
  });
  it('promises read only and never sold, in the agreed sentence', () => {
    expect(HEALTH_TRUST).toBe('Orby only reads. It never writes to Apple Health and never sells what it reads.');
  });
  it('names the wait with its month', () => {
    expect(importWords(new Date(2026, 10, 1))).toBe('Reading Apple Health: November 2026');
    expect(importWords(null)).toBe('Reading Apple Health…');
  });
  it('words the import’s end by the span that arrived', () => {
    expect(importDoneWords('Since Aug 2026')).toBe('Since Aug 2026: sleep, heart rate variability and resting heart rate are in Fitness, under Trends. Orby keeps up each time you open it.');
    expect(importDoneWords(null)).toBe('Sleep, heart rate variability and resting heart rate are in Fitness, under Trends. Orby keeps up each time you open it.');
  });
  it('says where the numbers are shown, and with Fitness off names no training and no tab that is gone', () => {
    expect(healthPlace(true)).toBe('in Fitness, under Trends');
    expect(healthPlace(false)).toBe('in Settings, under Apple Health');
    expect(importDoneWords('Since Aug 2026', false)).toBe('Since Aug 2026: sleep, heart rate variability and resting heart rate are in Settings, under Apple Health. Orby keeps up each time you open it.');
    expect(healthPitch(true)).toEqual({ title: 'Your sleep and your heart, beside your training.', sub: 'Orby reads three things from Apple Health and shows them in Fitness.' });
    expect(healthPitch(false)).toEqual({ title: 'Your sleep and your heart, day by day.', sub: 'Orby reads three things from Apple Health and shows them in Settings.' });
    for (const s of [healthPlace(true), healthPlace(false), importDoneWords(null), importDoneWords(null, false), healthPitch(true).sub, healthPitch(false).title, healthPitch(false).sub, HEALTH_SAVED_NOTE]) expect(s).not.toMatch(/Progress/);
    for (const s of [healthPlace(false), importDoneWords(null, false), healthPitch(false).title, healthPitch(false).sub, HEALTH_SAVED_NOTE]) expect(s).not.toMatch(/\b(training|fitness|run|plan)\b/i);
  });
  it('says what was saved from the server’s counts and no more', () => {
    const counts = (hrv: number, rhr: number, sleep: number) => ({ counts: { samples: { hrv, resting_hr: rhr }, days: 0, sleep, workouts: 0 }, span: { from: null, to: null } });
    expect(savedWords(counts(0, 0, 0))).toEqual({ sub: 'Nothing yet. It arrives a month at a time, newest first.', since: null });
    expect(savedWords(counts(1200, 300, 4000)).sub).toBe('Your sleep, and 1,500 heart readings');
    expect(savedWords(counts(1, 0, 0)).sub).toBe('1 heart reading');
    expect(savedWords({ ...counts(0, 0, 9), span: { from: '2026-08-14', to: '2026-11-10' } })).toEqual({ sub: 'Your sleep', since: 'Since Aug 2026' });
  });
});

describe('words that must not ship in Settings', () => {
  it('promises no recovery, strain or sleep score', () => {
    expect(hits([...settings, ...health], /recovery|strain|sleep score|sleep need/i)).toEqual([]);
  });
  it('never calls the assistant a coach in a file of this feature', () => {
    expect(hits(settings, /coach/i)).toEqual([]);
  });
  it('spells the American way', () => {
    expect(hits([...settings, ...health], /(?<!\.)\b(colours?|favourites?|centred|centre|grey|kilometres?|cancelled|acknowledgements|behaviour|labelled)\b/i)).toEqual([]);
  });
  it('uses the glossary words (plan, not block; Wake time, not Alarm; Favorite, not Starred)', () => {
    // UI strings only: quoted text and JSX text that a person reads
    const shown = (f: { text: string }) => (f.text.match(/(['`"])(?:(?!\1).)*\1|>[^<>{}]+</g) ?? []).join('\n');
    const said = [...settings, ...health].filter((f) => /\.tsx?$/.test(f.name)).map((f) => ({ name: f.name, text: shown(f) }));
    expect(hits(said, /\b(your|current|this|new) block\b|Lead-in|\bAlarm\b|Starred|Apple Health data/)).toEqual([]);
  });
  it('has no self-hosting or placeholder wording', () => {
    expect(hits(settings, /this Orby|this server|on the way|Kilomet/i)).toEqual([]);
  });
  it('keeps Strava in its own module, so a build without it carries none of its words', () => {
    expect(hits(settings, /strava/i).filter((n) => !/StravaSource|HrZones|dataSources\.css/.test(n)).sort()).toEqual(['settings/DataSources.tsx', 'settings/SettingsView.tsx']);
    for (const name of ['DataSources.tsx', 'SettingsView.tsx']) {
      const text = settings.find((f) => f.name === `settings/${name}`)!.text;
      // every mention outside the module is an import from it or a use behind the build flag
      for (const line of text.split('\n').filter((l) => /strava/i.test(l))) expect(line).toMatch(/STRAVA_BUILT|from '\.\/StravaSource'/);
    }
  });
  it('sizes no text in px', () => {
    const px = /(font-size|line-height)\s*:[^;]*\dpx|font\s*:[^;]*\dpx/;
    expect(hits([...settings, ...health].filter((f) => f.name.endsWith('.css')), px)).toEqual([]);
  });
});

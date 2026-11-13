import { describe, expect, it } from 'vitest';
import { blockShape, defaultRaceDay, firstWeek, HABIT_LIMIT, safeTemplate, templateProblem, type TrainingProfile } from './model';
import { FIRST_WEEK_LABEL, firstIdea, goalHills, habitTiles, helloPoster, longestRun, morningStops, revealTiles, trainPoster, trainPosterFor } from './posterModel';

/** What each first-run poster shows for a set of answers. Setup day is a Monday; the plan starts the day after. */
const today = '2026-11-09';
const start = '2026-11-10';
const half: TrainingProfile = { goal: 'half', raceDate: defaultRaceDay('half', start), runDays: ['tue', 'thu', 'sat', 'sun'], longRunDay: 'sun', weeklyMiles: 18 };
const weekOf = (p: TrainingProfile, wake = 390, leave = 510) => firstWeek(p, start, today, wake, leave);

describe('the name: the assistant\'s greeting', () => {
  it('writes the name as it is typed, and never a sample name', () => {
    expect(helloPoster('', 7)).toBe('Good morning.');
    expect(helloPoster('S', 7)).toBe('Good morning, S.');
    expect(helloPoster('Sam', 7)).toBe('Good morning, Sam.');
    expect(helloPoster('Sam Rivera', 18)).toBe('Good evening, Sam.');
    expect(helloPoster(null, 13)).toBe('Good afternoon.');
  });
});

describe('the training card (the days question, the reveal)', () => {
  it('names the first run and says when it is and where the long run sits', () => {
    const w = weekOf(half);
    const p = trainPoster(w, half);
    expect(p.name).toBe(w.days.find((d) => d.session === w.first)!.label);
    expect(p.name).toMatch(/^[A-Z][a-z]+ \d/);
    expect(p.line).toBe('Tomorrow · Long run Sunday');
  });
  it('counts the plan\'s first seven days on the horizon: one open mark a run, nothing done, the sun at rest', () => {
    const w = weekOf(half);
    const p = trainPoster(w, half);
    expect(p.runs).toBe(4);
    expect(p.scene.mode).toBe('day');
    expect(p.scene.view).toBe('runs');
    // one view: the Runs / Workouts pill is not drawn
    expect(p.scene.views).toEqual(['runs']);
    expect(p.scene.marks).toHaveLength(4);
    expect(p.scene.marks.every((m) => !m.lit)).toBe(true);
    expect(p.scene.f).toBe(0);
    expect(p.scene.target).toBe(true);
    expect(p.scene.complete).toBe(false);
    expect(p.scene.label).toBe(FIRST_WEEK_LABEL);
    expect(p.scene.count).toBe('0 of 4');
    expect(p.scene.second).toBe(`0 of ${Math.round(w.miles * 10) / 10} mi`);
  });
  it('a day tapped on or off changes the marks and the count', () => {
    const three = { ...half, runDays: ['tue', 'thu', 'sun'] as TrainingProfile['runDays'] };
    const five = { ...half, runDays: ['mon', 'tue', 'thu', 'sat', 'sun'] as TrainingProfile['runDays'] };
    expect(trainPoster(weekOf(three), three).scene.marks).toHaveLength(3);
    expect(trainPoster(weekOf(three), three).scene.count).toBe('0 of 3');
    expect(trainPoster(weekOf(five), five).scene.marks).toHaveLength(5);
    expect(trainPoster(weekOf(five), five).scene.count).toBe('0 of 5');
  });
  it('the miles stepper changes the week\'s miles', () => {
    const lo = trainPoster(weekOf(half), half);
    const more = { ...half, weeklyMiles: 30 };
    const hi = trainPoster(weekOf(more), more);
    expect(hi.miles).toBeGreaterThan(lo.miles);
    expect(hi.scene.second).not.toBe(lo.scene.second);
  });
  it('the long run moves with the hold, and one run day has no long run to name', () => {
    const sat = { ...half, longRunDay: 'sat' as const };
    expect(trainPoster(weekOf(sat), sat).line).toBe('Tomorrow · Long run Saturday');
    // the long run's day switched off: the last run day takes it (the long-run hold, model.ts fixLongRun)
    const noSun = { ...half, runDays: ['tue', 'thu', 'sat'] as TrainingProfile['runDays'] };
    expect(trainPoster(weekOf(noSun), noSun).line).toBe('Tomorrow · Long run Saturday');
    const one = { ...half, runDays: ['thu'] as TrainingProfile['runDays'], longRunDay: 'thu' as const, weeklyMiles: 4 };
    expect(trainPoster(weekOf(one), one).line).toBe('Thursday');
  });
  it('answers that build no plan say what to change, in the builder\'s words, and draw no marks', () => {
    // 18 miles a week on one run day: the builder refuses
    const one = { ...half, runDays: ['thu'] as TrainingProfile['runDays'], longRunDay: 'thu' as const };
    const { week, poster } = trainPosterFor(one, start, today, 390, 510);
    expect(week.first).toBeNull();
    expect(templateProblem(one, start)).toMatch(/needs at least \d run days\.$/);
    expect(poster.line).toBe(templateProblem(one, start));
    expect(poster.name).toBe('Your first run');
    expect(poster.scene.marks).toHaveLength(0);
    // and answers that do build one have no problem to say
    expect(templateProblem(half, start)).toBeNull();
  });
  it('says the picture in one sentence for VoiceOver', () => {
    const p = trainPoster(weekOf(half), half);
    expect(p.said).toContain(p.name);
    expect(p.said).toMatch(/Week one: 4 runs, [\d.]+ miles\.$/);
    expect(p.scene.said).toBe(p.said);
  });
});

describe('the morning: the card\'s timeline row', () => {
  it('before work: Wake, Door, Back, Leave, read off the real morning', () => {
    const w = weekOf(half, 390, 510);
    const m = morningStops({ week: w, wake: 390, leave: 510, afternoon: null });
    expect(m.stops.map((s) => s.label)).toEqual(['Wake', 'Door', 'Back', 'Leave']);
    expect(m.stops[0]!.at).toBe(390);
    expect(m.stops[1]!.at).toBe(w.morning!.door);
    expect(m.stops[2]!.at).toBe(w.morning!.back);
    expect(m.stops[3]!.at).toBe(510);
    // the four times never run backward
    expect(m.stops.map((s) => s.at)).toEqual([...m.stops.map((s) => s.at)].sort((a, b) => a - b));
    expect(m.line).toMatch(/^Out the door \d+:\d\d$/);
    expect(m.tight).toBe(false);
  });
  it('dragging a marker moves the times', () => {
    const early = morningStops({ week: weekOf(half, 330, 480), wake: 330, leave: 480, afternoon: null });
    expect(early.stops[0]!.at).toBe(330);
    expect(early.stops[3]!.at).toBe(480);
    expect(early.stops[1]!.at).toBeLessThan(morningStops({ week: weekOf(half, 390, 510), wake: 390, leave: 510, afternoon: null }).stops[1]!.at);
  });
  it('says so when the run does not fit before work', () => {
    const m = morningStops({ week: weekOf(half, 450, 510), wake: 450, leave: 510, afternoon: null });
    expect(m.tight).toBe(true);
    // the two times stay the person's own, so the row and the markers never disagree
    expect(m.stops[0]!.at).toBe(450);
    expect(m.stops[3]!.at).toBe(510);
  });
  it('after work: the afternoon\'s own row, from when work ends', () => {
    const m = morningStops({ week: weekOf(half), wake: 390, leave: 510, afternoon: 17 * 60 + 30 });
    expect(m.stops.map((s) => s.label)).toEqual(['Off work', 'Run', 'Back', 'Dinner']);
    expect(m.stops[0]!.at).toBe(17 * 60 + 30);
    // the trip home and changing: 40 minutes (model.ts AFTER_WORK_LEAD)
    expect(m.stops[1]!.at).toBe(17 * 60 + 30 + 40);
    expect(m.line).toMatch(/^Run at 6:10/);
    expect(m.tight).toBe(false);
  });
});

describe('the goal: the build as three hills', () => {
  it('before a goal is picked the hills carry their names only', () => {
    const g = goalHills(null, null, null);
    expect(g.title).toBe('Your plan');
    expect(g.hills.map((h) => h.caption)).toEqual(['Race day', 'Peak week', 'Week one']);
    expect(g.hills.every((h) => h.words === undefined)).toBe(true);
  });
  it('a race is the far hill, with its date and its weeks; the peak carries the taper', () => {
    const shape = blockShape(safeTemplate(half, start))!;
    const w = weekOf(half);
    const g = goalHills(half, shape, w);
    expect(g.title).toBe(`${shape.weeks} weeks`);
    expect(g.hills[0].caption).toMatch(/^Race day · [A-Z][a-z]{2} \d+$/);
    expect(g.hills[0].words).toBe('Half marathon');
    expect(g.hills[0].value).toBe(`${shape.weeks} wk`);
    expect(g.hills[1].caption).toBe('Peak week');
    expect(g.hills[1].words).toContain(`${shape.peak} mi`);
    expect(g.hills[1].words).toContain(`long run ${longestRun(w)}`);
    expect(g.hills[1].value).toBe(`${shape.taperWeeks} wk taper`);
    expect(g.hills[2]).toEqual({ caption: 'Week one', words: `${shape.from} mi over 4 runs` });
  });
  it('picking another race redraws the build', () => {
    const marathon = { ...half, goal: 'marathon' as const, raceDate: defaultRaceDay('marathon', start), weeklyMiles: 28 };
    const a = goalHills(half, blockShape(safeTemplate(half, start)), weekOf(half));
    const b = goalHills(marathon, blockShape(safeTemplate(marathon, start)), weekOf(marathon));
    expect(b.hills[0].words).toBe('Marathon');
    expect(b.title).not.toBe(a.title);
    expect(b.hills[1].words).not.toBe(a.hills[1].words);
  });
  it('a race with no date yet says so, and just running has no race and no taper', () => {
    const undated = { ...half, raceDate: null };
    expect(goalHills(undated, blockShape(safeTemplate(undated, start)), weekOf(undated)).hills[0].words).toBe('Half marathon, no date yet');
    const base = { ...half, goal: 'base' as const, raceDate: null, weeklyMiles: 12 };
    const shape = blockShape(safeTemplate(base, start))!;
    const g = goalHills(base, shape, weekOf(base));
    expect(g.hills[0]).toEqual({ caption: `Week ${shape.weeks}`, words: `${shape.peak} mi a week`, value: 'No race' });
    expect(g.hills[1].value).toBeUndefined();
    expect(g.said).not.toMatch(/taper|Race day/);
  });
  it('no caption runs past four words', () => {
    for (const p of [half, { ...half, goal: 'base' as const, raceDate: null }, { ...half, raceDate: null }]) {
      const g = goalHills(p, blockShape(safeTemplate(p, start)), weekOf(p));
      for (const h of g.hills) expect(h.caption.replace(/·/g, ' ').trim().split(/\s+/).length).toBeLessThanOrEqual(4);
    }
  });
});

describe('the habits: one tile a chip', () => {
  it('each habit picked is a tile, in the order picked; none is none', () => {
    expect(habitTiles([])).toEqual([]);
    expect(habitTiles(['Stretch', 'Protein'])).toEqual(['Stretch', 'Protein']);
  });
  it('never more tiles than the account holds', () => {
    const many = Array.from({ length: HABIT_LIMIT + 3 }, (_, i) => `Habit ${i}`);
    expect(habitTiles(many)).toHaveLength(HABIT_LIMIT);
  });
  it('the reveal shows two rows of two and says how many more wait on Today', () => {
    expect(revealTiles(['a', 'b', 'c'])).toEqual({ shown: ['a', 'b', 'c'], more: 0 });
    expect(revealTiles(['a', 'b', 'c', 'd', 'e', 'f'])).toEqual({ shown: ['a', 'b', 'c', 'd'], more: 2 });
    expect(revealTiles([])).toEqual({ shown: [], more: 0 });
  });
});

describe('the first move: the goal Today will suggest', () => {
  it('comes from the habits just picked', () => {
    expect(firstIdea({ habits: 3, fitness: true, minutes: 14 * 60 })).toMatchObject({ source: 'habits', text: 'All 3 habits, done by 9', label: 'An idea · from your habits' });
    expect(firstIdea({ habits: 1, fitness: false, minutes: 9 * 60 })?.text).toBe('Your one habit, done by 9');
    expect(firstIdea({ habits: 2, fitness: true, minutes: 21 * 60 })?.text).toBe('Both habits, done before bed');
  });
  it('with no habit there is no idea: Today asks for the person\'s own words', () => {
    expect(firstIdea({ habits: 0, fitness: true, minutes: 9 * 60 })).toBeNull();
    expect(firstIdea({ habits: 0, fitness: false, minutes: 9 * 60 })).toBeNull();
  });
});

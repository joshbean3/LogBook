import { addChallenge, challengeTitle, easierChallenge, emptyRewards, menuFor, offerInto, reasonAllowed, shiftDays, skipChallenge, withPick, type Baseline, type Challenge, type ChallengeFacts, type DayFacts, type Offer, type Rewards, type Slot } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { acceptPick, actionsFor, addWords, ASK_FAILED, ASK_WORDS, ASKING, doneWords, eyebrowOf, isPickable, parsePick, payLine, PICKED_CAPTION, progressWords, rowsFor, rowView, sheetLine, shownAs, whatCounts, worthAsking, worthWords, type RowView } from './model';
import { askPick, mayAskFor, pickCapable } from './pick';
import { getOrbs, openOrbs, resetOrbsForTest, setOrbs } from '../store';

/**
 * The challenge row and sheet as rules: which row shows when, the words for each state, when each action is offered, and
 * what an answer from the server may and may not change. Mondays: 2026-11-16 is one.
 */
const U = 'user-1';
const MON = '2026-11-16';
const day = (n: number) => shiftDays(MON, n);
const at = (d: string, h = 9) => new Date(`${d}T${String(h).padStart(2, '0')}:00:00`);
const daySlot = (d: string): Slot => ({ key: `challenge:d:${d}`, kind: 'day', date: d, seed: 0 });
const weekSlot = (m: string = MON): Slot => ({ key: `challenge:w:${m}`, kind: 'week', date: m, seed: 0 });
const dayFacts = (date: string, o: Partial<DayFacts> = {}): DayFacts => ({ date, todosDone: 0, todosEarlier: 0, habitsLive: 3, habitsDone: 0, habitsLiveDone: 0, lines: 0, train: {}, trainRequired: false, trainLeft: 0, goalDay: 'open', held: false, ...o });
const facts = (today: string, o: { day?: Partial<DayFacts>; week?: Partial<ChallengeFacts['week']>; fitness?: boolean; todosOpen?: number; planned?: ChallengeFacts['planned'] } = {}): ChallengeFacts => ({
  today,
  fitness: o.fitness ?? true,
  day: dayFacts(today, o.day),
  todosOpen: o.todosOpen ?? 0,
  planned: o.planned ?? [],
  week: { monday: MON, counted: 0, fullDays: 0, habitDays: 0, goal: 'none', sessions: { planned: 0, done: 0 }, paused: 0, ...o.week },
});
const ch = (o: Partial<Challenge> & Pick<Challenge, 'item' | 'target'>): Challenge => ({ base: 0, state: 'offered', at: at(MON).toISOString(), ...o });

describe('the words', () => {
  it('the fixed ones are the spec’s, and nothing else', () => {
    expect(eyebrowOf('day')).toBe('Today’s challenge');
    expect(eyebrowOf('week')).toBe('This week’s challenge');
    expect(addWords('day')).toBe('Add to today');
    expect(addWords('week')).toBe('Add to this week');
    expect(ASK_WORDS).toBe('Ask the assistant to pick');
    expect(PICKED_CAPTION).toBe('Picked by the assistant');
    expect(ASK_FAILED).toBe('Couldn’t ask just now.');
    // a caption is four words at most
    expect(PICKED_CAPTION.split(' ').length).toBeLessThanOrEqual(4);
    expect(eyebrowOf('week').split(' ').length).toBeLessThanOrEqual(4);
  });

  it('what it is worth: 5 for a day, 10 to 20 for a week with a floor, 20 for one without', () => {
    expect(worthWords('day', { target: 3 })).toBe('5 Orbs');
    expect(worthWords('week', { target: 5, floor: 4 })).toBe('10 to 20 Orbs');
    expect(worthWords('week', { target: 1 })).toBe('20 Orbs');
    expect(payLine('day', { item: 'habits', target: 3 })).toBe('5 Orbs.');
    expect(payLine('week', { item: 'days', target: 5, floor: 4 })).toBe('10 Orbs at 4 days, 20 at 5.');
    expect(payLine('week', { item: 'sessions', target: 2, floor: 1 })).toBe('10 Orbs at 1 session, 20 at 2.');
    expect(payLine('week', { item: 'full-days', target: 2, floor: 1 })).toBe('10 Orbs at 1 day, 20 at 2.');
    expect(payLine('week', { item: 'goal-week', target: 1 })).toBe('20 Orbs.');
  });

  it('the sheet’s one line says what counts and what it pays', () => {
    const f = facts(MON);
    expect(sheetLine('day', ch({ item: 'habits', target: 3 }), f)).toBe('Every habit you have today. 5 Orbs.');
    expect(sheetLine('day', ch({ item: 'goal', target: 1 }), f)).toBe('Today’s goal, marked done. 5 Orbs.');
    expect(sheetLine('day', ch({ item: 'session:run', target: 1 }), f)).toBe('Today’s planned session. Its floor counts. 5 Orbs.');
    expect(sheetLine('day', ch({ item: 'list', target: 2 }), f)).toBe('Every to-do on today’s list when you add this. 5 Orbs.');
    expect(sheetLine('week', ch({ item: 'days', target: 5, floor: 4 }), f)).toBe('A day counts when you finish one thing. 10 Orbs at 4 days, 20 at 5.');
    expect(sheetLine('week', ch({ item: 'sessions', target: 3, floor: 2 }), f)).toBe('Every session in this week’s plan but one. Floors count. 10 Orbs at 2 sessions, 20 at 3.');
    expect(sheetLine('week', ch({ item: 'goal-week', target: 1 }), f)).toBe('This week’s goal, marked done. 20 Orbs.');
    expect(sheetLine('week', ch({ item: 'habit-days', target: 4, floor: 3 }), f)).toBe('A day counts when every habit is done. 10 Orbs at 3 days, 20 at 4.');
  });

  it('a full day is said from the person’s own day: the habits they have, the session only when one is asked', () => {
    const full = ch({ item: 'full', target: 1 });
    expect(whatCounts(full, facts(MON, { day: { habitsLive: 4, trainRequired: true } }))).toBe('Today’s goal, every habit but one and today’s session.');
    expect(whatCounts(full, facts(MON, { day: { habitsLive: 2 } }))).toBe('Today’s goal and both habits.');
    expect(whatCounts(full, facts(MON, { day: { habitsLive: 1 } }))).toBe('Today’s goal and your habit.');
    expect(whatCounts(full, facts(MON, { day: { habitsLive: 0 } }))).toBe('Today’s goal.');
    expect(whatCounts(ch({ item: 'full-days', target: 2 }), facts(MON))).toBe('A full day is the day’s goal, every habit but one and any planned session.');
    expect(whatCounts(ch({ item: 'full-days', target: 2 }), facts(MON, { fitness: false }))).toBe('A full day is the day’s goal and every habit but one.');
  });

  it('progress is plain words, with no worth and never a zero', () => {
    expect(progressWords('day', { item: 'habits', target: 3 }, 2)).toBe('2 of 3 habits');
    expect(progressWords('day', { item: 'habits', target: 3 }, 0)).toBe('Added to today');
    expect(progressWords('day', { item: 'list', target: 4 }, 1)).toBe('1 of 4 done');
    expect(progressWords('day', { item: 'goal', target: 1 }, 0)).toBe('Added to today');
    expect(progressWords('week', { item: 'days', target: 5 }, 3)).toBe('3 days so far');
    expect(progressWords('week', { item: 'days', target: 5 }, 1)).toBe('1 day so far');
    expect(progressWords('week', { item: 'days', target: 5 }, 0)).toBe('Added to this week');
    expect(progressWords('week', { item: 'sessions', target: 3 }, 2)).toBe('2 sessions so far');
    expect(progressWords('week', { item: 'full-days', target: 2 }, 1)).toBe('1 full day so far');
    expect(progressWords('week', { item: 'goal-week', target: 1 }, 0)).toBe('Added to this week');
    for (const item of ['habits', 'goal', 'list', 'full', 'session:run', 'days', 'sessions', 'goal-week', 'habit-days', 'full-days'])
      for (const kind of ['day', 'week'] as const)
        for (let p = 0; p <= 5; p++) {
          const w = progressWords(kind, { item, target: 5 }, p);
          expect(w).not.toMatch(/\b0\b|Orbs/);
        }
    expect(doneWords(5)).toBe('Done · 5 Orbs');
  });
});

describe('which row shows, and as what', () => {
  it('an offer shows only while it can still be added', () => {
    const slot = daySlot(MON);
    const c = ch({ item: 'habits', target: 3 });
    expect(shownAs(c, slot, facts(MON), MON)).toBe('offered');
    // nothing left to do: not offered
    expect(shownAs(c, slot, facts(MON, { day: { habitsLiveDone: 3, habitsDone: 3 } }), MON)).toBeNull();
    // a paused day: nothing
    expect(shownAs(c, slot, facts(MON, { day: { held: true } }), MON)).toBeNull();
    // another day
    expect(shownAs(c, slot, facts(day(1)), day(1))).toBeNull();
    // a week offer: Monday to Wednesday, and not with a paused day in the week
    const w = ch({ item: 'days', target: 5, floor: 4 });
    expect(shownAs(w, weekSlot(), facts(day(2)), day(2))).toBe('offered');
    expect(shownAs(w, weekSlot(), facts(day(3)), day(3))).toBeNull();
    expect(shownAs(w, weekSlot(), facts(MON, { week: { paused: 1 } }), MON)).toBeNull();
    expect(shownAs(undefined, slot, facts(MON), MON)).toBeNull();
  });

  it('an added one shows while it runs, a done one for the rest of its day, and a skipped, dropped or void one never', () => {
    const slot = daySlot(MON);
    const added = ch({ item: 'habits', target: 3, state: 'added' });
    expect(shownAs(added, slot, facts(MON, { day: { habitsLiveDone: 1 } }), MON)).toBe('added');
    // met, a frame before the reconciler stores it
    expect(shownAs(added, slot, facts(MON, { day: { habitsLiveDone: 3 } }), MON)).toBe('done');
    // its day was paused: it ends with nothing said
    expect(shownAs(added, slot, facts(MON, { day: { held: true } }), MON)).toBeNull();
    // the day after: lapsed, nothing said
    expect(shownAs(added, slot, facts(day(1)), day(1))).toBeNull();
    const done = ch({ item: 'habits', target: 3, state: 'done' });
    expect(shownAs(done, slot, facts(MON), MON)).toBe('done');
    expect(shownAs(done, slot, facts(day(1)), day(1))).toBeNull();
    for (const state of ['skipped', 'void'] as const) expect(shownAs(ch({ item: 'habits', target: 3, state }), slot, facts(MON), MON)).toBeNull();
    // a week challenge: added all week, done only on the day it was finished
    const w = ch({ item: 'days', target: 5, floor: 4, state: 'added' });
    expect(shownAs(w, weekSlot(), facts(day(5), { week: { counted: 3 } }), day(5))).toBe('added');
    const wDone = ch({ item: 'days', target: 5, floor: 4, state: 'done', at: at(day(4), 20).toISOString() });
    expect(shownAs(wDone, weekSlot(), facts(day(4), { week: { counted: 5 } }), day(4))).toBe('done');
    expect(shownAs(wDone, weekSlot(), facts(day(5), { week: { counted: 5 } }), day(5))).toBeNull();
  });

  it('the row’s words: the engine’s title, what it is and its worth, then progress, then Done', () => {
    const slot = daySlot(MON);
    const offered = rowView(ch({ item: 'habits', target: 3 }), slot, facts(MON), MON)!;
    expect(offered).toMatchObject({ title: 'Every habit today', sub: 'Today’s challenge · 5 Orbs', shown: 'offered', kind: 'day' });
    expect(offered.caption).toBeUndefined();
    expect(offered.label).toBe('Today’s challenge: Every habit today. 5 Orbs. Open');
    const added = rowView(ch({ item: 'habits', target: 3, state: 'added' }), slot, facts(MON, { day: { habitsLiveDone: 2 } }), MON)!;
    expect(added.sub).toBe('2 of 3 habits');
    expect(added.sub).not.toContain('Orbs');
    expect(added.label).toBe('Today’s challenge: Every habit today. 2 of 3 habits. Open');
    const done = rowView(ch({ item: 'habits', target: 3, state: 'done' }), slot, facts(MON, { day: { habitsLiveDone: 3 } }), MON, 5)!;
    expect(done.sub).toBe('Done · 5 Orbs');
    const week = rowView(ch({ item: 'days', target: 5, floor: 4 }), weekSlot(), facts(MON), MON)!;
    expect(week).toMatchObject({ title: 'Every day this week, two days off', sub: 'This week’s challenge · 10 to 20 Orbs' });
    // a week challenge done at its floor says what it paid
    const floor = rowView(ch({ item: 'days', target: 5, floor: 4, state: 'done', at: at(day(7), 8).toISOString() }), weekSlot(), { ...facts(day(7), { week: { counted: 4 } }) }, day(7), 10)!;
    expect(floor.sub).toBe('Done · 10 Orbs');
    expect(rowView(ch({ item: 'habits', target: 3, state: 'skipped' }), slot, facts(MON), MON)).toBeNull();
  });

  it('a row the assistant picked says so in its caption, with the reason under the title', () => {
    const c = ch({ item: 'goal', target: 1, by: 'assistant', why: 'Your report draft is the day’s one big thing.' });
    const v = rowView(c, daySlot(MON), facts(MON), MON)!;
    expect(v).toMatchObject({ caption: 'Picked by the assistant', title: 'Today’s goal, done', sub: 'Your report draft is the day’s one big thing.', reason: 'Your report draft is the day’s one big thing.' });
    expect(v.label).toBe('Today’s challenge: Today’s goal, done. Picked by the assistant. Your report draft is the day’s one big thing. 5 Orbs. Open');
    // once added the line under the title is progress; the caption stays
    const added = rowView({ ...c, state: 'added' }, daySlot(MON), facts(MON), MON)!;
    expect(added).toMatchObject({ caption: 'Picked by the assistant', sub: 'Added to today' });
  });

  it('Today shows at most one row: the day challenge on its day, or the week challenge on a Monday with no day challenge', () => {
    const v = (key: string, kind: Slot['kind'], shown: RowView['shown'] = 'offered'): RowView => ({ key, kind, shown, title: 't', sub: 's', label: 'l' });
    const d = daySlot(MON);
    const w = weekSlot();
    const last = weekSlot(shiftDays(MON, -7));
    const slots = [d, w, last];
    const both = { [d.key]: v(d.key, 'day'), [w.key]: v(w.key, 'week') };
    expect(rowsFor('today', slots, both, MON).map((r) => r.key)).toEqual([d.key]);
    expect(rowsFor('today', slots, { [w.key]: both[w.key]! }, MON).map((r) => r.key)).toEqual([w.key]);
    expect(rowsFor('today', slots, { [d.key]: null, [w.key]: both[w.key]! }, MON).map((r) => r.key)).toEqual([w.key]);
    // Tuesday: the week challenge is on the Orbs page only
    const tue = day(1);
    const dTue = daySlot(tue);
    expect(rowsFor('today', [dTue, w, last], { [w.key]: v(w.key, 'week', 'added') }, tue)).toEqual([]);
    expect(rowsFor('today', [dTue, w, last], { [dTue.key]: v(dTue.key, 'day'), [w.key]: v(w.key, 'week', 'added') }, tue).map((r) => r.key)).toEqual([dTue.key]);
    expect(rowsFor('today', slots, {}, MON)).toEqual([]);
    // the Orbs page: both, the week's first, and last week's when it was finished today
    expect(rowsFor('page', slots, both, MON).map((r) => r.key)).toEqual([w.key, d.key]);
    expect(rowsFor('page', slots, { ...both, [last.key]: v(last.key, 'week', 'done') }, MON).map((r) => r.key)).toEqual([w.key, d.key, last.key]);
    expect(rowsFor('page', slots, { [last.key]: v(last.key, 'week', 'added') }, MON)).toEqual([]);
    expect(rowsFor('page', [dTue, w, last], { [w.key]: v(w.key, 'week', 'added') }, tue).map((r) => r.key)).toEqual([w.key]);
  });
});

describe('when each action is offered', () => {
  const menu: Offer[] = [
    { item: 'habits', target: 3, base: 0 },
    { item: 'goal', target: 1, base: 0 },
    { item: 'list', target: 2, base: 0 },
  ];
  it('an offer: Add (while it can be added), Skip, Easier only where the engine says so, and Ask only when allowed', () => {
    const slot = daySlot(MON);
    const c = ch({ item: 'habits', target: 3 });
    expect(actionsFor(c, slot, facts(MON), MON, { mayAsk: false, menu })).toEqual({ add: 'Add to today', skip: true, easier: false, ask: false, drop: false });
    expect(actionsFor(c, slot, facts(MON), MON, { mayAsk: true, menu }).ask).toBe(true);
    // a week of days above its lower bound has a size
    const w = ch({ item: 'days', target: 5, floor: 4 });
    expect(actionsFor(w, weekSlot(), facts(MON), MON, { mayAsk: false, menu: [] })).toEqual({ add: 'Add to this week', skip: true, easier: true, ask: false, drop: false });
    expect(actionsFor(ch({ item: 'days', target: 3, floor: 2 }), weekSlot(), facts(MON), MON, { mayAsk: false, menu: [] }).easier).toBe(false);
    // nothing left to do: nothing is offered at all
    expect(actionsFor(c, slot, facts(MON, { day: { habitsLiveDone: 3 } }), MON, { mayAsk: true, menu })).toEqual({ add: null, skip: false, easier: false, ask: false, drop: false });
  });

  it('Ask is not offered when the assistant already picked, or when there is no choice to make', () => {
    const slot = daySlot(MON);
    const picked = ch({ item: 'goal', target: 1, by: 'assistant', why: 'It fits.' });
    expect(actionsFor(picked, slot, facts(MON), MON, { mayAsk: true, menu }).ask).toBe(false);
    const c = ch({ item: 'habits', target: 3 });
    // one item the assistant may be shown (the habit item is never sent): no choice
    expect(actionsFor(c, slot, facts(MON), MON, { mayAsk: true, menu: menu.slice(0, 2) }).ask).toBe(false);
    expect(worthAsking(menu)).toBe(true);
    expect(worthAsking([{ item: 'habits', target: 3, base: 0 }, { item: 'habit-days', target: 3, base: 0 }, { item: 'full-days', target: 2, base: 0 }])).toBe(false);
  });

  it('an added one: Drop it, and nothing else. A done one: nothing', () => {
    const slot = daySlot(MON);
    expect(actionsFor(ch({ item: 'habits', target: 3, state: 'added' }), slot, facts(MON), MON, { mayAsk: true, menu })).toEqual({ add: null, skip: false, easier: false, ask: false, drop: true });
    expect(actionsFor(ch({ item: 'habits', target: 3, state: 'done' }), slot, facts(MON), MON, { mayAsk: true, menu })).toEqual({ add: null, skip: false, easier: false, ask: false, drop: false });
  });

  it('the action shows only with the capability, the assistant allowed and its training switch on', () => {
    expect(pickCapable({ claude: true, strava: false, challengePick: true })).toBe(true);
    // an older server sends no such key
    expect(pickCapable({ claude: true, strava: false })).toBe(false);
    expect(pickCapable({ claude: true, challengePick: 'yes' })).toBe(false);
    expect(pickCapable(undefined)).toBe(false);
    const yes = { claude: true, challengePick: true };
    expect(mayAskFor(yes, 'on')).toBe(true);
    for (const access of ['off', 'none', 'unknown'] as const) expect(mayAskFor(yes, access)).toBe(false);
    expect(mayAskFor({ claude: true }, 'on')).toBe(false);
  });
});

describe('the engine’s ops, as the sheet uses them', () => {
  it('Add, Easier, Skip and Drop it: the row follows, and a skipped or dropped one leaves nothing to show', () => {
    const slot = weekSlot();
    const f = facts(MON);
    let s: Rewards = offerInto(emptyRewards(U, shiftDays(MON, -35)), slot, { item: 'days', target: 5, floor: 4, base: 0 }, at(MON, 7));
    expect(rowView(s.challenges[slot.key], slot, f, MON)?.title).toBe('Every day this week, two days off');
    s = easierChallenge(s, slot.key);
    expect(rowView(s.challenges[slot.key], slot, f, MON)).toMatchObject({ title: 'Every day this week, three days off', sub: 'This week’s challenge · 10 to 20 Orbs' });
    const added = addChallenge(s, slot, f, at(MON, 8));
    expect(rowView(added.challenges[slot.key], slot, facts(day(1), { week: { counted: 1 } }), day(1))?.sub).toBe('1 day so far');
    for (const gone of [skipChallenge(s, slot.key, at(MON, 9)), skipChallenge(added, slot.key, at(day(1), 9))]) {
      expect(gone.challenges[slot.key]?.state).toBe('skipped');
      expect(rowView(gone.challenges[slot.key], slot, f, MON)).toBeNull();
      expect(actionsFor(gone.challenges[slot.key], slot, f, MON, { mayAsk: true, menu: [] })).toEqual({ add: null, skip: false, easier: false, ask: false, drop: false });
      expect(Object.keys(gone.once)).toEqual([]);
    }
  });
});

describe('the assistant’s answer', () => {
  const own: Offer[] = [
    { item: 'habits', target: 3, base: 0 },
    { item: 'goal', target: 1, base: 0 },
    { item: 'list', target: 2, base: 0 },
    { item: 'days', target: 4, floor: 3, base: 0 },
  ];
  it('is read as untrusted', () => {
    expect(parsePick({ item: 'goal', target: 1, why: 'It fits.', by: 'assistant' })).toEqual({ item: 'goal', target: 1, why: 'It fits.', by: 'assistant' });
    expect(parsePick({ item: 'days', target: 4, floor: 3, by: 'rule' })).toEqual({ item: 'days', target: 4, floor: 3, by: 'rule' });
    for (const bad of [null, 'goal', [], { item: 'goal' }, { item: 3, target: 1, by: 'assistant' }, { item: 'goal', target: '1', by: 'assistant' }, { item: 'goal', target: 1.5, by: 'assistant' }, { item: 'goal', target: 1, by: 'someone' }]) expect(parsePick(bad)).toBeNull();
  });

  it('only the assistant’s own pick is taken, only an item it may choose, and only one on this phone’s own menu', () => {
    const yes = (item: string, target: number, floor?: number) => ({ item, target, floor, why: 'It fits what you have on.', by: 'assistant' as const });
    expect(acceptPick(yes('goal', 1), own)).toEqual(own[1]);
    // the server's target for an item with no size is ignored: this phone's own stands
    expect(acceptPick(yes('list', 9), own)).toEqual(own[2]);
    // the rule's pick from the server changes nothing
    expect(acceptPick({ item: 'goal', target: 1, by: 'rule' }, own)).toBeNull();
    // no reason, no pick
    expect(acceptPick({ item: 'goal', target: 1, by: 'assistant' }, own)).toBeNull();
    // habits are never sent, so never picked, whatever the server says
    expect(acceptPick(yes('habits', 3), own)).toBeNull();
    expect(acceptPick(yes('habit-days', 3), [...own, { item: 'habit-days', target: 3, base: 0 }])).toBeNull();
    // not on this phone's menu (its session is already done here, by a tracked run the server does not count)
    expect(acceptPick(yes('session:run', 1), own)).toBeNull();
    expect(acceptPick(yes('run-ten-miles', 10), own)).toBeNull();
    expect(acceptPick(null, own)).toBeNull();
  });

  it('a week of days: the lower target is taken, inside the bounds; a higher one is refused', () => {
    const yes = (target: number) => ({ item: 'days', target, floor: target - 1, why: 'A steady week suits your plans.', by: 'assistant' as const });
    expect(acceptPick(yes(4), own)).toEqual(own[3]);
    expect(acceptPick(yes(3), own)).toEqual({ item: 'days', target: 3, floor: 2, base: 0 });
    expect(acceptPick(yes(5), own)).toBeNull();
    expect(acceptPick(yes(2), own)).toBeNull();
    expect(acceptPick(yes(7), own)).toBeNull();
  });

  it('asking applies the pick with the engine’s own check, and any failure leaves the challenge as it was', async () => {
    const slot = daySlot(MON);
    const start = () => {
      resetOrbsForTest();
      openOrbs(U);
      setOrbs(offerInto(emptyRewards(U, shiftDays(MON, -35)), slot, { item: 'habits', target: 3, base: 0 }, at(MON, 7)));
      return getOrbs()!.challenges[slot.key];
    };
    const menu = () => own;
    const online = () => false;
    // the assistant's pick
    let before = start();
    const sent: string[] = [];
    expect(await askPick(slot.key, menu, { offline: online, send: async (k) => (sent.push(k), { item: 'goal', target: 1, why: ' Your report draft is the one big thing. ', by: 'assistant' }) })).toBe(true);
    expect(sent).toEqual([slot.key]);
    expect(getOrbs()!.challenges[slot.key]).toEqual({ item: 'goal', target: 1, base: 0, state: 'offered', at: before!.at, by: 'assistant', why: 'Your report draft is the one big thing.' });
    // every way it can come to nothing
    const fails: Array<[string, () => Promise<unknown>]> = [
      ['the request fails', async () => Promise.reject(new Error('offline'))],
      ['the rule’s pick comes back', async () => ({ item: 'goal', target: 1, by: 'rule' })],
      ['an item off this phone’s menu', async () => ({ item: 'session:run', target: 1, why: 'It fits.', by: 'assistant' })],
      ['a habit item', async () => ({ item: 'habits', target: 3, why: 'It fits.', by: 'assistant' })],
      ['a reason with a number', async () => ({ item: 'goal', target: 1, why: 'Finish 3 pages of the draft.', by: 'assistant' })],
      ['a reason about pace', async () => ({ item: 'goal', target: 1, why: 'Keep the pace up on the draft.', by: 'assistant' })],
      ['a reason over 90 characters', async () => ({ item: 'goal', target: 1, why: 'x'.repeat(91), by: 'assistant' })],
      ['garbage', async () => 'ok'],
    ];
    for (const [name, send] of fails) {
      before = start();
      expect(await askPick(slot.key, menu, { offline: online, send }), name).toBe(false);
      expect(getOrbs()!.challenges[slot.key], name).toEqual(before);
    }
    // offline: no request at all
    before = start();
    let asked = 0;
    expect(await askPick(slot.key, menu, { offline: () => true, send: async () => (asked++, {}) })).toBe(false);
    expect(asked).toBe(0);
    // an added challenge is not changed by an answer that arrives late
    start();
    setOrbs(addChallenge(getOrbs()!, slot, facts(MON), at(MON, 8)));
    const added = getOrbs()!.challenges[slot.key];
    expect(await askPick(slot.key, menu, { offline: online, send: async () => ({ item: 'goal', target: 1, why: 'It fits.', by: 'assistant' }) })).toBe(false);
    expect(getOrbs()!.challenges[slot.key]).toEqual(added);
    resetOrbsForTest();
  });
});

describe('the hard lines hold in every word the row and the sheet can say', () => {
  // distance, pace, weight, food, sleep, pain, a clock deadline, a count of to-dos or of journal lines
  const NEVER = /\b(miles?|km|kilometers?|distance|pace|faster|speed|weigh\w*|heavier|pounds?|lbs?|kg|calories?|food|eat\w*|ate|diet\w*|meals?|sleep\w*|slept|pain\w*|sore|hurts?|aches?|injur\w*|noon|midnight|deadline|o[’']clock|a\.m|p\.m|by \d|before \d|journal|lines?)\b|\d{1,2}:\d{2}|\d+ to-dos?/i;
  const TRAINING = /session|training|run\b|runs\b|lift|workout|plan’s|planned/i;
  const base = (weeks: Baseline['weeks']): Baseline => ({ recordDays: 60, weeks });
  const everyWord = (c: Challenge, slot: Slot, f: ChallengeFacts, today: string): string[] => {
    const out = [challengeTitle(c), sheetLine(slot.kind, c, f), whatCounts(c, f), worthWords(slot.kind, c), payLine(slot.kind, c)];
    for (let p = 0; p <= c.target; p++) out.push(progressWords(slot.kind, c, p));
    for (const state of ['offered', 'added', 'done'] as const) {
      const v = rowView({ ...c, state }, slot, f, today, 5);
      if (v) out.push(v.title, v.sub, v.label);
    }
    return out;
  };
  it('whatever the menu holds: no banned word, no clock, no count of to-dos, and nothing about training with Fitness off', () => {
    let seed = 11;
    const rnd = (n: number) => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n;
    let items = new Set<string>();
    for (let run = 0; run < 400; run++) {
      const fitness = rnd(3) !== 0;
      const today = day(rnd(3));
      const planned: ChallengeFacts['planned'] = fitness ? (['run', 'lift', 'cross'] as const).filter(() => rnd(2) === 0) : [];
      const f = facts(today, {
        fitness,
        planned,
        todosOpen: rnd(6),
        day: { habitsLive: rnd(6), goalDay: (['none', 'open', 'done'] as const)[rnd(3)], trainRequired: planned.length > 0, trainLeft: planned.length, held: rnd(12) === 0 },
        week: { goal: (['none', 'open', 'done'] as const)[rnd(3)], sessions: { planned: fitness ? rnd(7) : 0, done: 0 }, paused: rnd(15) === 0 ? 1 : 0 },
      });
      const weeks = [0, 1, 2, 3].map(() => ({ days: rnd(8), habitDays: rnd(8), fullDays: rnd(8) }));
      for (const slot of [daySlot(today), weekSlot()]) {
        const menu = menuFor(slot, base(weeks), f, (['gentle', 'steady', 'bold'] as const)[rnd(3)]);
        // nothing on a paused day
        if (f.day.held) expect(menu).toEqual([]);
        for (const o of menu) {
          items.add(o.item.replace(/:.*/, ''));
          const c = ch({ ...o });
          for (const words of everyWord(c, slot, f, today)) {
            expect(words, `${o.item}: ${words}`).not.toMatch(NEVER);
            if (!fitness) expect(words, `${o.item} with Fitness off: ${words}`).not.toMatch(TRAINING);
          }
          // never more sessions than the plan holds
          if (o.item === 'sessions') expect(o.target).toBeLessThan(f.week.sessions.planned);
          if (!fitness) expect(o.item).not.toMatch(/^session/);
        }
      }
    }
    // every item of the menu was seen
    expect([...items].sort()).toEqual(['days', 'full', 'full-days', 'goal', 'goal-week', 'habit-days', 'habits', 'list', 'session', 'sessions']);
  });

  it('an answer cannot bring an item, a target or a reason the rules here would not make', () => {
    const slot = weekSlot();
    const f = facts(MON, { week: { sessions: { planned: 4, done: 0 }, goal: 'open' } });
    const menu = menuFor(slot, { recordDays: 60, weeks: [4, 4, 5, 3].map((days) => ({ days, habitDays: 2, fullDays: 1 })) }, f, 'steady');
    const s0 = offerInto(emptyRewards(U, shiftDays(MON, -60)), slot, menu[0]!, at(MON, 7));
    const tries = [
      { item: 'sessions', target: 9, floor: 8, why: 'Add two more sessions this week.', by: 'assistant' as const },
      { item: 'days', target: 7, floor: 6, why: 'Go for all seven.', by: 'assistant' as const },
      { item: 'run-farther', target: 1, why: 'Run a little farther.', by: 'assistant' as const },
      { item: 'sessions', target: 3, floor: 2, why: 'Add distance to the long run.', by: 'assistant' as const },
    ];
    for (const a of tries) {
      const offer = acceptPick(parsePick(a), menu);
      const next = offer ? withPick(s0, slot.key, [offer], offer.item, a.why) : s0;
      const c = next.challenges[slot.key]!;
      // whatever came back, what the phone holds is an offer from its own menu, at its own target or lower
      const mine = menu.find((o) => o.item === c.item)!;
      expect(mine).toBeDefined();
      expect(c.target).toBeLessThanOrEqual(mine.target);
      if (c.item === 'sessions') expect(c.target).toBe(3);
      if (c.why) expect(reasonAllowed(c.why, challengeTitle(c))).toBe(true);
    }
    // the one that asked for 9 sessions became this phone's own "every planned session but one"
    const o = acceptPick(parsePick(tries[0]), menu)!;
    expect(o).toEqual({ item: 'sessions', target: 3, floor: 2, base: 0 });
    // and a reason that asks for more is refused by the engine's own check, so nothing changes
    expect(withPick(s0, slot.key, [o], 'sessions', tries[3]!.why)).toBe(s0);
    expect(isPickable('habits')).toBe(false);
  });
});

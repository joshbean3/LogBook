# Platform: shared logic and endpoints for the redesign

Owner: platform. Spec: `docs/experience.md` §4. Everything below is in `packages/shared` (pure functions, imported as `@logbook/shared` by the web and the API) or `apps/api` (Hono routes under `/api`). Page teams call these; nothing here renders.

| Need | Call | Section |
|---|---|---|
| The one status word for a session (hero, row, sheet) | `sessionWord(snap, date, session \| null)` | [1](#1-one-status-vocabulary) |
| The word / ring colour for a whole day | `dayWord(snap, date)`, `weekSummary(...).days[i].ring` | [1](#1-one-status-vocabulary), [3](#3-weeks-the-ring-and-the-streak) |
| Which session the hero leads with | `heroSession(sessions)` (or `dayPhase(...).primary`) | [1](#1-one-status-vocabulary) |
| Today's time-aware hero state | `dayPhase(now, ctx)` | [2](#2-dayphase) |
| Week ring, week sheet, streak | `weekSummary`, `weekStreak`, `weekCheck` | [3](#3-weeks-the-ring-and-the-streak) |
| Plan template preview (client) / write (server) | `buildTemplate(input)` / `POST /api/plans/template` | [4](#4-plan-templates) |
| Sign-up, first run | `POST /api/auth/signup`, `POST /api/me/onboarding`, `GET /api/me` | [5](#5-sign-up-and-onboarding) |
| Delete account | `DELETE /api/me` | [6](#6-delete-account) |
| Replace a plan with Undo | `POST /api/plans/template` (`replace`) → `POST /api/plans/template/undo` | [7](#7-plan-template-replace-and-undo-contract-1) |
| Delete a plan that survives a reload | `DELETE /api/blocks/:id` → `POST /api/blocks/:id/restore` | [8](#8-plan-delete-and-restore-contract-2) |
| Export / import the whole account | `GET /api/export`, `POST /api/import` | [9](#9-export-and-import-contract-3) |
| Writes that land once | `Idempotency-Key` header | [10](#10-idempotent-writes-contract-4) |
| Miles without Strava | `sessionMiles`, `dayMiles`, `ranMiles` | [11](#11-miles-without-strava-contract-5) |
| The account's name | `PATCH /api/me { name }` | [12](#12-the-account-name-contract-6) |
| A new account's morning, the first week | `NEW_ACCOUNT_MORNING`, `buildTemplate` | [13](#13-generic-defaults-for-new-accounts-contract-7) |
| "Today" on the server | `X-Local-Date` | [14](#14-the-athletes-date-on-the-server) |

All times of day are **minutes after local midnight** (`7:35 AM` = `455`); format them with `clockOfDay(m)`. Dates are `YYYY-MM-DD` strings in the athlete's zone (`ISODate`).

---

## 1. One status vocabulary

### The bug (audit §2.1)

On `/today/2026-10-11` the hero said **FLOOR · "Floor held."** for Easy 6 while the Training row for the same Easy 6 said **MISSED**.

Root cause: the two surfaces asked different questions.

- `DayView.tsx` `Hero` computed `st = dayStatus(snap, date)`, the roll-up of **every** session on the day, and printed it in the chip and verdict under the title of **one** session (`main`, the run).
- `SessionCard.tsx` `SessionRow` computed `sessionStatus(snap, date, s)` for that session.

On Oct 11 the run had nothing recorded (Missed) and the Strength session had two logged sets (Done). `dayStatus` rolls "some missed, some kept" up to `floor`, so the hero said Floor under the run's name. The same split produced the other two contradictions:

- **Bonus vs Done**: an unplanned run was `dayStatus = 'bonus'` in the hero, but the unplanned sheet (`shareDataFor`/`UnplannedSheet`) passed a hard-coded `'done'` when there is no session.
- **Open vs Rest**: an empty day is `dayStatus = 'empty'`, whose `STATUS_WORD` is `''`, so the hero fell back to the literal "Open"; Morning calls the same day "Rest".

`words.test.ts` reproduces all three with the exact calls the web makes, then shows the fix.

### The fix: a session's word comes from the session

```ts
sessionWord(snap: Snapshot, date: ISODate, session: Session | null | undefined): StatusWord
sessionKey(snap, date, session): StatusKey        // same, as a stable key for CSS / chip colour
heroSession(sessions: Session[]): Session | null   // which session the hero leads with
dayWord(snap, date): StatusWord; dayKey(snap, date): StatusKey   // the day as a whole
statusKey(st: SessionStatus | DayStatus): StatusKey
STATUS_WORDS: Record<StatusKey, StatusWord>
isSkipMark(mark): boolean                          // 'skip' or 'sick'
```

**Rule.** Any word printed next to a session's name (Today hero, Training/Plan row, session sheet, share card) is `sessionWord(snap, date, thatSession)`. With no session (an unplanned run's sheet, an empty day's hero) pass `null`: it reads **Bonus** if anything was recorded that day, else **Rest**. `dayWord` is only for things that stand for a whole day (a week-ring segment, a calendar cell, a Plan row that has no single session). Never print `dayWord` under one session's title.

| Key | Word | When |
|---|---|---|
| `planned` | Planned | A session on a future day |
| `today` | Today | Today's session, not yet done (raw status `open`) |
| `done` | Done | Marked done, or the evidence covers it (run ≥ 80% of planned miles, lift sets logged, a cross/lift activity) |
| `floor` | Floor | Marked floor, or a run under 80% of planned miles |
| `missed` | Missed | A past session with nothing recorded and no mark |
| `skipped` | Skipped | Marked `skip`, or `sick` (skipped for illness) |
| `rest` | Rest | A rest session; a day with nothing planned |
| `bonus` | Bonus | A day with training recorded and nothing planned for it |

The day roll-up (`dayStatus`, unchanged) → `dayKey`: `open` → today, `upcoming` → planned, `empty` → rest; a day with a missed session and a kept one is `floor`.

```ts
// Oct 11: Easy 6 missed, Strength done
sessionWord(snap, '2026-10-11', heroSession(snap.sessionsOn('2026-10-11')))  // 'Missed' (hero)
sessionWord(snap, '2026-10-11', easy6)                                       // 'Missed' (row)
dayWord(snap, '2026-10-11')                                                  // 'Floor'  (week ring segment)
sessionWord(snap, '2026-10-12', null)  // 'Bonus' with an unplanned run; 'Rest' with nothing
```

`heroSession` picks the first run that is not skipped, else the first other training session that is not skipped, else the first run, else the first session, else `null`.

### Related changes

- New mark **`sick`** on `SessionMark` and `zMark` (`POST /api/sessions/:id/mark { mark: 'sick' }`): the "Not feeling 100%" skip. Reads **Skipped** everywhere, but counts as kept for the week (§3). The column is plain text; no migration.
- `morningPlanFor` / `morningDayFor` now ignore skipped sessions: a skipped run no longer puts a run on the morning (the plan label reads "Easy 5 skipped").
- Legacy `STATUS_WORD.open` now reads **Today** (was "To do"), so old callers already use the one vocabulary. `STATUS_WORD` stays for compatibility; new code uses `sessionWord` / `dayWord`.

---

## 2. dayPhase

`packages/shared/src/phase.ts`

```ts
dayPhase(now: Date | { date: ISODate; minutes: number }, ctx: {
  date: ISODate;                         // the day shown
  snapshot: Snapshot;                    // the log cache; snapshot.today should be now's date
  settings?: MorningSettings | null;     // bootstrap.morningSettings; null = not loaded
  override?: Partial<MorningDayOverride> | null;  // snap.morningOverride(date)
}): DayPhase
```

Pure: it never reads the clock. Pass `new Date()` (read in the runtime's local zone) or an explicit `{ date, minutes }`. Re-call it each minute for the countdown.

Returns:

| Field | Meaning |
|---|---|
| `phase` | `morning` · `out` · `day` · `evening` · `rest` · `past` · `future` |
| `now` | now, in minutes after midnight |
| `mode` | the morning timeline's mode (`run` / `gym` / `rest`), null without settings |
| `wakeAt`, `leaveAt` | alarm and leave-for-work times (whenever settings are known) |
| `doorAt`, `backBy` | out the door / home again (run or gym mornings only) |
| `doorIn` | whole minutes to the door (`morning` only; ceil, so it reads 1 up to the door) |
| `outProgress` | 0..1 from door to back (`out` only) |
| `primary` | `{ session, status, key, word }` for `heroSession`, or null |
| `sessions` | every session that day, plan order, each with its own status/key/word |
| `training` | the not-rest, not-skipped ones, `primary` first: what the hero pages between |
| `key`, `word` | the hero's word: `primary.word`, or Bonus/Rest with nothing planned |

Times come from the same `buildMorning(morningDayFor(sessions, override, settings), settings)` the Morning page draws: `doorAt` is the start of the first buffer block ("Out the door" / "Walk to the gym"), `backBy` is `T.back` (after the cool-down / walk home), `leaveAt` is `T.leave`.

### Rules, in order

1. `date` is not `now`'s date: **past** or **future** (times and words still filled in).
2. No training today (nothing planned, only rest, or everything skipped): **rest** before 18:00, **evening** from 18:00.
3. The primary session is already Done or Floor: **day** before 18:00, **evening** after. A run finished before the door time skips `morning`/`out`.
4. A run or gym morning with a timeline: **morning** while `now < doorAt`; **out** while `doorAt <= now < backBy`.
5. Otherwise **day** until 18:00 (`EVENING_START = 1080`), then **evening**.

Boundaries (all tested in `phase.test.ts`, default settings, Easy 5): 7:34 morning `doorIn 1`; **7:35 exactly is out**; 8:29 out; **8:30 (back) is day**; 17:59 day; **18:00 is evening**. Rule 4 comes before the clock, so an evening run set on the Morning page still counts down. Without settings there is no countdown: a training day is `day` until 18:00. A Morning "make this a rest day" override keeps the session (Today) but has no door, so it is `day`.

```ts
dayPhase({ date: '2026-10-14', minutes: 390 }, { date: '2026-10-14', snapshot, settings })
// { phase: 'morning', doorIn: 65, wakeAt: 440, doorAt: 455, backBy: 510, leaveAt: 570, mode: 'run',
//   primary: { session: <Easy 5>, status: 'open', key: 'today', word: 'Today' }, training: [...], word: 'Today' }
```

Hero mapping (spec §5.1): `morning` → "Out the door in {doorIn} min" + mini timeline (`wakeAt`, `doorAt`, `backBy`, `leaveAt`); `out` → "Back by {clockOfDay(backBy)}" + `outProgress`; `day` + done → the route and stamps; `day` + not done → hold-to-complete; `rest` → "Rest. It counts."; `evening` → Close the day. Page between `training` when it has two.

---

## 3. Weeks: the ring and the streak

`packages/shared/src/week.ts`. Weeks run Monday to Sunday; any date in the week is accepted and normalized with `mondayOf`.

### The floor rule: `weekCheck(snap, weekStart) → { kept, keptSessions, target, plannedMiles, ranMiles }`

A week is **kept** when either:

- **kept sessions ≥ target.** Kept = training sessions (not rest) that are Done, Floor, or marked `sick`, plus one for each day with training recorded and nothing planned (Bonus). Target = `min(3, training sessions planned)`; 3 when nothing at all was planned; 0 for a week planned as all rest. Rest counts by lowering the bar, not by filling it, so a 4-run week with 3 rest days still needs 3 kept runs.
- **miles:** planned run miles > 0 and miles run ≥ 80% of them. Runs marked `sick` are excused from the planned miles; a plain `skip` is not.

### `weekStreak(snap, today = snap.today) → { weeks, ofLast: { kept, total } }`

- `weeks`: consecutive kept weeks counting back from the current week if it is **already** kept, else from last week. An unfinished week never breaks the streak.
- `ofLast`: kept weeks among the 8 ending at that same week, for "7 of the last 8 weeks". `total` is trimmed to start at the first week with anything in it (a session, an activity or lift sets), so a two-week-old account reads "2 of the last 2 weeks", never "2 of 8".

```ts
weekStreak(snap, '2026-10-14')  // { weeks: 3, ofLast: { kept: 7, total: 8 } }
```

`weekCheck` also returns `loggedMiles`: the part of `ranMiles` that came from runs marked Done/Floor with no activity
(§11). `ranMiles` (and `weekSummary.doneMiles`, `weekTotals.ran`) include it.

### `weekSummary(snap, weekStart) → WeekSummary`

Everything the 7-segment `WeekRing` and the week sheet need, plus all of `weekCheck`:

```ts
{
  weekStart: '2026-10-12',
  days: [{ date, status /* dayStatus */, key, word /* dayWord */, ring }, ... 7],
  plannedMiles: 24, doneMiles: 7.2,      // planned skips out of plannedMiles, like weekTotals
  runsPlanned: 4, runsDone: 2,           // runsDone: planned runs Done/Floor + days with an unplanned run
  kept: true, keptSessions: 3, target: 3, ranMiles: 7.2,
}
```

| `ring` | Day status | How `WeekRing` draws it (fix round, critic B2) |
|---|---|---|
| `done` | done, bonus | solid `--accent` arc |
| `floor` | floor | solid `--warn` arc |
| `missed` | missed | 1.5px `--bad` outline at 60% |
| `rest` | rest, empty, skipped | no arc (the track); a `skipped` day passed as `skipped` is a grey arc |
| `future` | open (today), upcoming | faint solid arc (`--ink-4`) |

`trainingStreak` (days) is unchanged and still exported; the redesign shows weeks.

---

## 4. Plan templates

`packages/shared/src/templates.ts`. Pure, so the Plan sheet can preview a block as ghosted rows with no request, then write it with the endpoint.

```ts
buildTemplate({
  goal: 'base' | '5k' | '10k' | 'half' | 'marathon',
  weeks?: number,              // full Mon–Sun weeks, 1..30; default by goal (8/8/10/12/16); ignored with raceDate
  startDate: ISODate,
  runDays: Weekday[],          // 'mon' | 'tue' | ... | 'sun'
  longRunDay: Weekday,         // added to runDays if missing
  weeklyMiles: number,         // current volume: week 1
  raceDate?: ISODate | null,   // ends the block on race day, with a taper
}): Template
// throws TemplateError when the race is before the first Monday or more than 30 weeks out

Template = { name, summary, start, end, goal, raceDate, weeks: TemplateWeek[], sessions: TemplateSession[] }
TemplateWeek = { week /* 0 = lead-in */, start, kind: 'lead-in'|'build'|'down'|'taper'|'race', target, miles, runs }
TemplateSession = SessionInput & { kind: 'run', type, title: null, miles, minutes: null, week, floorMin: number | null }
```

Validate untrusted input with `zTemplateInput` (`zWeekday`, `zGoal` are exported too). Helpers: `weekdayOf(date)`, `weekdayIndex(w)`, `WEEKDAYS`, `floorMinutes(session)`, `GOAL_SPECS`, `TEMPLATE_RULES` (the numbers below).

### Structure

| Rule | Value |
|---|---|
| Week 1 | `weeklyMiles` |
| Build | +10% a week under 20 mi, +8% from 20 mi, rounded to 0.5 mi; ceiling = min(goal peak, max(1.6 × start, start + 12)); goal peaks: base 45, 5K 40, 10K 45, half 50, marathon 60 |
| Down week | every 4th full week at 75% of the last build week; the build resumes from the pre-down level |
| Long run | on `longRunDay`; share of the week with 4+ run days: 5K 25%, base/10K 28%, half/marathon 30% (+8 points with 3 days, 55% with 2, all of it with 1); at least 4 mi; capped at 5K 9, 10K 12, half 14, marathon 20, base 12; always the longest run of its week |
| Quality | race goals: one a week (from 12 mi/week and 2 run days), ~20% of the week, 4 mi to the goal's cap (5K 6, 10K 7, half 8, marathon 10), on the run day farthest from the long run (Wed, Tue, Thu first on ties). Rotation: 5K intervals → hills → speed → tempo; 10K intervals → tempo → threshold → hills; half tempo → threshold → intervals → threshold; marathon marathon pace → threshold → marathon pace → tempo. Down weeks: a Fartlek instead. Base: strides on that day from week 3 |
| Easy | the other run days share the rest, at least 3 mi each; days the volume can't fill are dropped, nearest the long/quality day first; rounding lands on the last easy run so the week adds up to its target |
| Taper (with `raceDate`) | 5K/10K 1 week (55%), half 2 (75%, 45%), marathon 3 (80%, 60%, 35%) of the last build week; race week has no long run, strides on the quality day, a 3 mi shakeout the day before, then the `Race` session on `raceDate` (3.1 / 6.2 / 13.1 / 26.2 mi) |
| Mid-week start | a lead-in (`week: 0`) from `startDate` to Sunday at week-1 volume for those days: easy runs, plus the long run on its day when the lead-in reaches it (and has 2+ run days); full weeks start the next Monday |
| Easy variety | the easy runs of a week share their total in half miles so they differ by 0.5–1 mi (never all the same): the longer ones farthest from the long run and the quality day, the day before the long run the shortest; never under 3 mi, never as long as the long run |
| Long run | strictly the longest run of its week: lifted 0.5 mi past the next longest when the shares would tie (paid for by the easy runs, then the quality day) |
| Floors | not stored: the app derives a floor from the session type (`floorFor`). Every run's type has one, and `floorMin` carries its minutes: 20 for easy and quality, 30 for long, null for the race ("Show up and run it easy"). Every run is longer than its floor even at 12:00/mi |
| Names | the app's own style: `type` + miles, no title, so `label()` reads "Easy 5", "Tempo 6", "Long 12", "Race 13.1"; quality details use the plan sheet's shorthand ("1.5 mi wu, 6 × 800 m at 5K effort, 400 m jog, 1.5 mi cd") |

```ts
buildTemplate({ goal: 'half', startDate: '2026-10-19', runDays: ['tue','thu','sat','sun'], longRunDay: 'sun', weeklyMiles: 20, raceDate: '2027-01-17' })
// name 'Half marathon · Jan 17', start '2026-10-19', end '2027-01-17', 13 weeks
// summary '20 to 32 mi a week, a down week every 4th, long run up to 9.5 mi, one quality session a week, 2-week taper to race day.'
// week 1: Tue Easy 5.5 · Thu Tempo 4 (1 mi wu, 2 mi at tempo, 1 mi cd) · Sat Easy 4.5 · Sun Long 6
// week 4 (down): Easy 4.5 · Fartlek 4 (Easy with 6 × 1 min pickups) · Easy 3.5 · Long 5.5
// week 13 (race): Easy 5 · Easy 5 (Easy with 4 × 20 s strides) · Easy 3 (Shakeout with 4 × 20 s strides) · Race 13.1
```

### `POST /api/plans/template`

Body: `zTemplateRequest` = the template input plus `replace?: boolean`. Builds the template and writes, in one transaction, a `plan_blocks` row (`source: 'template'`, `summary` from the template) and one `training_sessions` row per session (`blockId` set, positioned after whatever already sits on that day). With `replace: true` it first **soft-deletes** the sessions in `[max(start, today), end]` whose status is not Done or Floor, and ends or deletes any overlapping block: see [§7](#7-plan-template-replace-and-undo-contract-1) for the full answer and Undo. Past days and kept sessions are never touched. Without `replace` nothing is removed. "today" is the athlete's (`X-Local-Date`, §14).

```http
POST /api/plans/template
{ "goal": "5k", "weeks": 6, "startDate": "2027-01-04", "runDays": ["mon","wed","fri","sat"], "longRunDay": "sat", "weeklyMiles": 20, "replace": true }

201 { "block": { "id": "bLfKjhFHsOZ1j", "name": "5K · 6 weeks", "start": "2027-01-04", "end": "2027-02-14", "source": "template",
                 "summary": "20 to 27 mi a week, a down week every 4th, long run up to 8.5 mi, one quality session a week.",
                 "createdAt": "…", "sessionCount": 24 },
      "months": ["2027-01", "2027-02"], "removed": 0 }
```

Same shape as `POST /api/plans/apply` (`{ block, months }`) plus `removed`, `replacedIds`, `endedBlock?`, `endedBlocks` (§7); invalidate those months and bootstrap. Errors: 422 `validation` (bad body), 422 `bad_template` (race too far or too close), 401.

---

## 5. Sign-up and onboarding

### `ALLOW_SIGNUP` (env, zod, default off)

`1`/`true`/`yes`/`on` lets anyone create an account. Without it only the first account can be created, and only while `ALLOW_SETUP` is on (unchanged: on outside production by default). Set `ALLOW_SIGNUP=1` for local dev.

### `GET /api/auth/status`

`{ hasAccount, setupOpen, signupOpen }`. `setupOpen`/`signupOpen` are true when this visitor can create an account now (first account with setup or signup on; more accounts with signup on).

### `POST /api/auth/signup` (alias of `POST /api/auth/setup`)

Body `{ email, password }` (`zCredentials`: email lower-cased and trimmed, password ≥ 8). Creates the account, signs it in (session cookie) and answers `201 { id, email, onboardedAt: null }`. 403 `setup_closed` when sign-up is off; 409 `email_taken`. `POST /api/auth/login` now also returns `onboardedAt`.

### `onboarded_at` (migration `0006_onboarding.sql`, journal idx 6)

`users.onboarded_at text` (null = show `/welcome`). The migration sets it to the migration time for every existing account, so the owner never sees onboarding. New accounts start null.

### `GET /api/me`

`200 { id, email, name, onboardedAt, trainingProfile }` (`name` §12). The same `onboardedAt` is on `GET /api/auth/me` and on `GET /api/bootstrap` as `user.onboardedAt`; `trainingProfile` is on the bootstrap as `user.trainingProfile`.

### The training profile (`users.training_profile`, migration `0007_training_profile.sql`, journal idx 7)

The answers themselves, so Settings shows what was said rather than reading it back out of the plan: `SavedTrainingProfile = { goal, raceDate, runDays, longRunDay, weeklyMiles, updatedAt }` (`zTrainingProfile` in shared), stored as JSON; null for accounts that never answered (Settings then derives the answers from the current block). `POST /me/onboarding` writes it. A block created after `updatedAt` (a new block from Plan) speaks for itself in Settings.

`PATCH /api/me/training` takes any of the five answers (`zTrainingPatch`; at least one) and keeps the rest; the first save needs all five (422 otherwise). `goal: 'base'` clears `raceDate`; a `longRunDay` off the run days joins them. It rewrites no plan: Settings rebuilds with `POST /plans/template`, then saves the answers here. `200 { trainingProfile }`.

### `POST /api/me/onboarding`

```ts
zOnboarding = {
  goal: Goal, raceDate?: ISODate | null,
  runDays: Weekday[], longRunDay: Weekday, weeklyMiles: number,
  wake: number | 'H:MM',       // the alarm, minutes or "6:30"
  leave: number | 'H:MM',      // leave for work; must be after wake
  pace?: number | 'm:ss' | null,  // easy pace per mile, 4:00..20:00
  habits: string[],            // up to 12
  start?: 'monday' | 'tomorrow',  // default 'monday': the coming Monday (a week out on a Monday)
  today?: ISODate,             // the client's local date; defaults to the server's
}
```

In one transaction:

0. **Training profile**: the answers (goal, raceDate, runDays, longRunDay, weeklyMiles) are stored on the account (see below).
1. **Morning settings**: `wake` → `settings.wake`; `pace` → `settings.run.pace`; `leave` → the routine starts (fixed) at `leave − (shower + ready + smoothie + prep)` (not before `wake`), so the timeline's Leave lands on `leave`. A new account builds on `NEW_ACCOUNT_MORNING` (§13: get ready 30 + out the door 10 = 40 min, so leave 8:30 → starts 7:50).
2. **Habits**: created in order after existing ones; matched by name, case-insensitive; an archived habit of the same name is un-archived instead of duplicated.
3. **Plan**: `buildTemplate` from the answers (`weeks` by goal, or up to `raceDate`), starting next Monday or tomorrow, written with `source: 'onboarding'` and `replace: true`. A block written by an earlier onboarding call is retired first (its future unkept sessions removed), so a repeat never doubles the plan.
4. **`onboarded_at`**: set on the first call and kept after.

```http
POST /api/me/onboarding
{ "goal": "10k", "runDays": ["tue","thu","sat","sun"], "longRunDay": "sun", "weeklyMiles": 15,
  "wake": "6:15", "leave": "8:45", "pace": "9:15", "habits": ["Sleep 7 h", "Stretch", "Read 15 min"] }

200 { "user": { "id": "…", "email": "fresh.runner@example.com", "onboardedAt": "2026-10-14T03:07:25.346Z" },
      "morningSettings": { "wake": 375, "run": { "pace": 555, … }, "after": { "showerMode": "fixed", "showerAt": 475, … }, … },
      "habits": [ { "name": "Sleep 7 h", … }, { "name": "Stretch", … }, { "name": "Read 15 min", … } ],
      "block": { "name": "10K · 10 weeks", "start": "2026-10-19", "end": "2026-12-27", "source": "onboarding", "sessionCount": 40, … },
      "months": ["2026-10", "2026-11", "2026-12"],
      "firstDay": "2026-10-20" }
```

`firstDay` is the first planned run, for the payoff screen ("Tomorrow: Easy 4."). Invalidate bootstrap and `months`. 422 for bad answers (nothing is written).

---

## 5b. The morning routine's order (`after.order`)

`MorningSettings.after.order: MorningAfterKey[]`, the four back-home blocks (`'shower' | 'ready' | 'smoothie' | 'prep'`) in the athlete's order; default `AFTER_ORDER` (shower, get ready, smoothie, final prep). `buildMorning` lays them out in that order from the routine's start (`showerAt` when fixed, else straight after the workout), so the leave time never moves; a smoothie of 0 is skipped wherever it sits. `normalizeMorningSettings` / `normalizeAfterOrder` make any stored order whole (known keys once each, missing ones appended). `PATCH /api/morning/settings { after: { order } }` takes all four keys once each (`zMorningSettingsPatch`); the stored settings are a JSON setting, and the array replaces the old one.

## 6. Delete account

### `DELETE /api/me`

Body `{ password }`. Checks the password (same per-address throttle as sign-in), then deletes in one transaction every row the user owns in every table with a `user_id` (`USER_TABLES` in `apps/api/src/services/account.ts`: auth sessions on every device, settings, habits and checks, plan blocks and sessions, lifts, to-dos, morning days, journal, own quotes and quote prefs, picks and rotation, Strava tokens, activities, HR zones, coach reads, links) and the `users` row, and clears the cookie.

```http
DELETE /api/me   { "password": "password123" }
200 { "ok": true, "removed": { "auth_sessions": 1, "user_settings": 1, "habits": 3, "plan_blocks": 2, "training_sessions": 64, …, "users": 1 } }
Set-Cookie: logbook_session=; Max-Age=0; Path=/
```

Wrong password: **403** `bad_password` (deliberately not 401, which the client treats as signed out). 422 without a password. The `DELETE /me` tests in `apps/api/src/routes/platform.test.ts` fail if a table with a `user_id` is added without being listed. The Strava authorization is not revoked on Strava's side (the tokens are deleted).

---

## 7. Plan template replace and Undo (contract 1)

`POST /api/plans/template` with `replace: true`:

1. **soft-deletes** (`deleted_at`) the planned, not-done sessions in `[max(startDate, today), end]` (any source, a hand-added
   lift too). Done, Floor and kept-by-evidence sessions and every past day stay.
2. every live block that overlaps `[startDate, end]` is **ended at `startDate − 1`** (`{ id, prevEnd }`, `prevEnd` = its old
   end), or **soft-deleted** when it had not started by then (`{ id, deleted: true }`). Its planned, not-done sessions from
   `startDate` on go too, even past the new block's end, so nothing of it floats past its end.

```http
201 { "block": { "id": "bNew", … }, "months": ["2026-11", "2026-12"],
      "removed": 31,                          // = replacedIds.length
      "replacedIds": ["p…", …],               // every session it soft-deleted
      "endedBlock": { "id": "bOld", "prevEnd": "2027-01-10" },   // or { "id": "bOld", "deleted": true }; absent when none
      "endedBlocks": [ { "id": "bOld", "prevEnd": "2027-01-10" } ] }
```

`POST /api/plans/template/undo` with `{ blockId, replacedIds, endedBlock? }` (or `endedBlocks`), i.e. the answer sent back:
the new block and its sessions are deleted, the replaced sessions come back (`deleted_at` cleared), each ended block gets
`prevEnd` back (or is undeleted). Only the caller's rows are touched. `200 { ok: true, removed, restored, blocks: string[],
months: string[] }`: refetch `months` (plus the ones from the template answer) and the bootstrap. 422 on a bad body.
Types: `zTemplateUndo`, `zEndedBlock`, `TemplateAppliedV2`, `EndedBlockRef` in shared. Test: `routes/fixround.test.ts`
("Undo restores exactly": the live sessions and blocks after Undo equal the ones before the replace, row for row).

## 8. Plan delete and restore (contract 2)

`DELETE /api/blocks/:id` soft-deletes the block (`plan_blocks.deleted_at`, migration 0008) and only its sessions from today
on that hold nothing (no mark, not kept by evidence). History stays visible: done, floor, sick and skipped sessions and
every past day keep their rows **and their `blockId`** (the block is just not in the bootstrap any more). Every row it
touches gets the same timestamp. `200 { ok: true, removed, kept, months, deletedAt }`; 404 for an unknown or already deleted
block. `POST /api/blocks/:id/restore` brings back the block and exactly those sessions (a session deleted on its own
earlier stays deleted): `200 { block, restored, months }`. Both survive a reload (no client timer needed). The bootstrap's
`blocks` and `sessionCount` leave deleted rows out.

## 9. Export and import (contract 3)

`GET /api/export` (with `Content-Disposition: attachment; filename="logbook-export-<date>.json"`) answers the whole
account, type `ExportV2`:

```ts
{ version: 2, exportedAt, user: { id, email, name, createdAt, onboardedAt },
  settings: { morning: {…}, … },        // every user_settings document by key
  trainingProfile,                        // or null
  habits, checks, blocks, sessions,       // live rows (soft-deleted ones are not exported)
  activities,                             // ExportActivity: lossless rows (distanceM, elapsedSec, laps, polyline)
  lifts, todos /* with deletedOn */, journal,
  quotes: { own: [{ id, text, author, createdAt }], prefs: [{ quoteId, fav, hidden }] },
  links, morningDays: { [date]: override }, coach: [{ date, key, text, createdAt }] }
```

`POST /api/import` takes that file back (`version: 2`, validated by `zExportV2` in `services/exporter.ts`; 422 `bad_bundle`
when it isn't one) into this account or a fresh one, in one transaction, **idempotent by id**: a row whose id the account
already has is skipped. An id that belongs to another account (a fresh account on the same server) is renamed
deterministically (`<id>-<8 hex of the account>`), and every reference follows (a session's block, a check's habit, a
favourite on your own quote, a coach read's session). Settings, the name and the training profile are filled only where the
account has none. Anything without `version: 2` is read as the original artifact bundle, as before.
`200 { ok: true, version: 2 | 1, imported: { habits: 3, sessions: 64, … } }` (an empty object on a re-import).

## 10. Idempotent writes (contract 4)

Any authed POST/PUT/PATCH/DELETE may carry `Idempotency-Key: <string ≤ 200>`. The first answer under 500 (status and body)
is stored per user and key (`idempotency_keys`, migration 0008, purged after 24 h). A later request with the same key, method
and path within 24 h gets that answer back with `Idempotent-Replay: true` and does nothing; a twin that arrives while the
first is still being answered waits for it. No key, no change. The web client (`api/outbox.ts`) sends one key per write
from its first try to its last replay: the queued item's `id`. It also persists an item as in flight (`sentAt`) before
sending it, so a reload mid-request replays it under the same key (QA D-F2: no duplicate to-dos).

## 11. Miles without Strava (contract 5)

`packages/shared/src/miles.ts`:

```ts
sessionMiles(snap, date, session, opts?: { pace?: number }) → { miles: number, source: 'activity' | 'planned' | 'floor' | 'none' }
dayMiles(snap, date, opts?) → { miles, tracked, logged }        // tracked = activities, logged = marked runs with none
ranMiles(snap, from, to = from, opts?) → number
```

- `activity`: the run activities matched to the session (in order: the first live run of the day takes the first
  activity by start time, the last run takes any extras).
- `planned`: no activity, marked **Done**: its planned miles (or planned minutes at the easy pace).
- `floor`: no activity, marked **Floor**: the floor's minutes (20 easy/quality, 30 long; 20 when the words have none) at the
  easy pace, capped at the planned miles.
- `none`: not a run, skipped/sick, unmarked with no activity, or no session.

The easy pace is `opts.pace`, else `snapshot.easyPace` (new optional `Snapshot` field, seconds per mile: pass
`bootstrap.morningSettings.run.pace`), else 9:00/mi (`DEFAULT_EASY_PACE`). `weekCheck`/`weekSummary` (`ranMiles`,
`doneMiles`, new `loggedMiles`) and `weekTotals.ran` count logged runs, so the miles rule and every week number agree.
Today (close the day MI), Share and Progress use `sessionMiles`/`dayMiles` instead of summing activities; draw `logged`
as "logged, not tracked" where that matters.

## 12. The account name (contract 6)

`users.name` (migration 0008, null until given). `PATCH /api/me { name }` (trimmed, ≤ 60; `""` or `null` clears it) answers
like `GET /api/me`: `{ id, email, name, onboardedAt, trainingProfile }`. `GET /api/me`, `GET /api/auth/me`, the bootstrap's
`user`, and the sign-in / sign-up answers carry `name`. Schema `zMePatch`.

## 13. Generic defaults for new accounts (contract 7)

- **Morning**: `NEW_ACCOUNT_MORNING` (shared) is what an account that never saved its morning gets from `GET
  /morning/settings`, the bootstrap, `PATCH /morning/settings` (it builds on it) and onboarding: the back-home routine is
  **Get ready 30 · Out the door 10** (shower 0, smoothie 0, `after.names.prep = 'Out the door'`), leave 9:30. No "Blend
  smoothie". `MorningSettings.after.names` (optional) holds the athlete's own block names; `afterLabel(settings, key)` reads
  a block's name (falls back to `AFTER_LABELS`); `buildMorning` uses it and skips any back-home block of 0 minutes.
  Accounts with a stored routine (the owner) are unchanged.
- **First week**: `buildTemplate` varies the easy days by 0.5–1 mi and puts the long run on the chosen long-run day,
  strictly the longest run, including in a lead-in week that reaches that day (§4 table).

## 14. The athlete's date on the server

The web client sends `X-Local-Date: YYYY-MM-DD` (its local date) on every request (`api/client.ts`). `requireAuth` puts
`c.get('today')` on the context: that date when it is within 2 days of the server's, else the server's (`clientToday` in
`apps/api/src/lib/requests.ts`). Every server default that means "today" uses it: a habit's `createdOn` and `archivedOn`,
a to-do moved to Later without a date (tomorrow = the athlete's tomorrow), the to-do list window, the plan template's
replace window (the athlete's yesterday is never replaced), onboarding without `today`, the journal's daily pick and the
Reads pick. Dated writes (sessions, checks, journal, lifts, to-dos, morning days) already carry the client's date and are
never rejected for being a day ahead. Tests: "the athlete's date" in `routes/fixround.test.ts`.

---

## Files

- `packages/shared/src/status.ts`: `sessionWord`, `sessionKey`, `dayWord`, `dayKey`, `statusKey`, `heroSession`, `STATUS_WORDS`, `isSkipMark`
- `packages/shared/src/phase.ts`: `dayPhase`, `EVENING_START`
- `packages/shared/src/week.ts`: `weekCheck`, `weekSummary`, `weekStreak`
- `packages/shared/src/templates.ts`: `buildTemplate`, `TemplateError`, `GOAL_SPECS`, `TEMPLATE_RULES`, `weekdayOf`, `floorMinutes`
- `packages/shared/src/schemas.ts`: `zTemplateInput`, `zTemplateRequest`, `zOnboarding`, `zDeleteAccount`, `zWeekday`, `zGoal`, `zClockMinutes`, `zPace`; `zMark` gains `sick`
- `apps/api/src/routes/me.ts` (`/me`, `/me/onboarding`), `routes/plans.ts` (`/plans/template`), `routes/auth.ts` (`/signup`, status), `services/plans.ts`, `services/account.ts`, `drizzle/0006_onboarding.sql`
- `packages/shared/src/miles.ts`: `sessionMiles`, `dayMiles`, `ranMiles`, `DEFAULT_EASY_PACE`
- `packages/shared/src/morning.ts`: `NEW_ACCOUNT_MORNING`, `afterLabel`
- `apps/api/src/routes/plans.ts` (`/plans/template`, `/plans/template/undo`), `routes/core.ts` (`/blocks/:id`, `/blocks/:id/restore`), `routes/import.ts` (`/export`, `/import`), `services/exporter.ts`, `lib/requests.ts` (`Idempotency-Key`, `X-Local-Date`), `drizzle/0008_fix_round.sql`
- Tests: `packages/shared/src/{words,phase,week,templates,miles}.test.ts`, `apps/api/src/routes/{platform,fixround}.test.ts`, `apps/web/src/api/outbox.test.ts`

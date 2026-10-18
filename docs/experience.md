# Logbook experience spec, v3

The one document every build team works from. Inputs: `docs/research/consumer-research.md` (what premium consumer apps do, with sources) and `docs/research/audit.md` (what our build does wrong, screen by screen). Brand values in `docs/brand.md` stay: true black, one electric blue, the halo, Instrument Serif italic, Inter Tight stamps, caps labels, the voice. This spec replaces the layout recipes in `docs/design-spec.md` and the motion section of `brand.md` where they disagree.

The verdict we are fixing: every screen is the same module (caps label over a `#111` card) stacked nine times, ordered like the database, with no sense of time of day, actions as grey text links, gestures nobody can find, heroes that repeat (and contradict) the list beneath them, zeros as headlines, and no motion between related views.

The bar: someone opens Logbook at 6:30am and at 9pm and in under two seconds sees the one thing that matters now, touches it directly, and feels the app answer.

---

## 1. Principles (the review checklist for every screen)

1. **One job per screen, one hero, nothing twice.** The hero *is* the object; no row underneath repeats it. One source for every status word.
2. **The screen knows what time it is.** Today has states; it is not a fixed stack.
3. **The thing is the control.** Tap the object to open it; hold it to lift or get its menu; drag it to move it; swipe it to triage it. Text-link actions are the exception, not the rule.
4. **Every gesture has a visible fallback.** Each object's long-press menu lists every action its gestures perform. A gesture is taught once, in place.
5. **Every touch gets a physical answer, matched to the event.** Named haptics (§3.3), at the visual peak, never more than one per action.
6. **Motion is physics, interruptible, rare.** Springs (§3.2). Related views move into each other. Nothing moves on its own. Celebration is one or two moments a day.
7. **Progress, not grades.** No zero as a headline. Forward-looking sentences. Streaks in weeks, rest counts.
8. **Summary on the surface, depth one tap away.** A hero shows one number and one sentence; the grid of stats lives in the detail.
9. **Instant paint.** Paint from the persisted cache, write optimistically, layout-true skeletons, never a spinner for content.
10. **Rhythm, not repetition.** Vary containers: a hero, a row of touchable objects, an edge-to-edge list, a carousel. Primary sections get 48px above them, secondary 24px. Caps eyebrows only where the content doesn't name itself.

---

## 2. Navigation

**Tab bar: Today · Morning · Plan · Progress · Journal.** Five tabs. Icons: Sun, AlarmClock, CalendarDays, Activity, BookOpen.

| Route | What | Reached from |
|---|---|---|
| `/today/:date?` | Today (time-aware) | Tab |
| `/morning/:date?` | Morning: the schedule from the alarm to the door. The routine's steps hold-and-drag into order, tap to edit, add your own | Tab; Today hero, pull down on hero |
| `/plan/:view?/:date?` | Plan: week agenda; `month` zoom; `plans` | Tab |
| `/progress` | Progress (was Trends). `/trends` redirects here | Tab |
| `/journal/:tab?` | Journal. `tab` = `library` (quotes + reads) | Tab |
| `/reads/:tab?` | Reads, **pushed** from Journal Library | Journal |
| `/settings` and `/settings/:section` | Profile and settings, **pushed** | Avatar in every tab header |
| `/welcome/*` | First-run onboarding | After sign-up, or when the account has `onboardedAt = null` |

Rules:
- **Pushed pages** have a back chevron top-left (44px) and support an edge swipe from the left 20px to go back (follows the finger, commits at 35% width or velocity > 500px/s, `springs.page`). The tab that owns them stays lit (Morning lights Today, Reads lights Journal, Settings lights nothing but shows the avatar ring).
- **Re-tapping the active tab** scrolls to top; if already at top, returns to today's date / this week.
- **Every tab header**: a small date line (caps 11) on the left above the serif word, an avatar (32px circle with the user's initial, 44px hit) on the right. No gear, no prev/next arrows in headers.
- **Date navigation** is swiping the hero or the date line horizontally (Today, Morning) or the week header (Plan). Content slides with the finger, `springs.page`. Tap the date line for a calendar sheet. "Today" chip appears in the header only when off today.
- **Tab switch**: instant cut with a 120ms opacity fade on the incoming page. No slide, no stagger.

---

## 3. Foundation (built first; every team uses it)

### 3.1 Primitives (in `apps/web/src/ui/`)

| Primitive | Contract |
|---|---|
| `Pressable` | `motion.button`/`motion.div` wrapper: press scales to 0.97 on `springs.press`, optional `haptic` prop (event name), `onPress`, `onLongPress` (450ms, cancels on 8px move). Replaces ad-hoc `whileTap`. |
| `ContextMenu` | Long-press (450ms) on its child lifts the child (scale 1.03, `springs.lift`, `haptics.lift()`), dims the page to 70% black with blur, and shows a menu card (surface-2, 14px radius) anchored above or below. Items: `{ label, icon?, onSelect, destructive?, disabled? }`, destructive last and red. Tap outside / Escape / swipe down dismisses. Keyboard: Shift+F10 / ContextMenu key opens it. API: `<ContextMenu items={...} preview?>{child}</ContextMenu>`, plus `useContextMenu()` for imperative open. Children's own taps still work. |
| `SwipeRow` | Horizontal swipe with left and right actions: `{ left?: {label, icon, tone, onCommit}, right?: {...} }`. Follows finger 1:1 with rubber band past 60%; the action icon grows as it approaches the commit threshold (40% of row width); `haptics.threshold()` on crossing (once per crossing); release past threshold commits, otherwise springs back (`springs.settle`). Direction-locks at 10px so vertical scroll wins. Exposes every action again via `ContextMenu`. |
| `Ticker` | Number that springs to its value (`springs.number`). Prop `from` controls the start; by default it animates only on value *change*, never from 0 on mount, unless `useFirstToday(key)` says this is the first view today. |
| `useFirstToday(key)` | Returns true once per calendar day per key (localStorage `logbook.seen.<key>.<date>`), so the route draws and rings fill once a day and tab returns are still. |
| `Skeleton` | Grey blocks shaped like the real layout (`surface` at 100%, no shimmer). `Loading` is deleted; every former `Loading` renders a page-specific skeleton. |
| `EmptyState` v2 | One sentence, one verb button, an optional ghost preview (the filled state rendered at 30% opacity, non-interactive) and optional starter chips (`starters: string[]`, one tap adds). |
| `WeekRing` | 7-segment ring (one arc per day, gaps of 4°), each segment coloured by day status (done blue, floor amber, missed `ink-4`, rest `ink-4` dashed, future `surface-3`). Fills on `springs.number` once per day. 40px and 64px sizes. |
| `PushedHeader` | Back chevron + title (serif 28) + optional right action; owns the edge-swipe-back gesture. |
| `TabHeader` | Date line (caps) + serif title (44) + avatar; optional right accessory before the avatar. |
| `Sheet` v2 | Existing sheet plus: `sheet.push(spec)` / `sheet.pop()` for a stack inside one sheet (Edit, Move push in from the right with a back chevron in the sheet header; `springs.page`), a `detent: 'auto' | 'large'` option, and support for a shared element (`layoutId`) travelling from the opener into the sheet header (`LayoutGroup` at the app root). One header pattern for every sheet: caps eyebrow (optional) + serif title (28) + close. |
| `Toast` | Keep; width sizes to content; Undo is a 44px target. |
| `DatePager` | Horizontal pager for date-keyed content: renders the current date's content, drags 1:1, commits to prev/next on 30% width or velocity, slides the new content in (`springs.page`), `haptics.select()` on commit. Used by Today hero and Morning. |

### 3.2 Motion (`apps/web/src/lib/motion.ts`)

```ts
export const springs = {
  press:    { type: 'spring', stiffness: 600, damping: 35, mass: 0.6 },
  lift:     { type: 'spring', stiffness: 500, damping: 30, mass: 0.8 },
  settle:   { type: 'spring', stiffness: 450, damping: 34, mass: 1 },
  sheet:    { type: 'spring', stiffness: 380, damping: 38, mass: 1 },
  page:     { type: 'spring', stiffness: 300, damping: 32, mass: 1 },
  number:   { type: 'spring', stiffness: 170, damping: 26, mass: 1 },
  complete: { type: 'spring', stiffness: 500, damping: 18, mass: 0.8 },
} as const;
```
- Opacity tweens 120ms in / 100ms out. Colour/halo 200ms on `ease`. No ease-in.
- **Animates:** press, lift, drop, swipe, sheet, pushed page, date pager, segmented content (slides in the direction of the change), list insert (height 0→auto + fade, `settle`) and remove (collapse after its completion beat), numbers on change, the route draw (1.1s, once a day), the week ring fill (≤ 900ms, once a day), completion pops.
- **Never:** on scroll, ambient loops (one exception: the Morning "now" dot pulses 2s, 4% amplitude), stagger > 6 items or > 30ms, page slides on tab switch.
- **Reduced motion:** springs become 150ms opacity fades; ring and route appear complete; drags still work with no scale.
- **Halo is state-driven:** full bloom on done, amber-tinted edge on floor, dim and cool (40%) on missed/open past, 60% on upcoming, soft on rest. 200ms crossfade between states; on the day's first completion it brightens 20% for 600ms.

### 3.3 Haptics (`apps/web/src/lib/haptics.ts`)

Named events; the old `haptic(kind)` stays as an alias so nothing breaks.

| Call | Native mapping | Used for |
|---|---|---|
| `haptics.select()` | `selectionChanged` | Day/week step, segmented change, scrub step, drag crossing a slot/day/5-min/0.5 mi (throttle 40ms) |
| `haptics.toggle()` | Impact Light | To-do checked, star, small toggles |
| `haptics.orb()` | Impact Light (Soft when a native plugin exists) | Habit orb lit |
| `haptics.lift()` | Impact Medium | Long-press lifts an object |
| `haptics.drop()` | Impact Light (Rigid when available) | Drop into slot |
| `haptics.threshold()` | Impact Light | Swipe crosses commit, pull-to-refresh armed |
| `haptics.success()` | Notification Success | Session done, Strava run lands, all habits lit, save of a multi-step thing |
| `haptics.celebrate()` | Impact Heavy, then Success 120ms later | Week ring closes, plan block completes (≤ once a week) |
| `haptics.delete()` | Impact Medium | Destructive action committed (with Undo) |
| `haptics.warning()` | Notification Warning | Plan conflict on drop |
| `haptics.error()` | Notification Error | Sync failed, action blocked |

- No haptic on taps that only navigate or open a sheet.
- A **Haptics** toggle in Settings (on by default), stored in `localStorage` key `logbook.haptics`.
- iOS Safari (PWA) has no vibration API; visuals must carry every meaning alone. The native app is the haptic experience.

### 3.4 Type, rhythm, containers

- Page title: serif 44 (28 when it wraps or under 360px). Sheet title: serif 28. Section titles: Inter 17/600 in sentence case, **not** caps eyebrows, unless the section is a metric label.
- Spacing: 48px before a primary section, 24px before a secondary one, 12px inside a group.
- Containers rotate by purpose: the hero (aura card), a row of touchables (orbs, chips), an **edge-to-edge list** (no card; hairlines between rows, 16px gutter), a horizontal carousel (snap), a single inset card for one object. Never two identical cards in a row.
- One time format: `7:35` with a small `AM` only where ambiguous; durations `1 h 10 min`.
- One status vocabulary from `packages/shared`: Planned, Today, Done, Floor, Missed, Skipped, Rest, Bonus. The hero and every row call the same function.

---

## 4. Platform (shared + API, built alongside the foundation)

- `dayPhase(now, ctx)` in `packages/shared/src/phase.ts`: returns `{ phase: 'morning' | 'out' | 'day' | 'evening' | 'rest' | 'past' | 'future', doorIn?: minutes, backBy?: clock, ... }` from the morning timeline, the day's session(s), its status and the clock. Morning = before door time; out = between door and back; day = after back until 6pm (or after the session is done); evening = from 6pm; rest = no session today (still has evening after 6pm); past/future = other dates.
- **One status source**: audit §2.1 found the hero saying FLOOR while the row says MISSED for the same session. Find the cause in `status.ts` / callers, fix it, add tests.
- `weekStreak(snapshot, today)`: counts consecutive *weeks* that met the floor rule (≥ 3 sessions kept or ≥ 80% of planned miles; rest, floor and skipped-for-illness count as kept); returns `{ weeks, ofLast: { kept, total } }` for "7 of the last 8 weeks".
- **Plan templates** in `packages/shared/src/templates.ts`: `buildTemplate({ goal: 'base' | '5k' | '10k' | 'half' | 'marathon', weeks, startDate, runDays: Weekday[], longRunDay, weeklyMiles })` → `{ name, sessions: SessionInput[] }` with build weeks, a down week every 4th, a taper for race goals, easy/long/workout mix by goal. Tests. API `POST /plans/template` applies it (creates the plan block and sessions, replacing future planned sessions in the window only when `replace: true`).
- **Sign-up and onboarding**: `ALLOW_SIGNUP` env (default off; on for local dev) lets `/setup` create more accounts. User gets `onboarded_at` (migration). `GET /me` includes it. `POST /me/onboarding` takes `{ goal, raceDate?, runDays, longRunDay, weeklyMiles, wake, leave, pace, habits: string[] }`, writes morning settings, creates starter habits, applies a template, sets `onboarded_at`. Idempotent.
- **Account**: `DELETE /me` (with password) deletes the account and its data.

---

## 5. Pages

### 5.1 Today

**Jobs:** (1) know today's training, do it, see it land; (2) clear the small daily things: habits, then to-dos; (3) close the day.

**Structure, top to bottom:**
1. `TabHeader`: date line ("WED, OCT 14"), serif title = the day's word (the session's run name or "Rest", e.g. *Speed*; falls back to *Today*), avatar.
2. **The hero** (aura card, swipeable with `DatePager`). Content by `dayPhase`:
   - **morning**: "Out the door in 22 min" (serif 28; the count updates each minute), the session stamp (SPEED 5) as the label, a **mini timeline** (wake → door → back → leave as a 4-stop line with a "now" dot and the four clock times under it). Tap → the session sheet. **Pull down on the hero** (or tap the mini timeline) → push Morning.
   - **out**: "Back by 8:22", a thin progress line from door to back.
   - **day / post-run, done**: the route drawn on black (once a day), stamps DISTANCE · PACE · TIME, verdict line ("5.02 mi at 8:14. Logged."), a Share pill. When a Strava run arrives while open: route draws, numbers tick, `haptics.success()`, Share pill.
   - **day, not done**: session stamp, plan line, a **hold-to-complete ring** on the right (400ms hold fills the ring, `success`; tap opens the sheet).
   - **rest**: "Rest. It counts." with a soft halo and the week ring.
   - **evening**: becomes the **Close the day** card (see 5).
   - Two sessions in a day: the hero pages horizontally between them (dots under it); the date pager still works on the date line.
   - The **week ring** (40px) sits top-right inside the hero; tap → week sheet (seven days, miles vs plan, streak "7 of the last 8 weeks").
3. **Habits**: one row of orbs directly under the hero (horizontal scroll if > 6, snap). Orb = the meter: its ring fills as the day's habits are done. Tap → lit (`complete` pop to 1.12, glow bloom, `haptics.orb()`); last one lit → all orbs pulse left to right 40ms apart, caption "All lit.", `haptics.success()`. Hold → `ContextMenu` (Note, Details, Reorder, Archive). Drag after hold reorders. Details → habit sheet (streak, 30-day grid, notes, rename, archive with Undo). A trailing "+" orb adds a habit (inline field with starter chips: Sleep 7 h, Stretch, Read, Protein, No phone in bed).
4. **To-dos**: section title "To-dos" (17/600) with the count as a quiet number; edge-to-edge list of the **top 3** Today items (high first, then hand order) using `SwipeRow` (right: Done, left: Later) and `ContextMenu` (Today/Later/Someday, Priority, Delete). A "+N more" row and the Later/Someday counts open the **to-do sheet** (full list with folds, quick-add, drag to reorder). Quick-add field stays at the bottom of the 3 rows with the parsing hint.
5. **Close the day** (evening phase, or when the user scrolls to the end after 6pm): an inset card with the day's stamped row (MI · HABITS · TO-DOS), the journal composer ("Speed 5 done. How did it feel?" built from the day), and when two sentences are saved, a "Share the day" 9:16 card. Today's read appears here as one compact row only if a pick exists.
6. **Remove**: the stat strip, the separate Training section (a second planned session pages in the hero; "Add a session" lives in the hero's context menu and in the empty state), the daytime journal composer, prev/next arrows, the gear.

**Empty / first day**: one "Set up your day" card with three starter actions (Add habits · Plan a week · Connect Strava), not five grey sentences.

### 5.2 Morning (pushed from Today)

**Jobs:** (1) when must I leave; (2) bend the morning and see the knock-on; (3) check it fits work.

- `PushedHeader` "Morning" + date line; `DatePager` swipes days.
- The **timeline fills the screen**: 48px time axis, blocks sized to their duration, free time left empty and labelled ("18 min free"), a blue **now line** with the pulsing dot, the **Leave** block pinned as the endpoint with its time stamped.
- **Direct manipulation, with visible handles**: the wake marker has a grip (drag in 5-min steps, `select` per step, everything below recomputes live); the run/gym block's bottom edge has a grip (0.5 mi / 5 min steps). First visit: the wake grip nudges once.
- **Long-press any block** → menu: Edit, Skip, Make this a rest day, Edit routine.
- **Routine editor** (sheet, large detent): the routine as reorderable blocks with duration chips (drag to reorder, tap chip to change), previewed live on a mini timeline at the top. Replaces the 11 numeric inputs and the Plan/Settings segmented control.
- **Remove**: the hero that repeats the timeline, the Edit pill, the week strip.

### 5.3 Plan

**Jobs:** (1) see this week and reshape it around life; (2) see the block's arc; (3) make or regenerate a block.

- `TabHeader` "Plan"; under it the **week header**: "26 mi planned · 5 runs" with a thin progress bar of miles done; swipe it (or the agenda) left/right to change week (`DatePager` semantics).
- **Seven day rows** (edge-to-edge list): weekday + date, a 3px tone bar, session name in its stamp, distance, status mark. Today is lit with the halo. Rest days are quiet rows ("Rest").
  - Tap a row → session sheet (shared element). Tap an empty day → add a session to that day.
  - Hold + drag a session onto another row: drop moves it; dropping onto an occupied day **swaps** them (`drop` haptic, Undo toast); two hard days back to back → `warning` and "Two hard days in a row. Keep it?" inline.
  - `SwipeRow`: right = Done, left = Move (opens the move sheet).
- **Zoom out**: pinch in, or pull down on the week header → month/block view (7-column grid with miles per day and a weekly totals column, heat of planned vs run). Tap a week to zoom back in. A small "Month" text button in the header is the visible fallback.
- **Plans** (from the header's menu or the empty state): the plan list and **New block** → a sheet with a template picker (goal chips, weeks stepper, run days by tapping weekday letters, long-run day, weekly miles) previewing the block as ghosted rows; one tap "Use this plan". The AI builder ("Write my next block") is an option in the same sheet when enabled.
- **Session sheet** (shared by Today and Plan): shared-element title travels from the hero/row (`layoutId = session-<id>`). Top: the route map when there is one. Big primary actions: **Done** and **Floor** (48px, Done is the one blue). Skip and Move as secondary. Delete in the sheet's overflow menu (with Undo). Edit and Move **push** inside the sheet. Kind-aware editor: run (type chips, miles stepper, floor preset), lift (exercise list), cross (minutes); a day-strip date picker; "Repeat last Easy".
- **Share sheet**: a swipeable carousel of live template previews with a page indicator; Share is the one blue verb.
- **Remove**: the selected-day hero, the Week/Month/Plans segmented control, the "Open" row.

### 5.4 Progress (was Trends)

**Jobs:** (1) am I on track this week and this block; (2) am I getting fitter; (3) am I consistent.

- `TabHeader` "Progress".
- **Verdict sentence** in serif 28 built from data ("Three weeks building. This one is light so far."), never a zero headline; early in the week compare to the same weekday last week.
- **Mileage chart** (220px): run bars, ghost plan bars, average line, current week blue, series labelled directly (no legend row). **Scrub**: press and slide; the headline numbers above rewrite to the week under the finger, `select` per bar, Light at the max; release returns. Tap a bar → week sheet.
- Range: three small chips over the chart (3M · 6M · 1Y) that apply to **every** section below; pinch on the chart also changes range.
- Below, an edge-to-edge list of drill-downs, each a row with a sparkline and one number: **Plan adherence** (this block), **Long run** progression, **Easy pace** at effort, **Lifts** (each opens the lift sheet with an e1RM line), **Consistency** (opens the habit grid as a full sheet with per-habit rows and the existing scrub).
- **Remove**: the legend row, the 4-stamp zero hero, "−12.2 mi vs avg" early in the week.

### 5.5 Journal

**Jobs:** (1) write today's two sentences; (2) remember; (3) collect fuel: quotes and reads.

- `TabHeader` "Journal".
- **The composer first**, open, with the placeholder built from the day ("Speed 5 done, 5.02 mi. How did it feel?"). The quote of the day sits inside the composer as an optional prompt line in serif 17 at ink-3; swipe the quote line to shuffle, long-press to favourite or hide.
- A **ribbon of the last 14 days** (a dot per entry, filled if written; tap a dot → that entry, shared element).
- **On this day** / **From your journal** as one card, then the entry timeline (edge-to-edge, newest first).
- **Library** segment at the top of the page (Journal · Library): quotes (themes, favourites, your own) and a **Reads** row that pushes `/reads`.
- **Remove**: the Shuffle/Hide/Open chips, the quote hero card, the sub-tabs 930px down.

### 5.6 Reads (pushed from Journal → Library)

Keep the reviewed page; change: `PushedHeader`, the pick hero only when a pick exists (otherwise a slim "Save links and Logbook will find you one a day" card), rows on `SwipeRow` + `ContextMenu`.

### 5.7 Settings (pushed from the avatar)

A real settings tree (grouped edge-to-edge lists): **You** (name, goal and race date, units), **Training** (weekly miles, run days, long-run day, pace), **Morning routine** (opens the routine editor), **Habits** (list with reorder and archive), **Connections** (Strava with status; shown as a red row only when broken), **App** (Haptics on/off, Install on web), **Data** (Import, Export JSON), **Account** (Sign out, Delete account with password and a 2-step confirm).

### 5.8 First run (`/welcome`)

About 60 seconds, value before asks.
1. **Promise**: black, the mark, the halo rising, "Your day, lit." and **Start**.
2. **Account**: email + password (Sign in with Apple is out of scope for now) → creates the account. (Ordering note: a server account is needed to persist; keep this one short and come straight back.)
3. **Three questions**, one per screen, answered by direct manipulation: what are you training for (goal chips: Just running · 5K · 10K · Half · Marathon, plus a date wheel for a race), which days can you run (tap weekday letters; long run day by holding one), when do you wake and leave for work (drag two markers on a timeline; `select` ticks).
4. **Starter habits**: tap chips (Sleep 7 h, Stretch, Read 15 min, Protein, No phone in bed, + your own).
5. **The payoff**: shared transition into a real Today whose hero reads "Tomorrow: Easy 4. Out the door 6:50." with the generated week visible in Plan.
6. **Strava primer** (after the payoff, as a card on Today): sample route card animates in, "See your runs land here", **Connect Strava**, and a guilt-free "Later".
7. Notifications are not built yet; no prompt.

---

## 6. Copy

| Where | Logbook says |
|---|---|
| Week, Monday morning | "26 mi planned. First run today." |
| Streak after a miss | "7 of the last 8 weeks." |
| Hero, morning | "Out the door in 22 min." |
| Hero, after Strava | "5.02 mi at 8:14. Logged." |
| Rest | "Rest. It counts." |
| Floor | "Floor met. 20 min is a day kept." |
| Journal placeholder | "Speed 5 done. How did it feel?" |
| Evening | "Two sentences, then sleep." |
| Delete | "Deleted" + Undo |
| Sync error | "Couldn't reach Strava. Trying again when you're online." |
| Drop conflict | "Two hard days in a row. Keep it?" |
| Plan builder | "Write my next block" / "Use this plan" |
| Not feeling well (session menu) | "Not feeling 100%. Ease the next few days." |

Numbers before adjectives, sentence case, no exclamation marks, no "Oops", no "Great job". Any AI-written line must cite something specific from the user's own data or not show.

---

## 7. Definition of done (every team)

- Typecheck clean for all packages, shared tests pass (add tests for new shared logic), web build passes.
- Screens verified with Playwright at 390×844 and 320×568 with touch: no horizontal overflow, no mid-word breaks, every target ≥ 44px, console clean.
- Every gesture has its context-menu or button fallback; keyboard and VoiceOver can do everything; reduced motion verified.
- Every haptic call uses the named API (§3.3).
- No `Loading` spinner, no grey-sentence empty state, no zero headline, no caps eyebrow where the content names itself.
- Before/after screenshots of every screen and state the team touched, listed in the team's `REVIEW.md`.

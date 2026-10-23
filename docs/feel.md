# Logbook experience spec v4: feel

**This document supersedes `docs/experience.md` §2 (Navigation), §3 (Foundation: primitives, motion, haptics, type and rhythm) and §5 (Pages) wherever the two disagree.** `experience.md` §1 (principles), §4 (platform), §6 (copy) and §7 (definition of done) still stand except where a line below replaces one of theirs. `docs/foundation.md` describes the primitives as they were; the primitives below are the ones to build, and the build teams' typed contract is `scratchpad/feel/contracts.md`. Every build team works from this file. Where a number is given it is the number to type; nothing in here is left as an option.

Built from the winning design draft (A, the UIKit map) with the ideas the three judges named from drafts B (flow-first) and C (subtraction first) grafted in, and every conflict between them resolved in §0.3. It designs inside `scratchpad/feel/decisions.md`; where this spec reads differently from a draft, the decisions file wins and §0.3 says why.

Paths are under `apps/web/src/` unless they start with `apps/` or `packages/`. Geometry is for a 390 × 844 iPhone at 1× (CSS px); `--safe-t` is 59 on the device, `--safe-b` 34; on the web both come from `env()`. Evidence keys: `nav Fn`, `motion #n`, `touch Fn`, `shell Fn`, `visual Fn`, `flows n.n` are the six audits under `scratchpad/feel/audit/`; `critic Cn/Dn/#n` is `audit/critic.md`; `perf #n`, `morning #n`, `evening #n`, `newuser n.n`, `navlive Mn` are the live reports; `R-motion Pn`, `R-daynav Pn`, `R-dayscreen Pn`, `R-micro Pn`, `R-webview Pn` are the research files.

---

## 0. Why, what, and the decisions made in the merge

### 0.1 The arithmetic (what the app stops doing)

| Grammar | Today | After |
|---|---|---|
| Ways to change the day | 10 (arrows, hold-repeat, hero swipe, date-line swipe, calendar, Today chip, lit-tab re-tap, "This week" chip, Month button, pinch, header pull) | **3**: swipe the page; tap a strip cell; come home (title block, Today pill, today's cell, lit tab). The calendar survives behind the title's hold menu: a jump, not a grammar |
| Hold clocks | 5 (220, 300, 380, 400, 450 ms) | **1** reveal clock, 450 ms. The hold ring's 400 ms *fill* is a confirm with visible progress and stays |
| Press scales | 5 (0.92, 0.94, 0.97, 0.98, 0.985) + a 100 ms CSS tween | **1**: 0.97, instant on `pointerdown`, 160 ms out |
| Gestures on the hero | tap, hold, horizontal pager, inner carousel, vertical pull, ring, share pill, timeline, dots | **2** on the card: tap opens, hold menus. The page swipes; sessions stack |
| Doors to the morning | 6 | **2**: the hero's four-stop line, the "This morning" row |
| Editors for the run | 2 (`DayEditor` → override, `SessionEditor` → session) | **1**: the session sheet |
| Tabs | 5 | **4** |
| Springs | 7 named + motion's default drag inertia + CSS tweens | **8** springs, 1 sheet curve, 1 press tween, nothing else |
| Hero menu items | 8 | **4** |
| Haptics on navigation | tab, arrow, pager commit, segmented, date-line swipe, calendar, PlanEnd | **0** |
| Toast triggers | every save, 2.8 / 6.5 s, cross-tab | Undo and errors only, 4 / 6 s, scoped to the tab |
| Blurred surfaces | 3 | **0** (WP5 landed this) |
| Font sizes / radii / row heights | 24 / 19 / 7 | 9 / 4 / 2 |
| Horizontal gestures on the Today page | pager, inner carousel, date-line swipe, swipe rows, orb scroll | **1** JS gesture (the pager) + the orb row's native scroll |

### 0.2 The owner's day, tap by tap (the acceptance spine)

Each step: what is on screen → what the finger does → what moves → the haptic → the time budget. §14 asserts these.

**6:30, in bed (Fri Oct 23, Easy 4, alarm 7:15, leave 9:30)**

| # | On screen | Finger | What moves | Haptic | Time |
|---|---|---|---|---|---|
| 1 | Launch image (black, tab-bar silhouette) | taps the icon | Today paints from the cache under the splash; the splash fades 200 ms | none | first content frame ≤ 450 ms warm at 1×, ≤ 1.2 s at 4× + Slow 4G; no skeleton, no black frame |
| 2 | Bar: `STEADY · FRI, OCT 23` · avatar. Title `Today`. Strip Mon–Sun, Fri filled. Hero: `THIS MORNING` / `EASY 4` / *Out the door in 60 min* / stops `Wake 7:15 · Door 7:30 · Back 8:13 · Leave 9:30`. Row `This morning · Leave 9:30 ›`. Habits 0 of 5. To-dos. Week card. | reads | nothing; the countdown ticks on the minute | none | 0 |
| 3 | same | taps the stops line (or the row) | This morning pushes over Today: Today recedes to −30 % under a 0.12 scrim; the page slides in on `page` (0.35 s); the four-stop line flies from the hero to the Now card | none | first frame moves ≤ 16 ms after touch-up; rest at 350 ms |
| 4 | This morning: Now card, Wake 7:15 · Easy run · Free · Shower 8:40 · Get ready · Smoothie · Prep · Leave 9:30 (last row, pinned) | presses the `7:15` stamp, drags down 42 px | the stamp rolls in 5-min steps (14 px each); every time below recomputes on the same frame; the Leave stamp rolls | `selection` per step (3) | 0 lag; one write on release |
| 5 | Wake 7:30, Door 7:45, Back 8:28, routine 8:40 unchanged, Leave 9:30 | lifts | the changed stamps flash `--accent-text` → `--ink` over 400 ms; the Wake row's sub reads `Just today` | none | 400 ms |
| 6 | same | swipes from the left edge | Today is under the page from the first frame, moving −30 % → 0 with the finger; release past 35 % or ≥ 300 px/s commits | none | release → rest ≤ 350 ms; history pops on the rest frame |
| 7 | Today, hero `Out the door in 45 min`, stops updated | holds the hero 450 ms | at 300 ms the card grows to 1.02 (visual only); at 450 it lifts to 1.03 and the menu appears: Done · Skip · Move · Share | `lift` at 450 ms | menu on screen ≤ 140 ms after 450 |
| 8 | menu | taps Skip | the face crossfades 150 ms to `EASY 4` / *Skipped.* / stops unchanged; toast `Easy 4 skipped · Undo` 6 s | none (a `toggle` is for completion; Skip has Undo) | 150 ms |

Alarm change: 3 gestures (open, drag, back), versus 6 taps across a tab change today.

**7:50, mid-run.** Hero `OUT · EASY 4` / *Back by 8:13* / the door→back line with the dot at 44 %. The dot advances once a minute (transform only). Nothing else.

**8:45, back home**

| # | On screen | Finger | What moves | Haptic | Time |
|---|---|---|---|---|---|
| 1 | Hero `TODAY'S RUN · EASY 4` / *4 mi · floor 20 min* / status line `Checking Strava…` / deck: hold ring 48 + `Leave 9:30 · in 45 min` | opens the app | one `POST /strava/sync`; the status line fades in 120 ms and stays ≥ 600 ms | none | request ≤ 100 ms after visible |
| 2 | sync answers `changed: 1`, month refetched | — | the ring fills to full (0–300), becomes the check in the same circle (300–500), the card grows 184 → 304 on `settle` (500–850) with everything below riding the same spring, the route draws 1.1 s and the stamps tick from the planned miles | `success` once, on the settle frame (~850) | 1.95 s total, nothing after |
| 3 | Habits | taps `Meditate` | orb fills, pops 1 → 1.12 → 1 on `complete`, check draws, label to ink | `orb` on the fill frame | first visible change ≤ 16 ms |
| 4 | To-dos | taps `Add a to-do` | the row becomes the field; the keyboard rises under `--kb`; nothing else moves | none | field focused on touch-up |
| 5 | types `Call Sam`, Return | the row inserts at 44 with its text on frame 1; rows below move down on `settle` via transform | none | 300 ms |

**13:00, a glance.** Route face with the verdict and the coach's one sentence; habits 2 of 5; to-dos 1 open; the week card `WEEK 43 · 8 of 20 mi · 3 of 4 runs`. No black below the last card beyond 24 px. Progress and back: a 0 ms cut both ways; Today's scroll is where it was.

**21:00, close the day**

| # | On screen | Finger | What moves | Haptic | Time |
|---|---|---|---|---|---|
| 1 | The hero slot holds **Close the day**: `CLOSE THE DAY`, *Two sentences, then sleep.*, stamps `MI 4.0 · HABITS 3 of 5 · TO-DOS 2 done`, the run row `EASY 4 · 4.0 mi · 8:12 /mi ›`, the quote line, the composer, Save | taps the composer | keyboard rises; the card does not resize; the field scrolls above the keyboard | none | — |
| 2 | types two sentences, taps Save | the text settles into an entry row (150 ms crossfade in the same box); the title becomes *Day, closed.* (150 ms); the halo brightens 20 % for 600 ms; the stamps tick once | `success` once | 600 ms |
| 3 | the card's foot: `A word for tomorrow · Steady ›` · `Alarm 7:15 · change ›` · `Share the day` | taps the word, types `Patient`, Return | the caps line in the sticky bar reads `PATIENT · FRI, OCT 23` at once; no toast | none | 120 ms |
| 4 | taps `Alarm 7:15 · change` | a medium sheet rises (0.5 s on the sheet curve); the page recedes to 0.92 bound to the sheet's own `y` | none | first frame moves ≤ 70 ms after touch-up at 4× |

**23:58 → 00:02 with text in the composer.** Nothing changes: the page, its title, its caps line and the composer stay on Friday until the entry is saved and the page has been idle 60 s (or the tab changes, or the app returns from background with the composer empty). Yesterday's card is one swipe to the right at any hour.

**Sunday night, plan the week.** Plan: `THIS WEEK · OCT 19–25` · `Week | Month`. Swipe left anywhere on the rows: the whole week pages 1:1, hand-off 0 px. Hold Tuesday's `Speed 5` 450 ms: lift + menu `Done · Skip · Move · Delete`; move while held: the menu closes, the pill follows the finger, the target row lights; release on Wednesday: the pill shrinks into the slot on `settle`, the displaced row slides on `settle`, toast `Moved to Wed · Undo`, `drop`. Tap `Month`: a 200 ms crossfade, the segmented thumb slides 150 ms.

**Looking ahead and coming home.** Swipe left anywhere below the bar: the page slides 1:1; the strip's disc slides one cell with the drag; the title crossfades `Today` → `Tomorrow` with the drag's progress; at commit the trailing slot crossfades avatar → `Today` pill (120 ms, fixed 80 px slot: nothing reflows). Four more swipes, the fourth starting while the third is still sliding: the slide stops under the finger on `pointerdown`, the finger re-bases, the drag continues (critic C2). On `Wed, Oct 28`: tap the pill (or the lit tab, or the filled today cell, or the title): one page-width slide home with the far content in the neighbour slot, title → `Today`, pill → avatar.

**First launch.** `/start` at once (mark and title at 0 ms, sub at 80, Start at 160); account form rises inside the same surface; four questions slide on `page`; the payoff **is** Today's first-run hero: `Open Today` fades the week rows away (translateY 40 + fade 200 ms) and the bar, strip and tab bar fade in around the hero that stays put (≤ 2 px). Zero black frames.

### 0.3 Decisions made in this merge (every conflict, resolved)

| # | Question | Drafts | Judges | **Decision** |
|---|---|---|---|---|
| M1 | The manual completion control | A/B: a 48 × 120 `Done` pill, held to fill, tapped to open. C: the 48 px `HoldRing`, no caption | all three: C | **The `HoldRing` at 48, no "HOLD" caption, `touch-action: pan-y`, no pointer capture beyond the hold. The ring becomes the check in the same node (decisions §7 "the ring morphs into the check"). The Done pill does not exist.** |
| M2 | Header words during the drag | A: strip disc interpolates, words crossfade at release. B/C: words bound to `p` | J2, J3: B/C; J1 names B's | **Two stacked labels (title and caps) with opacity `1 − |p|` / `|p|` bound to the pager's `x` by `useTransform`; the disc translates with `p`. Nothing happens at release but the spring (decisions §4).** |
| M3 | A scrub on the strip | A: scrub vs swipe decided by speed (< 150 px/s). B/C: a drag on the strip pages | J1, J2: no speed gate; J3: keep a scrub tick (decisions Haptics) | **One gesture: a horizontal drag anywhere under the bar, the strip included, pages the day. The decisions' `selection` tick fires only when the pointer went down inside `.nb-strip`, once per cell boundary the interpolating disc crosses; a drag that began on the body is silent (critic D6). Deterministic by origin, never by speed.** |
| M4 | Chaining pages in one drag | A: commit at `|x| > W` mid-drag. B/C: clamp to one page | J2: clamp | **One page per gesture: `x` clamps at ±W with a 0.2× rubber band past it. A flick after the catch pages again.** |
| M5 | When the date commits | A/B: after the settle, `flushSync(onCommit)` + `x.jump(0)` in one commit. C: at release | J1, J2: after settle | **After the settle. The header already shows the destination (M2), so the 350 ms URL delay is invisible.** |
| M6 | The edge-pop recogniser | A: a 24 px overlay strip (over the chevron). B/C: a band test on the layer | J2: not over the chevron | **Pointer events on the pushed layer itself (`touch-action: pan-y`), claimed only when `pointerdown.clientX ≤ 24` **and** a 10 px x-lock follows. A tap on the chevron releases before the lock and is a tap.** |
| M7 | Sheet pre-render on `pointerdown` | A: yes | J1, J2, J3: no | **No. The body renders on `pointerup`; the first motion frame is the next frame.** |
| M8 | Sheet animation ownership | A: WAAPI open + `sheetY` bindings. B/C: CSS rise + `useTransform` (contradictory) | J2 common gap 2 | **One system: `sheetY` is the only owner. Open/close are `animate(sheetY, …, { duration: 0.5, ease: [0.32, 0.72, 0, 1] })`; scrim, recede and keyboard offset are `useTransform`s of `sheetY`; a `pointerdown` stops the one animation and re-bases.** |
| M9 | Swipe rows on Today's to-dos | A/B: `SwipeRow` with the claim rule. C: none on paged surfaces | J1: keep (Things); J2: C; J3: either | **None on the Today page: decisions §2 says "the day pager is the only horizontal gesture on the page". Done = tap the mark (check fills on the tap, row folds after 600 ms on `settle`); Later · Someday · Priority · Delete live in the row's hold menu and in the To-dos sheet, which keeps `SwipeRow` v2 (it is not paged). Reads and Library keep `SwipeRow` v2.** |
| M10 | Where the Plans list lives | A: `/plan/plans` pushed in Plan **and** inside Settings. B: Settings → Plan stack (cross-stack). C: Settings › Training only | J1, J2, J3: C | **`/settings/plans`, pushed at depth 2 from Settings › Training. Plan's block card keeps only `New block ›`. `/plan/plans` redirects to `/settings/plans`. No Settings row changes tab (decisions §3).** |
| M11 | The large serif title | A/B: keep (44 bar + large title + gap). C: delete | all: keep | **Kept, 34/40 serif italic, fixed from the route. It scrolls under the bar; the inline title fades in. C's inline-bar rule applies to pushed pages only.** |
| M12 | What collapses, and how | A: `IntersectionObserver`, strip scrolls away. B: strip `sticky` under the bar, `--hdr` from a passive scroll listener | J1, J2, J3: B | **The strip pins under the bar (`position: sticky; top: calc(44px + var(--safe-t))`). A passive scroll listener writes `--hdr = clamp(0, scrollTop / 44, 1)` on the tab; the inline title's opacity is `var(--hdr)`, the caps line's `calc(1 − var(--hdr))`, the large title's `calc(1 − var(--hdr))`. No observer, no height change.** |
| M13 | Hero geometry | A: content height per face. B: fixed 184 with a fixed 56 px deck; 304 landed | all: B | **Fixed. 184 on every face but the landed route face (304). Zones: eyebrow 13 · stamp 34 · line 28 · deck 56, gaps 4/4/12, padding 16. Faces stay keyed inside `AnimatePresence mode="popLayout"` (no one-tree rewrite).** |
| M14 | Midnight | A: deferral with four conditions, caps shows the real date. B: rolls on foreground. C: 03:00 in `packages/shared` | J1: hold both labels; J2: A's deferral; J3: A | **Client-side deferral (§5.4). The whole page, title and caps included, holds the day; the strip holds too. No 03:00 boundary, no shared or API change. A foreground return with draft text does not roll.** |
| M15 | Phase changes on a propped-up phone | A/C: on the next interaction only. B: or after 60 s idle | J1, J3: add B's | **A clock-driven face change applies on the next interaction (which still performs its own action) or after 60 s with no touch, no focus, no sheet or menu, whichever first.** |
| M16 | One editor | A: `DayEditor` kept, writes the session. B/C: deleted; the session sheet | J3: both "full" | **`DayEditor.tsx` is deleted. The run row on This morning opens the session sheet (`useOpenSession`); `LateNote` chips `upsert`/`mark` the session or write `{ wake }`. The override keeps only `wake` (decisions §5), with a one-time quiet drop of the other fields on read.** |
| M17 | The word | A: sticky. B: dated `focus.for`. C: both | all: sticky | **Sticky (`settings.focus.word`, the existing field). Shown as `WORD · DAY, MON D` in the caps line of every day; changed from the Close card's row and the title's hold menu. No toast; the caps line changing is the confirmation. The sentence (`focus.quote`/`by`) shows as one quiet serif line under the hero and in the Close card.** |
| M18 | `success` haptics | A/B add "all habits lit". C: two a day | J3: C | **Exactly two a day (Close the day, the run landing) plus the weekly `celebrate`. No hold-ring 25/50/75 ticks.** |
| M19 | Press scale | A: 0.97 cards, 0.9 tab icons, 0.92 orbs | J1 | **One: 0.97. Rows show `--surface-2` instead; text verbs dim to 0.55.** |
| M20 | Blur in crossfades | B: 2 px | J2 | **None. Only `transform` and `opacity` animate, anywhere.** |
| M21 | Alarm drag scale | A 10 · B 12 · C 14 px per 5 min | J3 names C's | **14 px per step (15 min = 42 px, an hour = 168 px).** |
| M22 | Week on other days | A: future only (agenda), past "The day" card. B: week card every day. C: one row | J3: B | **A Week card on every day page (today included), the shown day marked on a 64 px `WeekRing`; past days also get "The day" card.** |
| M23 | Settings' routine editor | A: pushed `/settings/routine` from This morning too. C: a large sheet | — | **One presentation: `RoutineEditor` is a large-detent sheet, opened from Settings › Morning routine and from This morning's trailing icon. No `/settings/routine` route, no second door into Settings.** |
| M24 | Pull to refresh | A: every tab root on the native bounce. C: Today only | J1: gesture-scoped first; J2 gap 3 | **Today only. The recogniser is a `touchstart` at `scrollTop === 0` that attaches a non-passive `touchmove` for that gesture only (both platforms); reading the native bounce's negative `scrollTop` is a device-verified upgrade, not the plan. Ends when the fetch ends; under 150 ms shows no busy state.** |
| M25 | Lit-tab pop and history | A: `history.go(-stack.length)` | J1 found the bug | **Pops use `history.back()` only when the top entry's recorded `idx` equals `history.state.idx`; otherwise `replaceState(parentPath)`. Pop-all is visual, then `replaceState(root)`. `popstate` is a request resolved against `NavState`, never a truth (§1.3).** |
| M26 | Sheets and Back | A: `{ overlay: true }` entry. C: never push | J2 | **Sheets and menus push an overlay entry so browser/Android Back closes the top-most thing first.** |
| M27 | Hero → This morning shared element | A: a rect-to-rect flyer. B: into the time column with `scaleY`. C: parallax | J2, J3: A | **A's flyer: the four-stop line travels from the hero's rect to the Now card's rect bound to the push's progress; source hidden from frame 1, destination hidden until rest. The sheet title flyer is deleted (C).** |
| M28 | Journal segment switch | A: 30 % slide + crossfade. C: crossfade | — | **150 ms crossfade of two mounted panes; each keeps its scroll.** |
| M29 | Week ⇄ Month | A: crossfade + a `layoutId` row travelling. B: + blur. C: crossfade | — | **200 ms crossfade of the two panes, segmented thumb on `settle`. No `layoutId` travel.** |
| M30 | Chrome at rest | A: 24 under the strip (223). B: 16 (215). C: 163 (no large title) | J1 | **Today: 59 + 44 + 44 + 52 + 1 + 16 = 216 to the hero. Other tabs: bar + large title + 24.** |
| M31 | To-dos on Today | A: all rows. B: max 3 + `+N more`. C: all | J3: B's cap "has no evidence" | **The existing `TOP = 3` stays (it is current behaviour, `TodayTodos.tsx:14`): three open rows, a `+N more ›` row that opens the To-dos sheet, then `Add a to-do`.** |
| M32 | Run numbers | A: Strava from 0, manual from planned. B: always from planned | — | **Always from the planned miles; never a `0 mi` frame.** |

Agreements no one re-opens: four tabs; This morning pushed from the hero and the row; `replace` on every date step; tab switch 0 ms with both pages opaque; pushed pages over the mounted parent at −30 % / 0.12; no `window.scrollTo` on any route change; sessions stack vertically; one 450 ms hold clock; `bounces = true` + `overscroll-behavior-y: contain` on each scroller, never `none` on the shell; one request on a foreground return; `Keyboard.resize = 'none'` with `--kb`.

### 0.4 The rules

1. **The frame stays, the content changes.** The bar, the strip, the tab bar and the section order never move while a day, a phase or a tab changes under them.
2. **Springs for anything that moves**, written as Apple duration + bounce and converted once in `lib/motion.ts` (§10); tweens for opacity and colour only; `transform` and `opacity` are the only animated properties; CSS for predetermined motion, JS motion values only while a finger drives or a spring that a finger may catch is running.
3. **Nothing moves on its own.** Clock-driven changes wait for an interaction or 60 s of stillness.
4. **Frequency rule.** The ten-times-a-day actions (orb, to-do, tab, day step) get the least motion; the daily celebration is the run landing; the weekly one is the week ring.
5. **Every gesture has a visible fallback**: the hold menu lists what the gestures do; the hidden `dpager-sr` buttons keep the keyboard path.

---

## 1. IA and routes

### 1.1 Tabs

Four, in `ui/nav.ts` `TABS`:

| id | root | label | icon | selected |
|---|---|---|---|---|
| `today` | `/today` | Today | `Sun` | `fill="currentColor" stroke="none"` |
| `plan` | `/plan` | Plan | `CalendarDays` | filled |
| `progress` | `/progress` | Progress | `Activity` | stroke 2.5 |
| `journal` | `/journal` | Journal | `BookOpen` | filled |

Unselected: stroke 1.8, no fill. Labels 10/12 500, 600 when lit. The Morning tab, `AlarmClock`, `TAB_SECTIONS.morning` and `/morning/:date?` are deleted. The tab bar is 50 + `--safe-b`, opaque `--surface`, 1 px `--line-strong` top hairline, no blur (landed in WP5). Tab items are `<button>`s with the press state (§11.1). All four tabs stay mounted for the session, each in its own scroller.

### 1.2 Routes

| Route | Kind | Lit | Over |
|---|---|---|---|
| `/today/:date?` | tab root (date = page state mirrored by `replaceState`) | today | — |
| `/today/:date/morning` | pushed, "This morning", depth 1 | today | the day page |
| `/settings` | pushed, depth 1 | today | Today root |
| `/settings/:section` (`you` · `training` · `habits` · `plans` · `connections` · `app` · `data` · `account`) | pushed inside Settings, depth 2 | today | Settings |
| `/plan` · `/plan/week/:mon` · `/plan/month/:month` | tab root (view + anchor = page state, `replace`) | plan | — |
| `/progress` | tab root | progress | — |
| `/journal` · `/journal/library` | tab root (segment = page state, `replace`) | journal | — |
| `/journal/reads/:tab?` | pushed, "Reads", depth 1 | journal | Journal root |
| `/dev/ui` | pushed, depth 1 | today | Today root |
| `/welcome/*`, `/start`, `/login`, `/signup` | full screen, no tab bar | — | — |
| `/morning/:date?` → `/today/:date/morning`; `/reads/*` → `/journal/reads/*`; `/plan/plans` → `/settings/plans`; `/trends` → `/progress`; `/setup` → `/signup`; `*` → `/today` | redirects (`replace`) | | |

`ROUTES` in `ui/nav.ts` is a table keyed by path pattern with `{ owner: TabId; kind: 'root' | 'pushed'; depth; title }`; `matchRoute(pathname)` returns `{ tab, root, stack: PushedEntry[] }`. Settings' owner is `today`; Today's avatar is its only door; `SettingsView.tsx:222` (`/morning?routine=1`) goes.

### 1.3 The stack model and history

```ts
// ui/nav.ts
export interface PushedEntry { key: string; path: string; title: string; depth: 1 | 2; idx: number /* history.state.idx when pushed */; shared?: string /* the data-shared id the flyer travels between (This morning: 'morning-line-<date>') */ }
export interface TabState { path: string; stack: PushedEntry[] }   // scrollTop lives in the DOM: the scroller stays mounted
export interface NavState { active: TabId; tabs: Record<TabId, TabState>; overlays: number }
```

One `NavController` (`app/NavController.tsx`, React context from `App.tsx`) owns `NavState` and is the **only** caller of `history.pushState` / `replaceState` / `back()`.

| Action | History | Visual |
|---|---|---|
| Tap another tab | `pushState` (one entry) | 0 ms cut (§9.1) |
| Tap the lit tab, stack non-empty | pop every layer with one spring; on rest `replaceState(root)` | parent brightens from −30 % |
| Tap the lit tab, at root, off today / off this week | `replaceState(root)` | the pager slides home (§9.2) |
| Tap the lit tab, at root, on today, scrolled | nothing | the tab's scroller: `scrollTo({ top: 0, behavior: 'smooth' })` (300 ms; reduced motion instant) |
| Tap the lit tab, at root, on today, at top | nothing | nothing |
| Day / week / month step, strip tap, calendar pick, segment | `replaceState` | pager slides / segment crossfades |
| Push (row tap, avatar, stops line, "Reads") | `pushState` on the frame the push starts; `entry.idx = history.state.idx` | slide over the mounted parent (§9.3) |
| Pop (chevron, edge swipe) | on `animationComplete`: if `history.state.idx === entry.idx` → `history.back()`; else `replaceState(parentPath)` | parent to 0 |
| Open a sheet or a menu | `pushState({ overlay: true })`; `overlays++` | — |
| Close a sheet or a menu by its own control | if the top history entry is this overlay → `history.back()`, else `replaceState` | — |
| Browser / Android Back (`popstate`) | **a request, not a truth**: read the new URL; an overlay is open → close it; the URL is a page in the active stack → pop down to it (pop spring); the active root → pop all; another tab's root → cut to that tab (its stack as it was); then `replaceState` what is actually shown. Back never walks dates | |

Cold start on a deep link (`/today/2026-09-08`, `/settings/training`): the owning tab mounts at its root with the pushed entries already in `stack` (no slide), `history.state.idx === 0`; Back goes to the root with the pop spring. A cold start older than 30 min on `/today/:date` lands on `/today`; a reload within 30 min keeps the date (`sessionStorage['logbook.stacks']` stores `{ at, tabs }`).

The URL is a mirror, not the source: `date`, `view`, `segment` are React state in the tab, written to the URL with `replaceState` on commit and read once at mount.

### 1.4 Back

Three ways, one `pop()`:

1. The 44 × 44 chevron at the leading edge of the pushed bar (`BackButton`, "Back to Today" / "Back to Journal").
2. The edge swipe (§9.3): a pointer that goes down within 24 px of the pushed layer's left edge and x-locks at 10 px (40° cone). Commits at `x > 0.35 W` or `v > 300 px/s` with `v ≥ 0`; else springs home with the measured velocity.
3. The lit tab re-tapped while a page is pushed (one tap: everything pops).

Inside a pushed page the `DayPager` is not mounted (This morning belongs to the day it was pushed from), so the edge band has no competitor.

### 1.5 Sheets

Presentations over the active tab: the session sheet, the calendar, the To-dos sheet, every editor, the share sheet, the template builder, the routine editor. They do not change the path (an overlay entry only), never change the tab, and only one is up at a time. A sheet has its own inner stack (`sheet.push/pop`, kept). Rules in §9.4.

### 1.6 What is reachable from where (one door each)

| Destination | Doors |
|---|---|
| This morning | the hero's four-stop line (any face that draws it); the `This morning` row under the hero (always) |
| Settings | Today's avatar (only) |
| Plans (block list) | the `Plans ›` row in the Training group of the Settings root (`/settings/plans`, depth 2, a sibling of `/settings/training`; the stack never exceeds two layers) |
| The builder (template sheet, large) | Plan's block card `New block ›`; Today's plan-end card `Next block` (prefilled, over Today, no tab change); Plans page `New block` |
| Routine editor (large sheet) | Settings › Morning routine; This morning's trailing icon |
| Session sheet | hero tap; Plan row tap; the Close card's run row; This morning's run row |
| Today, today | lit tab; the title block; the strip's today cell; the Today pill |
| A far day | hold the title block → `Go to a day…` (the calendar sheet) |

---

## 2. The nav bar and the date strip

Replaces `TabHeader` and `PushedHeader` (`ui/headers.tsx`), `DayStepper` (`ui/DayStepper.tsx`) and `FocusStrip` (`features/day/FocusStrip.tsx`) everywhere. Component: `NavBar` + `DateStrip` + `PushedBar` in `ui/NavBar.tsx`.

### 2.1 Geometry (Today, at rest, native)

```
y 0     safe-t 59      part of the bar's sticky block, --bg
y 59    BAR 44         .nb-bar  position: sticky; top: 0  (height calc(44px + var(--safe-t)), padding-top var(--safe-t))
        ├ leading  : caps line 11/13 600 +0.06em --ink-3   "STEADY · FRI, OCT 23"      opacity calc(1 − var(--hdr))
        ├ centre   : inline title 17/22 600 --ink           "Today"                      opacity var(--hdr)
        └ trailing : fixed 80 px slot, right-aligned, 44×44 hit: Avatar (32) | Today pill | Segmented (Plan) | nothing
y 103   TITLE ROW 44   .nb-title  serif italic 34/40 --display, margin 4px 16px 0; opacity calc(1 − var(--hdr)); scrolls
y 147   STRIP 52       .nb-strip  position: sticky; top: calc(44px + var(--safe-t)); z 19; --bg; Today only
y 199   hairline 1     .nb-strip::after  --line
y 200   gap 16
y 216   first card
```

Pinned chrome once scrolled: `44 + 52 + safe-t` = 155 (96 on the web). Other tabs: bar + title row + 24 gap, no strip; the Plan week line (§7.1) is content. The bar and the strip are `--bg`, opaque, no blur; the bar gains a 1 px `--line` bottom hairline while `--hdr ≥ 0.99` (`.is-collapsed`).

`--hdr` is written by one passive `scroll` listener per tab scroller: `el.style.setProperty('--hdr', String(Math.min(1, Math.max(0, scrollTop / 44))))`. Nothing in the bar animates height or position.

### 2.2 The caps line

`dayCaption(date, today, word)` in `ui/NavBar.tsx`:

| State | Caps |
|---|---|
| Today, no word | `FRI, OCT 23` |
| Today, word | `STEADY · FRI, OCT 23` |
| another day | `SAT, OCT 24` or `STEADY · SAT, OCT 24` (the word is sticky; it shows on every day) |
| Plan week | `THIS WEEK · OCT 19–25` / `NEXT WEEK · OCT 26–NOV 1` / `LAST WEEK · …` / `OCT 12–18` |
| Plan month | `OCTOBER 2026` |
| Progress, Journal | `FRI, OCT 23` |

Never truncates: at 320 wide `STEADY · WED, OCT 29` (20 characters at 11 px ≈ 150 px) fits beside the 80 px slot with 74 px to spare; the editor caps the word at 16 characters (`maxLength={16}`, was 40). Overflow rule if a locale ever exceeds it: the word drops before the weekday.

### 2.3 The title block

The caps line and the large title form one block, `.nb-title-block`, one `Pressable` (hit = the block's box, ≥ 44 tall):

- **Tap** → home: Today → `goTo(today)` (the pager slides); Plan → this week / this month; on today / this week → nothing. The inline title does the same.
- **Hold 450 ms** → menu: Today `Change the word · Clear the word · Go to a day…`; Plan `Go to a week…`. `Go to a day…` opens the calendar sheet (medium); `Change the word` opens the word editor sheet (the existing `FocusStrip` editor body, moved to `features/day/WordSheet.tsx`).

The title is **fixed from the route**, never from data (`dayTitleWord` and `useStepDown` are deleted):

| Page | Title |
|---|---|
| shown = today | `Today` |
| today + 1 / − 1 | `Tomorrow` / `Yesterday` |
| within ± 6 days | `Sat 24`, `Thu 29` |
| further | `Sun, Oct 11`; another year `Sun, Oct 11, 2025` |
| Plan / Progress / Journal | `Plan` / `Progress` / `Journal` |

During a day drag the bar renders three stacked label pairs (prev · cur · next, `position: absolute` in one row) with opacities `|p|` for the one in the drag's direction, `1 − |p|` for the current, 0 for the other, bound to the pager's `x` through `useTransform`. The session name lives once, in the hero.

### 2.4 The trailing slot

`.nb-trail` is 80 px wide, children absolutely positioned and right-aligned, so the caps line's `max-width` never changes (critic §3's reflow cannot recur). Today, shown = today: the `Avatar` (32 disc, 44 hit; the door to Settings). Off today: the **Today pill**, 32 tall, `--accent-tint` fill, `--accent-text` label `Today` 13/600, no chevron glyph (the strip shows the direction), 44 hit via `::after`. The swap is a 120 ms opacity crossfade on the commit frame; no scale. Tap → `goTo(today)`; no haptic. Plan: `Segmented` Week | Month (96 × 32, radius 9, `--surface-3` thumb sliding on `settle`, 13/600 labels; no haptic). Progress: empty. Journal: empty.

### 2.5 The date strip (Today only)

The swipe's affordance and the picker (critic C5/D3). Mon–Sun of the **shown** day's week, 7 cells full-bleed, `cellPitch = W / 7` (55.71 at 390, 45.71 at 320), each 52 tall:

| Part | Spec |
|---|---|
| Weekday letter | 11/13 caps 600 `--ink-3`, top 6; today's letter `--ink` |
| Day number | 15/20 600 tabular, centred in a 28 px disc slot |
| Disc (the shown day) | 28 px circle, `.nb-disc`, one absolutely positioned element translated with `useTransform(x)`: fill `--accent` + white numeral when shown = today; `--surface-3` + white numeral otherwise |
| Today's cell when not shown | numeral `--accent-text`, no disc |
| Status dot | 4 px, 2 px under the number: done/bonus `--accent`; floor `--warn`; planned 1 px ring `--ink-3`; missed/skipped `--ink-4`; rest none. Never red |
| Hit | the whole cell (≥ 44 × 44); VoiceOver: a button `Saturday, October 24, planned run` |

Behaviour:
- Tap a cell → `goTo(date)` (direction-aware slide; the shown cell does nothing; today's cell is a home affordance). No haptic.
- A horizontal drag that starts on the strip is the page gesture (the pager's `attach(stripEl)` binds its handlers there). While the pointer that began in `.nb-strip` is down, `haptics.select()` fires once each time the disc's centre crosses a cell boundary (at most once per page per gesture under M4). A drag that began on the body never ticks.
- During any drag `discX = cellIndex × cellPitch + p × cellPitch` where `p = −x / W`; at the week edge the destination's week crossfades in (120 ms) on the commit frame and the disc lands on its cell. The strip never scrolls weeks on its own.
- The hidden `dpager-sr` Previous/Next buttons and ArrowLeft/ArrowRight stay. The owner is told the strip is the arrows' successor (task #19): the one-time nudge in §3.1.

### 2.6 Pushed pages' bar

`PushedBar`: 44 + `--safe-t`, sticky, `--bg`: chevron 44 × 44 leading (26 px glyph), title 17/22 600 centred, an optional caps eyebrow 11/13 under it in the same 44 (`FRI, OCT 23` on This morning), one trailing 44 × 44 action. No large title on pushed pages. The hairline appears at `--hdr ≥ 0.99` like the root bar.

### 2.7 CSS contract

```css
.tab-scroll { position: absolute; inset: 0; overflow-y: auto; overflow-x: clip; overscroll-behavior-y: contain; -webkit-overflow-scrolling: touch; --hdr: 0; }
.nb-bar   { position: sticky; top: 0; z-index: 20; height: calc(44px + var(--safe-t)); padding: var(--safe-t) 16px 0; display: grid; grid-template-columns: minmax(0,1fr) auto 80px; align-items: center; background: var(--bg); }
.nb-bar.is-collapsed { box-shadow: 0 1px 0 var(--line); }
.nb-cap   { grid-column: 1; opacity: calc(1 - var(--hdr)); font: 600 11px/13px var(--sans); letter-spacing: .06em; color: var(--ink-3); white-space: nowrap; }
.nb-inline{ grid-column: 2; opacity: var(--hdr); font: 600 17px/22px var(--sans); }
.nb-trail { grid-column: 3; position: relative; height: 44px; }
.nb-trail > * { position: absolute; right: 0; top: 0; }
.nb-title { margin: 4px 16px 0; height: 40px; font: italic 400 34px/40px var(--display); letter-spacing: -.01em; opacity: calc(1 - var(--hdr)); }
.nb-strip { position: sticky; top: calc(44px + var(--safe-t)); z-index: 19; display: grid; grid-template-columns: repeat(7, minmax(0,1fr)); height: 52px; background: var(--bg); }
.nb-strip::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: var(--line); }
.nb-cell  { display: grid; justify-items: center; align-content: start; padding-top: 6px; gap: 2px; }
.nb-disc  { position: absolute; top: 21px; left: 0; width: 28px; height: 28px; border-radius: 50%; background: var(--surface-3); will-change: transform; }
.nb-disc.is-today { background: var(--accent); }
.nb-dot   { width: 4px; height: 4px; border-radius: 50%; }
.nb-gap   { height: 16px; }       /* Today; 24px on the other tabs (.nb-gap.lg) */
.pushed-bar { position: sticky; top: 0; z-index: 20; height: calc(44px + var(--safe-t)); padding-top: var(--safe-t); display: grid; grid-template-columns: 44px minmax(0,1fr) 44px; align-items: center; background: var(--bg); }
```

Text in the bar: `user-select: none; -webkit-touch-callout: none` (inherited from `body`, WP5).

---

## 3. Today, by time of day and by day offset

One page per day; the whole page is a `DayPage` inside the `DayPager` (§9.2). Every day renders the same sections in the same order, quiet when there is nothing to say, never absent, so the page never collapses under a swipe. Content column 358, gutter 16. Three containers only: the **card** (radius 20, `--surface`, `--card-border`, padding 16), the **inset group** (radius 12, `--surface`, rows 44 / 60, hairlines inset 16) and the **plain row** (44, inside a group). Type: 34/40 title, 28/34 stamp (`--stamp` 800), 22/28 hero sentence (serif italic), 20/25 section head 600, 17/22 rows, 15/20 subs, 13/18 footnotes, 12/16 orb names, 11/13 caps. Spacing: 12 inside a group, 24 between sections, 16 under the strip; `--sp-primary` 48 is deleted.

### 3.1 Section order (every day)

| # | Section | Height | Tap | Hold 450 | Swipe |
|---|---|---|---|---|---|
| 1 | **Hero** card (halo) | 184 (304 landed) | opens the session sheet (the morning face's stops line pushes This morning) | menu ≤ 4: Done · Skip · Move · Share | the page pages |
| 1b | **Sentence** (only when `focus.quote` is set): one line serif 17/22 `--ink-3`, `“No man is an island.” — John Donne`, 8 under the hero | 22 | the word editor sheet | — | the page pages |
| 2 | **This morning row** (inset group, one 44 row): `☀ This morning` · right `Wake 7:15 · Leave 9:30 ›` 15/20 `--ink-3`; other days `That morning · Left 9:30 ›` / `Tomorrow morning · Alarm 7:15 ›` | 44, 12 above | push `/today/:date/morning` | — | the page pages |
| 3 | **Second session** (two-session days): compact card 60: stamp 17 `STRENGTH`, sub 15 `45 min · Planned`, hold ring 40 right | 60, 12 above | session sheet | Done · Skip · Move | the page pages |
| 4 | **Habits**: head `Habits` 20/25 + meta `2 of 5` 15/20 `--ink-3` (meta only when > 0); orb row 56 px orbs, 12 gap, 12/16 names, horizontal native scroll past 6 (`touch-action: pan-x pan-y`) | 25 + 8 + 72 | orb: toggle (`complete` pop 1.12, `orb` haptic on the fill frame) | orb: Note · Details · Archive; a move after the hold reorders (`select` per slot, `drop`) | the row scrolls itself; it never pages |
| 5 | **To-dos**: head `To-dos` + meta count; inset group: up to 3 open rows (44 one line / 60 two), each `Mark` 22 + text; `+N more ›` row 44 when more; `+ Add a to-do` 44 (`--accent-text`) | 25 + 8 + rows | row text → the to-do sheet; Mark → done (the check fills on `complete`, `toggle` on the tap, row dims, folds after 600 ms on `settle` unless the finger is still on the list, then on the next interaction); Add → inline field | row: Later · Someday · Priority · Delete | the page pages (M9) |
| 6 | **Week card** (card 20/16): `WeekRing` 64 left (the shown day's segment ringed 1.5 px `--ink`; missed = `--ink-4` gap, never red), right `WEEK 43 · 8 of 20 mi · 3 of 4 runs` 13/18 caps over 17/22, one line `Long run Saturday.` 15/20 `--ink-3` | 108, 24 above | the week sheet (Progress's) | — | the page pages |
| 7 | **Plan end** (within 3 days of the block's end or past it): card 20, `Banking Plan ends Sun, Nov 8` 17/600, sub 15, `Next block` 32 accent pill | 96 | `Next block` → the prefilled builder as a large sheet over Today (no tab change) | — | |
| 8 | **Strava primer** (today only, until connected or snoozed): the existing card | 120 | Connect · Later | — | |
| 9 | **The day** (past days only): card: `THE DAY` eyebrow, the entries, `Add to it` 44, `Share the day` 32 | content | — | — | |
| — | bottom padding `calc(24px + var(--tabbar-h) + var(--safe-b) + var(--kb))` | | | | |

Nothing above the bar (`FocusStrip` deleted). No `min-height: 196px` on the hero (`day.css:19`). The corner week ring leaves the hero; the week is the strip and the card. The `.hero-pages` carousel, `.hero-dots` and `disabled={multi}` are deleted; the day pager is the only horizontal gesture on the page.

The one-time nudge: on the first open after the change, a 24 px line under the hero `Your morning lives here now ›` (13/18 `--ink-3`) pointing at the This morning row; dismissed on tap or on the first push of This morning; stored in `localStorage['logbook.nudge.morning']`.

Copy (visual F12): nouns and numbers. `Rest day`, `Easy 4`, `Out the door in 22 min`, `Back by 8:20`, `4 mi. Done.`, `Missed.`, `Close the day`, `Add a to-do`, `2 of 5` only when > 0. Deleted: `Rest. It counts.`, `Rested. It counted.`, `5 to light`, `Add the first one`, the `HOLD` caption, every on-screen gesture instruction, `Saved. It stays until you change it.`

### 3.2 Hero faces (today), 184 tall unless noted

Zones inside the card (padding 16): eyebrow caps 11/13 (13) · stamp 28/34 `--stamp` 800 (34) · line serif italic 22/28 (28) · deck (56); gaps 4 / 4 / 12. 16 + 13 + 4 + 34 + 4 + 28 + 12 + 56 + 16 = 183 → 184. Only the deck's content changes between faces; its box does not, so no phase change moves anything below the card. Faces are `motion.div`s keyed by `ph.phase + session.key` inside `AnimatePresence mode="popLayout"` with a 150 ms crossfade; the landed face alone is 304, reached by the one layout FLIP (§6). Halo classes unchanged (`.halo-*`, 200 ms); `.halo-boost` 600 ms on the day's first completion.

| Phase | Eyebrow | Stamp | Line | Deck (56) |
|---|---|---|---|---|
| **morning** (before the door) | `THIS MORNING` | `EASY 4` | *Out the door in 58 min* (Ticker on the minute; ≥ 60 → `1 h 2 min`) | the **four-stop line** `MiniTimeline`: Wake · Door · Back · Leave, 2 px line, 8 px dots, the now dot (accent, static per minute), labels 11/13 caps, times 13/18 tabular; `data-shared="morning-line-<date>"`; tap → push This morning |
| **out** (door → back) | `OUT` | `EASY 4` | *Back by 8:13* | the out line Door ●──── Back, the dot at `outProgress` (transform); sub 13/18 `Leave 9:30 · in 1 h 40 min` |
| **open** (back → 18:00, not done) | `TODAY'S RUN` | `EASY 4` | *4 mi · floor 20 min* | left: status line 13/18 `--ink-3` `Checking Strava…` while a sync is in flight (else `Leave 9:30 · in 45 min`, after leave `Not logged yet`); right: the **hold ring** 48 (`.hold-ring`, 56 hit, `touch-action: pan-y`) |
| **landed** (304) | `TODAY'S RUN · 8:14 /MI` | `EASY 4` | *5.02 mi at 8:14.* | route 358 × 120 above the deck (drawn once a day, 1.1 s); deck: stamps `DISTANCE · PACE · TIME` (Ticker); the coach's one sentence 15/20 `--ink-2` under them when present; `Share` 32 pill right |
| **done by hand** | `TODAY'S RUN` | `EASY 4` | *4 mi. Done.* (the check in the ring) | `8 of 20 mi this week.` 15/20; `Share` pill; `Ran a different distance?` text verb |
| **rest, before leave** | `REST DAY` | `REST` | *Leave in 1 h 45 min* (before the alarm: *Alarm in 43 min*) | the rest morning's four-stop line (Alarm · Shower · Prep · Leave); sub `Tomorrow: Long 4, out at 5:55.` |
| **rest, after leave** | `REST DAY` | `REST` | *Rest day* | one 44 row `Tomorrow: Long 4 · out 5:55` → that session's sheet |
| **evening** (≥ 18:00, on interaction or 60 s idle) | the Close card, §5 (its own height; it is the one face that is not 184) | | | |
| **first run** (no plan, no runs, no habits) | the Setup face: `SET UP YOUR DAY` / three starter rows inside the deck's column (Add habits · Plan a week · Connect Strava); the payoff of onboarding **is** this face | | | |

Skip from the menu: the face crossfades 150 ms to stamp `EASY 4`, line *Skipped.*, deck unchanged (the morning still ends at Leave). Undo restores with the same crossfade.

### 3.3 Other days (the same sections, quiet)

| Section | Yesterday / past | Tomorrow / future |
|---|---|---|
| Title | `Yesterday`, `Sun, Oct 11` | `Tomorrow`, `Thu 29` |
| Hero | the record: landed face (route) · done-by-hand · `MISSED` (eyebrow `SUN, OCT 11`, stamp `--ink-2`, line *Missed.* `--ink-3`, deck empty; never red) · `REST` | eyebrow `TOMORROW` / `IN 5 DAYS` / `THU, OCT 29`; stamp `THRESHOLD 6` `--ink-2`; line *Out the door 7:30*; deck: that morning's four-stop line |
| This morning row | `That morning · Left 9:30 ›` → read-only schedule | `Tomorrow morning · Alarm 7:15 ›` → editable (the wake override for that day) |
| Habits | as recorded; lit `--accent`, unlit `--surface-3`; tap toggles (yesterday is fixable) | ghost orbs: outline `--ink-4` at 40 %, names, `inert`; meta `5 habits` |
| To-dos | done that day, struck `--ink-3`, plus any open item that was due that day | rows with `todo.due === date`; `Add a to-do` adds one due that day |
| Week card | ring with the day marked | ring with the day marked |
| The day | the card (entries, `Add to it`, Share) | — |
| Plan end | past the end with nothing planned | within 3 days of the end |

A page is never a card over black: `.dp-page { min-height: 100% }` of the scroller, and each day has at least hero + row + habits + to-dos + week.

### 3.4 Two sessions

Stacked: the lead (`heroSession`) is the hero; the second is the 60 px compact card. No inner carousel, ever.

### 3.5 Scroll and height

The three pages sit side by side in one track inside the tab scroller. **The current page is in flow; the neighbours are `position: absolute; top: 0; height: 100%; overflow: hidden`**, so the scroller's `scrollHeight` is the current page's and a taller neighbour never adds blank scroll. On commit the roles swap in the same `flushSync`. The vertical offset is kept across a day change; if the new page is shorter the browser clamps.

---

## 4. This morning (pushed from Today)

`/today/:date/morning`, pushed at depth 1 in Today's stack. `MorningView`'s schedule, hold-to-drag reorder and step sheets survive; its `TabHeader`, `DayStepper`, `DatePager`, `MiniLine`, `.m-pre now-pulse`, `.m-timings` foot link, `.sch-hint`, `.sch-grip`, `enterPull` entrance, `?routine=1` and `DayEditor` go.

### 4.1 Page

| Row | Height | Content |
|---|---|---|
| **PushedBar** | 44 + safe-t | chevron (`Back to Today`); `This morning` 17/22 + eyebrow `FRI, OCT 23` 11/13; trailing `SlidersHorizontal` 44 → the RoutineEditor (large sheet) |
| **Now card** (card 20/16, no halo) | 96 | the four-stop line (the shared element's landing, `data-shared="morning-line-<date>"`, 44) and under it one live line 17/22 600: before the alarm `Alarm in 43 min`; wake → door `Out the door in 22 min`; out `Back by 8:13`; back → leave `Shower now · Leave in 45 min`; after leave `Left 9:30`. Past days: `Woke 7:15 · Left 9:30`. The clock is `useNowMinutes`, shared with the hero |
| gap 24 | | |
| **Schedule** (inset group) | n × 60 | one row type: time column 48 (15/20 600 tabular), icon disc 32 (18 px glyph), name 17/22, sub 15/20 `--ink-3`, **nothing on the right**. Rows in order: Wake (sub `Just today` when overridden) · Easy run (`4 mi · 8:20/mi · back 8:13`; the door and cool-down buffers fold into its sub) · Free (`27 min · routine at 8:40`) · Shower · Get ready · Smoothie · Final prep · **Leave** (the last row, §4.4). The row under way: time `--accent-text`, a 2 px progress line under it (`scaleX`, 1 s linear per minute: the one clock-driven motion kept). Past rows `--ink-3` |
| `+ Add a step` | 44 | plain row, `--accent-text`, plus 22 → StepEditor sheet (auto detent) |
| bottom padding | `calc(24px + var(--tabbar-h) + var(--safe-b))` | |

Taps: Wake → the WakeEditor sheet (the fallback for the drag); Easy run → **the session sheet** (`useOpenSession`); Free → StartEditor; a routine step → StepEditor; Leave → the RoutineEditor with the leave field focused. Hold 450 on a step → lift + menu `Edit · Remove`; a move after the hold reorders (`select` per slot, `drop`, one `saveOrder`). Hold on the run row → `Skip Easy 4 · Make this a rest day · Edit` (3). `LateNote` stays as one 60 row under the run row when `T.late`: `Back 8:28, 12 min past the routine` with chips `Wake 7:05` (writes `{ wake }`), `Run 3 mi` (`upsert({ …session, miles: 3 })`), `Skip the run` (`mark 'skip'`).

### 4.2 The alarm drag

| Property | Value |
|---|---|
| Handle | the Wake row's time stamp, a 48 × 60 button (`.alarm-handle`), `touch-action: none` on it only |
| Lock | 10 px vertical with the 40° cone; a horizontal lock cancels (the edge swipe or nothing). A release before the lock is a tap → the WakeEditor sheet |
| Scale | **14 px per 5-minute step**, drag down = later |
| Per step | `haptics.select()` (`selectionStart` on the lock, `selectionChanged` per step, `selectionEnd` on release; 40 ms throttle); the stamp's digits swap (two stacked labels, 120 ms crossfade); every row below, the Now card and the Leave row recompute on the same frame from `morningOf(sessions, override, settings, { wake })` |
| Visual | the Wake row `--surface-2` and `scale(1.02)` while dragging (160 ms); the rows below move by `layout="position"` on `settle` as their times change (heights do not change) |
| Range | `WAKE_MIN`..`WAKE_MAX` (`features/morning/model.ts`); past it the stamp rubber-bands at 0.25× |
| Release | one write `setDay.mutate({ date, day: { wake } })`; changed stamps flash `--accent-text` → `--ink` over 400 ms; the Wake row's sub reads `Just today`; no toast. `Every morning` is the WakeEditor sheet's second choice (no transient segmented) |
| Keyboard | `aria-valuenow`, ArrowUp/ArrowDown ± 5 min |

### 4.3 One object, one editor

The session is the run. `DayEditor.tsx` is deleted. `MorningDayOverride` keeps only `wake` (`packages/shared/src/types.ts:187`, `schemas.ts`, `morning.ts morningDayFor`, the API's day route in `apps/api/src/routes/core.ts`); existing overrides with `mode/type/miles/minutes` are read as `{ wake }` (a quiet drop; no migration script). `morningOf` reads the session for the workout and the override for the wake, so the hero, Plan, Share and `assess` cannot disagree.

### 4.4 The Leave row

Always visible (decisions §5): the last schedule row is `Leave for work` 17/22 · sub `In 45 min` 15/20 `--ink-3` · stamp `9:30` 22/28 right, `position: sticky; bottom: 0` inside the page scroller, `--surface`, hairline above. When the list is short it sits in its natural place; when long it pins above the tab bar. When late: sub `12 min later than your routine` in `--warn` text, no glow (`m-leave-glow` deleted). A toast on this page sits above the Leave row.

### 4.5 Skip from the schedule

The rows that leave (door, run, cool-down, free) fade 100 ms and the rows below translate up on `settle` (FLIP; no `height` tween); the Leave stamp rolls; toast `Easy 4 skipped · Undo` 6 s.

### 4.6 Past and future mornings

A past morning renders read-only (`--ink-2`, no now card line, `Left 9:30`). A future morning is editable: the drag writes that date's `{ wake }`.

---

## 5. The evening flow

From 18:00 (`EVENING_START`) on today the hero slot becomes the **Close the day** card (M15 governs when it appears). One card, top to bottom:

| Step | Rows (fixed slots; content crossfades 150 ms inside them; only the entries list grows, via FLIP on what follows) |
|---|---|
| 0 | eyebrow `CLOSE THE DAY` 11/13; title serif 22/28 *Two sentences, then sleep.* → *Day, closed.* after the first save (150 ms crossfade) |
| 1 | stamps row 40: up to 3 of `MI 4.0` · `HABITS 2 of 5` · `TO-DOS 1 done` (11 caps over 22 stamp), Ticker once a day (`onceADay: close-<date>`), 60 ms stagger |
| 2 | the run row 60: `EASY 4` 17 · sub `4.0 mi · 8:12 /mi` (or `Floor: 20 min easy` while open) · right: the hold ring 40 while open (hold 400 fills, `success`, the row's sub rewrites, the `MI` stamp appears and ticks) — the text is a button → the session sheet (the run stays openable) |
| 3 | the composer: the **QuoteLine** as its prompt (serif 15/20 `--ink-3`, 44 tall; tap inserts the quote; hold → Favourite · Hide; no swipe); the Journal `Composer` (textarea 60 min-height, grows with text, placeholder `How did today go?`); `Save` 32 accent pill at 40 % until there is text |
| 4 | after Save: the entry replaces the field in the same box (150 ms), `haptics.success()`, `.halo-boost` 600 ms; the Save slot becomes `Add to it` 44 |
| 5 | **Tomorrow** (after the first save) inset group: `A word for tomorrow · Steady ›` 44 (an inline field; writes the sticky `settings.focus.word`; the caps line in the bar updates at once, no toast) · `Alarm 7:15 · change ›` 44 (the WakeEditor for tomorrow, `Just tomorrow` preselected) |
| 6 | `Share the day` 32 pill |
| 7 | Today's read, one 44 row, only when a pick exists |

Below the card: habits (quiet, lit ones `--accent`), to-dos, the week card. The composer has `touch-action: pan-y`; the pager ignores pointers that start in `textarea, input, [data-no-page]`.

### 5.1 Keyboard

`Keyboard.resize = 'none'`; `--kb` is written by `keyboardWillShow/Hide` (native) or `visualViewport` (web, 60 px hysteresis); the page's bottom padding includes `var(--kb)`; on focus the field is scrolled into view (`scrollIntoView({ block: 'center' })`) after the keyboard's 250 ms; the tab bar is `visibility: hidden` while `html.kb-open`. Nothing resizes.

### 5.2 Haptics

One `success` on Save; `toggle` per orb; none on the word, the alarm or opening sheets.

### 5.3 Phase changes

The Close card (and every clock-driven face) appears on the next open or foreground return after 18:00, on the next interaction (which still performs its own action), or after 60 s with no touch, no focus, no sheet or menu. Never under a still finger, never under a moving one.

### 5.4 Midnight

`useToday` keeps polling. The Today tab applies a rollover only when **all** hold: (a) no `textarea`/`input` inside the tab has focus and the shown day's `drafts[date]` is empty; (b) no sheet or menu is open; (c) one of: 60 s without a touch · a tab change away from Today · a cold open · a foreground return. (a) always wins: a foreground return with draft text does not roll. Until it rolls, the whole page, its title (`Today`), its caps line and the strip stay on the held day; the draft persists by date (`JournalDaySection.tsx` `drafts`). When it rolls, the page crossfades 150 ms to the new day. Yesterday's card is one swipe away at any hour.

---

## 6. The run landing

### 6.1 Sequence

| t | What | Numbers |
|---|---|---|
| foreground (`visibilitychange` visible) or cold open, Strava connected | one `POST /strava/sync` through `stravaSyncNow(qc)` (`api/queries.ts`, WP1's block): a mutation under `mutationKey: ['strava-sync']` around WP5's `syncStrava`, at most once per 30 s, the months and activities invalidated only on `changed ≥ 1` (the server joins a sync already running; `653193b`). `main.tsx` calls it on the foreground return (WP5's call, re-routed through the mutation cache so it is observable); the Today tab calls it once on a cold open after the first bootstrap. The status line reads it with `useIsMutating({ mutationKey: ['strava-sync'] })`; `useStravaPull.ts` stays the pull-to-refresh path | |
| +0 | the open face's status line `Checking Strava…` fades in 120 ms; stays ≥ 600 ms; capped at 3 s | |
| answer `changed: 0` and now > the session's back time | one repeat at +8 s, then the line fades out 100 ms; the face stays open | |
| answer `changed ≥ 1` → `syncStrava` invalidates `['month']` and `activities` → the refetch puts the run in the snapshot | **stage 1** 0–300 ms: the ring fills from its current value to full (`stroke-dashoffset`, linear) | |
| +300 | **stage 2** 300–500: the ring's stroke crossfades into the check inside the same circle (two `<path>`s in the same node; opacity swap 200 ms; the check scales 0.8 → 1 on `settle`) | same node: `[data-layout-exception]` is not needed here |
| +500 | **stage 3** 500–850: the card grows 184 → 304 by the one allowed layout FLIP (`layout` on `settle`, tagged `data-layout-exception`); everything below translates down 120 px on the same spring; on rest the layout commits in one frame | |
| +850 (the FLIP's `animationComplete`) | **one** `haptics.success()`; `.halo-boost` 600 ms | the haptic lands when the shape stops changing |
| +850 → | **stage 4**: the route draws (`pathLength` 0 → 1, 1.1 s); the stamps tick on `number` (0.48 s) from the **planned** miles (4 → 5.02), pace from the plan's pace, time from 0; the verdict line crossfades in 150 ms | zero frames with `0 mi` |
| when it arrives | the coach's one sentence fades in 200 ms under the stamps. It is requested server-side at sync time (`apps/api/src/routes/strava.ts` after `syncInBackground` matches a planned run → `coachRead`, stored with the activity); the client never shows a "Reading…" state | |

If the app was in the background when the run arrived, no haptic. Whichever of Strava or the hand completes the day's session fires the one `success`; the other is silent.

### 6.2 By hand (the ring held)

The same sequence from stage 1 without the route: at 400 ms of hold the ring is full, `mark 'done'`, the ring becomes the check (stage 2), the line *4 mi. Done.* ticks from the planned miles, the halo boosts; the face swap is the 150 ms crossfade. Early release reverses the fill on `settle` (kept, `HoldRing.tsx:48`).

### 6.3 The session sheet after a matched run

Second row: `Share` · `Not feeling 100%`; Move and Edit live under the sheet's `⋯`.

---

## 7. Plan: week and month

### 7.1 Bar and header

Bar: caps `THIS WEEK · OCT 19–25`; title `Plan` (tap → this week / this month; hold → `Go to a week…`); trailing `Segmented` Week | Month. Deleted: the `.pl-zoom` text button, the pinch (`PlanView.tsx:96-142`; WP5 scoped its listener, WP4 removes it), the header pull (`Week.tsx:86-167`, `PullHint`), `.pl-plate`.

Week line (content, under the 24 gap): `26 mi · 5 runs` 22/28 600 left (no 650 weight; a 4 px `scaleX` bar appears only once a mile is run), sub 15/20 `Next: Easy 4, today.`; a `This week` pill (32, `--accent-tint`) at the right only off this week (120 ms crossfade on commit).

### 7.2 The week pages on any horizontal swipe

The `DayPager` v2 (`step: 'week'`) wraps the whole week body (week line + 7 rows + block card), full-bleed (`W = scroller width`; the 32 px kick of `plan.css:21-24` vs `DatePager.tsx:67` cannot recur). Rows lose `SwipeRow` and `pl-slot`'s `stopPropagation` (`Week.tsx:252-253`). Row tap → the session sheet; an empty day → add. Hold 450 → lift + menu `Done · Skip · Move · Delete`; a move after the hold drags (`useDayDrag`, hold = `HOLD_MS`): the pill under the finger, the target row lit (2 px accent inset ring + `--accent-tint`), `select` per row crossed; drop → the pill scales into the slot on `settle` (0.30 s) and the displaced row reflows by `layout="position"`, `drop`, toast `Moved to Wed · Undo`; a swap onto an occupied day stays; a conflict → `warning` + the inline `Two hard days in a row. Keep it?` row.

Rows 60 (inset group): weekday + date column 48 (today = 28 px accent disc, white numeral; the radial glow `plan.css:169-178` goes), 3 px tone bar, stamp 17, distance 15 `--ink-3`, status: done = check 14; missed = `Missed` 13/18 `--ink-3` + a 1 px strike on the name; never red. Two sessions: two rows under one day label.

Block card (card 20/16, 128): `WEEK 2 OF 11` · `2026.10 Banking Plan` 22/28 · the arc of bars 24 · `New block ›` 44 row → the builder (large sheet).

### 7.3 Month

Segmented → Month: a 200 ms crossfade of the two panes (both mounted during it), the thumb on `settle`. Grid: 7 columns × up to 6 rows of 56 px cells (day 13/18, miles 11/13, 3 px tone bar), a `Wk` column (planned / run), today's number in the accent disc, the current week's row on `--surface`. Tap a week → Week with that week shown (200 ms crossfade, thumb to Week). Months page with the same pager (`step: 'month'`), 1:1 (the 0.6× follow of `Month.tsx:133` goes).

### 7.4 Next block

Today's plan-end card `Next block` → `sheet.open({ detent: 'large', title: 'Next block', body: <PlanBuilder prefill={fromEndingBlock} /> })` over Today. Prefill: goal, run days, long-run day, weekly miles from the ending block's `trainingProfile`, `startDate = shiftDays(block.end, 1)`; with no block, the onboarding profile. The ghost preview is the sheet's header (sticky under the grabber, 160 tall, fixed height: a goal change crossfades the grid). The verb says what it replaces: `Replace 44 planned sessions from Oct 19`.

---

## 8. Journal, Progress, Settings, Reads, onboarding, toasts

| Page | Change | Why |
|---|---|---|
| Journal | `Segmented` Journal · Library (32) under the title row; two mounted panes, 150 ms crossfade on switch, each keeps its `scrollTop`; `JournalView.tsx:36-39` `window.scrollTo` deleted | critic C13 |
| Journal | the composer: placeholder 17/22 `--ink-3`, Save 32 pill at 40 % until text; the `QuoteLine` inside it (serif 15/20 `--ink-3`; tap inserts; hold → Favourite · Hide; no swipe; `journal/gestures.ts` deleted); growth by FLIP on `settle` | evening #11, visual F19 |
| Journal | the entries list renders from cache; the skeleton gate becomes `!list.data && !navigator.onLine` | newuser 3.5 |
| Journal | Library's empty Favourites = one 60 row `No favourites yet`; favouriting: star pops on `complete`, `toggle` | visual S8 |
| Journal | Reads at `/journal/reads`, pushed over the mounted Journal; rows on `SwipeRow` v2 (72 reveal, 55 % / 600 px/s full) | navlive M1 |
| Progress | builds from the months that are loaded; a missing month is a quiet gap, never the page skeleton (`ProgressView.tsx:169-181`); its 7-month range joins `prefetchAll` | critic C11, shell F11 |
| Progress | verdict 20/25 600 `--sans` (one serif per screen: the title); range chips = `Segmented`; value column `auto` | visual F18 |
| Settings | pushed from Today's avatar only; `You · Training · Habits · Morning routine · Connections · App · Data · Account` as inset groups; each row pushes `/settings/<section>` at depth 2 over the mounted Settings; `Morning routine` opens the RoutineEditor sheet; the Training group's `Plans ›` row (on the Settings root, not inside `/settings/training`) pushes `/settings/plans` at depth 2 (the old `PlansPanel` as a page with `New block` in its bar); no row leaves the stack; the ringed avatar on Settings and the avatar on every other bar are deleted | nav F10/F17, critic D5 |
| Onboarding | `/start` renders without waiting on `/auth/status` (landed in WP5); the payoff screen renders `FirstRunHero` (the same component as Today's first-run face) so `Open Today` is a state change under the mounting shell: the hero moves ≤ 2 px, the week rows fall away (translateY 40 + fade 200 ms), bar/strip/tab bar fade in 200 ms; `Welcome.tsx:427-437`'s leave animation and the route cut go | newuser 1.10 |
| Toasts | only for actions with Undo and for errors; 4 s plain / 6 s with Undo; scoped to the tab that raised them (a tab change dismisses with `fadeOut`); swipe-dismiss at `v > 110 px/s`; placement subscribes to the sheet's `sheetY` (no per-frame `querySelector`, `Toast.tsx:34-59`) | critic C8, newuser 3.3 |

---

## 9. The mechanics, frame by frame

### 9.1 Tab switch (`TabStacks`)

DOM (`app/Shell.tsx`):

```
<div class="shell">                 height: 100%; display: grid; grid-template-rows: minmax(0,1fr) auto; overflow: hidden
  <div class="tabs-host">           position: relative
    <section class="tab" data-tab="today" [inert] [aria-hidden]>   position: absolute; inset: 0; visibility: hidden when inactive
      <div class="tab-scroll">      the scroller; NavBar is sticky inside it; the DayPager is its body
      <div class="stack-host">      position: absolute; inset: 0; overflow: clip; pointer-events: none when empty
        <div class="pushed" …>      one per PushedEntry
    …×4
  <nav class="tabbar">              grid row 2; height: calc(50px + var(--safe-b)); visibility: hidden while html.kb-open
```

Inactive tabs: `visibility: hidden; pointer-events: none` + `inert` (never `display: none`: WebKit drops `scrollTop`).

| Frame | What |
|---|---|
| `pointerdown` on the Plan item | `data-pressed` set synchronously; CSS `transform: scale(0.97); transition: none`; no haptic |
| held | nothing; drag-off > 12 px clears `data-pressed` (160 ms back) |
| `pointerup` | `flushSync(() => activate('plan'))`: Today gets `visibility: hidden` + `inert`, Plan loses them; both opaque; no opacity anywhere; `pushState('/plan/…')`; the lit colour moves (no transition); the icon releases over 160 ms |
| F1 | Plan exactly as it was left: same `scrollTop`, same week, same pushed pages. No `scrollTo`, no re-mount, no fade (`PageFade`, `.page-enter`, `.page-first` deleted) |

Budget: the first visual change within one frame of `pointerdown`; the switch within one frame of `pointerup` at 1×, ≤ 50 ms at 4×.

### 9.2 `DayPager` v2

```ts
export interface DayPagerProps {
  date: string;                                   // the shown page's key (ISO day; Monday for weeks; first-of-month for months)
  step: 'day' | 'week' | 'month';
  onCommit: (date: string) => void;               // once per page change, after the settle
  render: (date: string, live: boolean) => ReactNode;  // prev, cur, next are ALWAYS mounted; live=false for neighbours (inert, aria-hidden)
  handle: DayPagerHandle;                         // from useDayPagerHandle(): x, progress, goTo, attach
  min?: string; max?: string;                     // a drag past them rubber-bands at 0.2×
  ignore?: string;                                // default 'textarea, input, [data-no-page]'
  label?: string; prevLabel?: string; nextLabel?: string;
}
// DOM: <div class="dp" role="group" aria-roledescription="pager" tabIndex=0>
//        <motion.div class="dp-track" style={{ x }}>   touch-action: pan-y; will-change: transform
//          <div class="dp-page" data-role="prev" data-date inert aria-hidden>  position: absolute; left: -100%; top: 0; width: 100%; height: 100%; overflow: hidden
//          <div class="dp-page" data-role="cur"  data-date>                    position: relative (in flow)
//          <div class="dp-page" data-role="next" data-date inert aria-hidden>  position: absolute; left: 100%; …
//        <button class="dpager-sr">Previous day</button><button class="dpager-sr">Next day</button>
```

`W = dp.clientWidth` (measured on mount and `ResizeObserver`, never `innerWidth`); pages are full-bleed (gap 0; the page slides under the screen edge); content carries the 16 px gutter.

| Constant | Value | Why |
|---|---|---|
| lock | 10 px, 40° cone (`|dx| / hypot ≥ 0.766` → x; `|dy| / hypot ≥ 0.766` → y) | WWDC18 hysteresis, Ionic `maxAngle` |
| re-base on lock | `x0 = clientX − x.get()` (and again on every `pointerdown`) | the content never jumps by the lock distance; catch mid-slide |
| clamp | `x ∈ [−W, W]`; past a bound or past `min`/`max`: `dx × 0.2` | one page per gesture (M4) |
| velocity | `v = x.getVelocity()` after the frame's last `x.set` (px/s, clamped ± 4000) | one source |
| projection | `proj = x + v × 0.35` | Ionic 350 ms |
| commit | `|proj| ≥ 0.30 W` **and** `sign(proj) === sign(x)` → the page in x's direction; else 0 | a reverse flick from 38 % goes home, never to the far neighbour |
| release spring | `springs.page` (0.35 s / 0); `springs.pageFlick` (0.35 s / 0.15) when `|v| ≥ 500 px/s` | the one reward for momentum |

| Frame | What |
|---|---|
| `pointerdown` under the bar, not in `ignore` | `controls?.stop()`; `x0 = clientX − x.get()`; record `y0`; nothing visible; neighbours already mounted |
| moves < 10 px | nothing (`touch-action: pan-y` lets WebKit scroll) |
| x-lock | `setPointerCapture`; every `pointermove`: `x.set(clamp(clientX − x0))`; the disc, the stacked titles and caps follow through `useTransform(x)`; no React state changes |
| release | `v`, `target` as above; `controls = animate(x, target × −W, spring)` (or home on `settle` with velocity when target = 0); `onCommit` not yet |
| spring frames | only `transform` on `.dp-track`, `.nb-disc` and the label opacities change; zero React renders (one memoised `useLog` per page, `phaseOf` keyed on `log.snap` + date; critic C12) |
| `animationComplete` at ±W | `flushSync(() => onCommit(targetDate))`: the host sets `date`, prev/cur/next re-render for the new centre, and in the same synchronous commit the pager's layout effect does `x.jump(0)`. Pixels identical before and after. `replaceState('/today/2026-10-24')`. `window.dispatchEvent(new CustomEvent('logbook:page-commit', { detail: { from, to } }))`. No `scrollTo`, no haptic |
| `pointerdown` during the spring | frame 0 again: the slide is caught; the finger owns the track |

**Flick, flick back**: flick left → spring toward −W (uncommitted); a touch 80 ms later stops it at `x = −300`; a right flick of 200 px at 1200 px/s → `x = −100`, `proj = +320`, `sign(proj) ≠ sign(x)` → target 0 → springs home; the labels fade back. `onCommit` count 0; the URL never moved.

**External change** (`handle.goTo(date)`): adjacent → the neighbour slot already holds it; the same release spring from 0. 2–7 days away → the destination renders in the `next`/`prev` slot for the slide, then commits. > 7 days (the calendar) → a 150 ms crossfade of the `cur` slot, no slide. A second `goTo` during a slide retargets the same `controls`. Keyboard arrows step one page per press.

**Reduced motion**: the drag tracks 1:1; release and `goTo` are 150 ms crossfades; the labels swap instantly.

### 9.3 `PushedLayer` (push, pop, edge swipe)

```ts
interface PushedLayerProps { entry: PushedEntry; depth: 1 | 2; children: ReactNode }
// one MotionValue x per layer: 0 = at rest, W = off screen right (W = stack-host clientWidth, read once per gesture)
// bindings (useTransform of x), applied to the layer under (the tab scroller at depth 1, the depth-1 layer at depth 2):
//   parentX = −0.3 × (W − x)           scrimO = 0.12 × (1 − x / W)           shadowO = 0.6 × (1 − x / W)
// CSS: .stack-host { position: absolute; inset: 0; overflow: clip }
//      .pushed { position: absolute; inset: 0; background: var(--bg); overflow-y: auto; overscroll-behavior-y: contain; touch-action: pan-y; will-change: transform }
//      .pushed::before { /* left shadow */ content:''; position:absolute; inset:0 auto 0 -24px; width:24px; background: linear-gradient(to left, rgba(0,0,0,.6), transparent); opacity: var(--shadow-o) }
//      .tab-scrim { position: absolute; inset: 0; background: #000; pointer-events: none; opacity bound to scrimO }   on the parent
```

| Frame | Push |
|---|---|
| `pointerup` on the opener | `flushSync(push(entry))`: the layer mounts at `x = W`; `pushState(entry.path)`; the parent is at 0, fully visible, still scrolled where it was |
| F1… | `animate(x, 0, springs.page)`. Each frame the layer translates `x`; the parent translates to −117 at 390; scrim → 0.12; shadow → 0.6. The tab bar never moves (a grid row outside the stack) |
| rest (350 ms) | the parent gets `inert`; nothing else |
| shared element (This morning) | the hero's `[data-shared="morning-line-<date>"]` is `visibility: hidden` from F1; a fixed flyer copy of the four-stop line travels from its rect to the Now card's rect with progress `1 − x/W` (translate + scale from the two rects); the destination is hidden until rest; on rest the flyer is removed. The interactive pop drives the same progress back. Reduced motion: both simply appear |

| Frame | Pop (chevron / lit tab) |
|---|---|
| `pointerup` | the parent loses `inert` on this frame; `animate(x, W, { ...springs.page, velocity: 0 })`; the parent brightens and returns to 0 under it |
| `animationComplete` | `popStack()` (unmount) then the history rule of §1.3, **in that order, same frame**. No fade on the parent, no scroll restore needed |

| Frame | Edge swipe |
|---|---|
| `pointerdown` on the layer with `clientX ≤ 24` | `controls?.stop()` (a push still in flight is caught: "a push is converted into a pop"); `x0 = clientX − x.get()` |
| < 10 px | nothing; a release here is a tap (the chevron) |
| x-lock (dx > 0) | `setPointerCapture`; each move `x.set(max(0, clientX − x0))`; parent, scrim, shadow and flyer follow |
| release | `v = x.getVelocity()`; commit if `x > 0.35 W` or `v > 300` (and `v ≥ 0`): `animate(x, W, { ...springs.page, velocity: v })` then the pop sequence; else `animate(x, 0, { ...springs.page, velocity: v })` |

Depth 2 (Settings → Training) uses the depth-1 layer as its parent (it moves to −30 %; the tab root stays at −30 % behind it, unseen). Reduced motion: push and pop are 120 ms crossfades; the edge swipe still tracks. On the web in Safari the browser's own left-edge swipe wins; the chevron is the path there (the standalone PWA has no browser swipe).

### 9.4 `Sheet` v3

```ts
interface SheetSpec { title; body; eyebrow?; detent?: 'auto' | 'medium' | 'large'; detents?: Array<'medium' | 'large'>; wide?; sticky?; action? }   // layoutId and shared() are deleted
// sheetY: MotionValue<number>  px from the detent's top; 0 = at the detent, H = off screen. The ONLY owner of the sheet's motion.
//   scrimO  = 0.78 × (1 − sheetY / H)
//   recedeS = 0.92 + 0.08 × (sheetY / H);  recedeY = (safeTop + 10) × (1 − sheetY / H);  recedeR = 12 × (1 − sheetY / H)   → the active tab's <section class="tab">, transform-origin 50% 0
// detents: medium = round(0.5 × scrollerHeight); large = scrollerHeight − (safeTop + 10); auto = content height, ≤ large (the default)
```

Open: the body renders on the opener's `pointerup`; on the next frame `animate(sheetY, 0, { duration: 0.5, ease: [0.32, 0.72, 0, 1] })` from `H`. Scrim and recede ride `sheetY`. First motion frame ≤ 1 frame after `pointerup` at 1×, ≤ 70 ms at 4×.

| Rule | Value |
|---|---|
| where a drag may start | the header (grabber row) anywhere; the body when `scrollTop === 0` and the first locked move is downward; 100 ms lock after the body reaches `scrollTop 0` by scrolling |
| tracking | `pointerdown` stops the running animation (one owner: `controls.stop()`), `y0 = clientY − sheetY.get()`; `sheetY.set(dy)` 1:1, no elastic |
| over-drag up | `sheetY = −8 × ln(1 + (−dy) / 8)` |
| release | `v = sheetY.getVelocity()`; **dismiss** if `v ≥ 400 px/s` or `sheetY ≥ 0.25 × sheetHeight` (`springs.sheetFlick` when `v ≥ 400`, else `springs.sheet`, velocity carried); else snap to the nearest detent of `sheetY + v × 0.35` on `springs.sheet` |
| grabber tap | cycles `detents` |
| second finger | ignored once a drag began |
| focus / keyboard | `first.focus()` and any `autoFocus` run on the open animation's `onComplete`, never on a timer |
| keyboard inset | `.sheet { bottom: var(--kb); transition: bottom 250ms cubic-bezier(.32,.72,0,1) }`; a sheet taller than 80 % of the viewport shrinks instead of lifting |
| Escape / scrim tap / Back | close on the same curve (`sticky` ignores the scrim tap) |
| the tab scroller behind | `inert`, and `overflow: hidden` while the sheet is up (its `scrollTop` is kept); `body.style.overflow` is no longer touched |

Toasts read `sheetY` through `useSheetMotion()` to sit above the sheet. Reduced motion: 150 ms fades; no recede.

### 9.5 Pull to refresh (Today only)

A `touchstart` on Today's scroller at `scrollTop === 0` attaches a non-passive `touchmove` **synchronously inside the `touchstart` handler** and removes it on `touchend`/`touchcancel`. The first move decides: downward and mostly vertical → ours (`preventDefault`); else detach. The 24 px ring translates with `(dy − 6) × 0.8` to a 100 px cap, arms at 64 px (`threshold` once), fires `REFRESH` on release when armed, and ends when the fetch ends (no 500 ms floor, no 260 ms hold); a fetch under 150 ms shows no busy state. Plan and Progress have no pull (their data arrive on the foreground return).

---

## 10. The motion vocabulary

All in `lib/motion.ts`. Conversion (mass 1): `k = (2π / d)²`, `c = 4π (1 − b) / d`. Nothing animates `height`, `width`, `top`, `left`, `padding` or `margin`; the one exception is the hero's landing FLIP, tagged `data-layout-exception`.

| Name | duration · bounce | stiffness · damping · mass | ζ | Used for |
|---|---|---|---|---|
| `springs.page` | 0.35 s · 0 | 322 · 35.9 · 1 | 1.00 | pager release and `goTo`, push, pop, the flyer, sheet push/pop inside a sheet |
| `springs.pageFlick` | 0.35 s · 0.15 | 322 · 30.5 · 1 | 0.85 | a pager or edge-swipe release that ended in a flick (`|v| ≥ 500 px/s`) |
| `springs.settle` | 0.30 s · 0.10 | 439 · 37.7 · 1 | 0.90 | a swipe row springing home, a drop into a slot, siblings reflowing (`layout="position"`), the card's landing FLIP, the segmented thumb, the disc snapping, the ring → check scale |
| `springs.lift` | 0.25 s · 0 | 632 · 50.3 · 1 | 1.00 | the hold lift to 1.03 |
| `springs.sheet` | 0.50 s · 0 | 158 · 25.1 · 1 | 1.00 | detent snaps and spring-backs after a drag |
| `springs.sheetFlick` | 0.50 s · 0.10 | 158 · 22.6 · 1 | 0.90 | a flick dismiss |
| `springs.number` | 0.48 s · 0 | 171 · 26.2 · 1 | 1.00 | Ticker, the week ring fill |
| `springs.complete` | 0.30 s · 0.30 | 439 · 29.3 · 1 | 0.70 | the one overshoot: an orb or check to 1.12 |
| `press` (CSS) | down 0 ms · up 160 ms `cubic-bezier(.23,1,.32,1)` | — | — | `[data-pressed] { transform: scale(.97); transition: none }`; `.pressable { transition: transform 160ms … }` |
| `sheetOpen` (JS) | 500 ms `cubic-bezier(.32,.72,0,1)` on `sheetY` | — | — | sheet open and close by tap / Escape / Back |
| `menu` (CSS) | 140 ms `cubic-bezier(.23,1,.32,1)`, scale .94 → 1 + opacity | — | — | the context menu card; exit 100 ms opacity |
| `fadeIn` / `fadeOut` | 120 / 100 ms `ease` (.22,1,.36,1) | — | — | header words, the inline title, the Today pill, toasts, status line |
| `crossfade` | 150 ms, opacity only | — | — | hero faces, the reduced-motion page change, Close card slots, Journal segments; 200 ms for Week ⇄ Month |
| `colorTween` | 200 ms | — | — | halo state, row surface, the alarm flash (× 2 = 400) |
| `holdFill` | 400 ms linear (`stroke-dashoffset`) | — | — | the hold ring; early release reverses on `settle` |
| `routeDraw` | 1.1 s (.22,1,.36,1), once a day | — | — | kept |
| tab switch | **0 ms** | | | |
| progress line | 1 s linear per minute | | | the lit schedule row |

Deleted: `springs.press`, `pageVariants`, `listVariants`, `itemVariants`, `fadeVariants`, `rowPresence`, `DROP_SPRING`, `spring`, `springSoft`, `tween`, every `transition: transform 100ms` and `:active { transform: scale(…) }` rule, `whileTap` on the hero, `--dur-in` as a page animation.

Thresholds, in `lib/gesture.ts` (velocities in px/s):

| Constant | Value |
|---|---|
| `LOCK_PX` 10 · `CONE_COS` 0.766 · `RUBBER` 0.2 | every recogniser |
| `PROJECT_S` 0.35 · `PAGE_COMMIT_FRAC` 0.30 · `FLICK_V` 500 | pager |
| `EDGE_PX` 24 · `POP_COMMIT_FRAC` 0.35 · `POP_COMMIT_V` 300 | edge pop |
| `SHEET_DISMISS_V` 400 · `SHEET_DISMISS_FRAC` 0.25 · `SHEET_SCROLL_LOCK_MS` 100 | sheet |
| `SWIPE_REVEAL_PX` 72 · `SWIPE_FULL_FRAC` 0.55 · `SWIPE_FULL_V` 600 | swipe rows (sheets, Library, Reads) |
| `HOLD_MS` 450 · `PREHOLD_MS` 300 · `HOLD_SLOP_PX` 8 · `DRAG_START_PX` 8 | hold |
| `FILL_MS` 400 | hold ring |
| `ALARM_PX_PER_STEP` 14 | alarm drag |
| `SELECT_THROTTLE_MS` 40 | selection ticks |
| `IDLE_MS` 60 000 | phase and day deferrals |
| `CHECKING_MIN_MS` 600 · `CHECKING_MAX_MS` 3000 · `STRAVA_RETRY_MS` 8000 | run landing |
| `PTR_ARM_PX` 64 · `PTR_QUIET_MS` 150 | pull to refresh |
| `TOAST_MS` 4000 · `TOAST_UNDO_MS` 6000 · `TOAST_DISMISS_V` 110 | toasts |
| hit sizes | every control ≥ 44 × 44: strip cells W/7 × 52, tab items 97 × 50, chevron 44, Today pill 44 via `::after`, alarm handle 48 × 60, hold ring 48 (56 hit), orbs 56 (64 hit), menu items 44, Add rows 44, title block ≥ 44 |

### 10.1 The FLIP rule

When a box must change size (the landing, Save on the Close card, a to-do inserting or folding, a step leaving), the layout commits once and the motion is transform: measure before/after with `getBoundingClientRect`, apply inverse transforms on the commit frame, release to 0 on `settle`; the revealed region fades in. A folding to-do: content fades 100 ms, the rows below translate up by 44 on `settle`, the row unmounts and the transforms clear on the same frame.

### 10.2 Reduced motion

x/y/z transitions become 150 ms fades; finger tracking stays 1:1; the hold ring's fill loses nothing (it has no bounce); haptics stay.

---

## 11. The press, hold and haptic grammar

### 11.1 Press

`usePress()` (inside `Pressable`, and spread on rows that contain buttons) sets `data-pressed` on `pointerdown` and clears it on `pointerup`, `pointercancel`, or the pointer leaving the element's rect + 12 px (re-armed on return). CSS only: down instant, up 160 ms. One scale, 0.97, for cards, pills, orbs, strip cells, the chevron, the Today pill and tab items; rows show `background: var(--surface-2)` instead; text-only verbs `opacity: .55`. Applied to everything tappable, including the tab bar. The 16 `:active` scale rules in `styles/ui.css` and feature CSS are deleted; `ui/focus.ts:24`'s `touchstart` trick is no longer load-bearing.

### 11.2 Hold

One `useHold(opts)` (`ui/useHold.ts`) replaces `useLongPress`, `useHoldDrag`'s hold half and the ad-hoc timers (`Week.tsx:312-336`, `Schedule.tsx:33`, `TodoList.tsx:21`, `JournalHome.tsx:136`):

| t | What |
|---|---|
| 0 | `data-pressed` |
| 300 ms, no move > 8 px | `data-preholding`: `transform: scale(1.02)` over 150 ms. Visual only; no haptic, no state |
| 450 ms, still no move > 8 px | `haptics.lift()`; the real element lifts to 1.03 on `springs.lift` (`data-lifting`: `position: relative; z-index: 71`; the page root has `isolation: isolate`; no cloned element: `ContextMenu.tsx:56-86` `styledCopy` deleted); the menu appears in 140 ms; the scrim is `rgba(0,0,0,.7)`, opacity only |
| release before 450 | always the tap (`onPress`): a slow tap on an orb lights it |
| move > 8 px before 450 | cancel; the scroll or the pager has it (a slow horizontal swipe on the hero that passes 450 ms before moving 10 px must still page: the hold cancels on the lock, it never swallows the gesture) |
| move > 8 px after 450 | the menu closes (100 ms) and `onDragStart` fires: the lifted object follows the finger 1:1 (orbs, routine steps, Plan sessions). On the hero (nothing to drag) the menu closes and the page pages |
| right-click / Shift+F10 / ContextMenu key | the menu at 0 ms (kept) |

Menus, ≤ 4 items, destructive last and red: hero `Done · Skip · Move · Share`; orb `Note · Details · Archive`; to-do `Later · Someday · Priority · Delete`; Plan row `Done · Skip · Move · Delete`; routine step `Edit · Remove`; run row on This morning `Skip Easy 4 · Make this a rest day · Edit`; title block `Change the word · Clear the word · Go to a day…`; quote line `Favourite · Hide`. The 48 px swipe-down-to-dismiss on the menu layer is deleted; tap outside, Escape or an item closes. The hold ring keeps its own 400 ms fill (a confirm, not a reveal).

### 11.3 Swipe rows (sheets, Library, Reads only)

`SwipeRow` v2: lock 10 px / 40° cone; the pane follows 1:1; a **reveal detent at 72 px** (the action becomes a tappable button; the row stays open until a tap elsewhere or a scroll); **full** at `0.55 W` or `|v| ≥ 600 px/s` (the content slides out with the velocity on `settle`, `onCommit` on `animationComplete`, the row leaves by opacity 100 ms while the rows below FLIP up on `settle`); `haptics.threshold()` once on arming, never on disarming; a side with no action does not move. `TodoList`'s motion-drag rows and `journal/gestures.ts` are deleted.

### 11.4 Haptics (`lib/haptics.ts` kept; the callers change)

| Event | Fires on | Never on |
|---|---|---|
| none | | tab taps, page commits, the Today pill, strip taps, the title block, segmented changes, opening a sheet or a page, calendar picks, PlanEnd, Save of the word, Save of the alarm, Skip |
| `select` (`selectionStart/Changed/End`, 40 ms throttle) | the disc crossing a cell during a drag that began on the strip; each 5-min step of the alarm drag; a reorder crossing a slot; a Plan drag crossing a row; a stepper step; the Progress scrub | a drag that began on the body |
| `orb` / `toggle` (Light) | an orb lighting; a to-do's mark on the tap (in the handler, the frame the fill starts); a favourite | un-completing; disarming |
| `threshold` (Light) | a swipe row arming (once); pull-to-refresh arming | disarming |
| `lift` (Medium) / `drop` (Light) | the 450 ms lift; a drop into a slot | |
| `success` | Close the day Save (once); the run landing's settle frame (once; only if the app is in the foreground) | a to-do, the word, the alarm, "all habits lit" |
| `celebrate` (Heavy + Success) | the week ring closing, ≤ once a week | |
| `delete` (Medium) | a destructive commit with Undo | |
| `warning` / `error` | a plan conflict on drop / a sync failure | |

Every haptic still dispatches `logbook:haptic` for tests. Haptics stay on under reduced motion.

### 11.5 Frequency budget

| Action | Per day | Motion allowed |
|---|---|---|
| tab tap | 20–40 | press only, 0 ms cut |
| day step | 5–10 | the page slide (the gesture's own motion), labels fading with it |
| orb tap | 5 | press + one `complete` pop + fill (~300 ms) |
| to-do done | 3–6 | the check draws; the row folds once, after 600 ms |
| open a sheet | 3–5 | the sheet curve; the recede rides it; nothing else |
| hold | 1–3 | pre-grow, lift, menu 140 ms |
| the run lands | 1 | the staged sequence, ~1.95 s with the route, once |
| close the day | 1 | title crossfade, stamps tick, `success` |
| week ring closes | 1 / week | `celebrate` + the ring's fill |
| first run / plan end | rare | a durable card in Progress; no confetti |

---

## 12. The shell and cold start

Most of this landed in WP5, merged into the base branch `claude/hopeful-einstein-eunarl` at `653193b` (`REVIEW.md`, `scratchpad/feel/wp5-review.md`); every package builds on that commit and none undoes it: compressed assets, preloaded fonts with `font-display: block` on native and metric-matched fallbacks on the web, the service worker after the first screen, `LogbookViewController: CAPBridgeViewController` with `bounces = true`, `alwaysBounceVertical = true`, `contentInsetAdjustmentBehavior = .never`, `allowsLinkPreview = false`, `html { overscroll-behavior-y: contain }`, `body { touch-action: manipulation; -webkit-touch-callout: none; user-select: none }` with text re-enabled in fields and entries, a black launch storyboard, one request on a foreground return (`serverTime` out of the cached object, `prefetchAll` once per session, `refetchOnWindowFocus: false`, no blind invalidation), Today painted from the cache before any network with `DayView` in the entry bundle, opaque tab bar / pushed header / menu scrim, the auth keyboard fixes, the Plan pinch's listener scoped to a two-finger touch, and a foreground `POST /strava/sync` from `main.tsx` (`syncStrava` / `useStravaCheck` with `mutationKey: ['strava-sync']` in `api/queries.ts`; the server joins a sync already running).

What this spec adds, and who builds it (WP1 unless stated):

| Item | Spec |
|---|---|
| Per-tab scrollers | §9.1: `.tab-scroll` per tab with `overscroll-behavior-y: contain`; the document never scrolls (`html, body, #root, .shell { height: 100%; overflow: hidden }`); no `100dvh` anywhere (`shell.css`, `.page-first`) |
| Keyboard | `capacitor.config.ts` `Keyboard: { resize: 'none' }` (WP5 left it at `native` for WP1); `lib/keyboard.ts` writes `--kb` on `:root` and toggles `html.kb-open` from `keyboardWillShow/Hide` (native) or `visualViewport` (web, 60 px hysteresis); consumers: sheets (`bottom`), page bottom padding, the tab bar (hidden). Inputs `font-size: max(16px, 1em)` so Safari never zooms; `enterKeyHint="done"` on quick-add. Device-tested on day one before `resize: 'native'` is removed |
| Splash | `SplashScreen.hide({ fadeOutDuration: 200 })` from the first paint of a `DayPage` with content (rAF after mount), 900 ms cap when only the first-run face is up, 1500 ms hard cap in `try/finally` |
| Pull to refresh | §9.5, Today only, gesture-scoped |
| Listeners | no `touchmove` listener on `document` at any time: the pager, the edge pop, the sheet drag, the alarm handle and the swipe rows use pointer events on their own elements with `touch-action`; `useHoldDrag`'s element-scoped non-passive `touchmove` attaches only while a drag is armed |
| Prefetch range | Progress's 7-month range joins `prefetchAll` (critic C11; WP1 in `api/queries.ts`) |
| Fonts preloaded | `document.fonts.check('italic 34px "Instrument Serif"')` true at the first content frame (WP5) |
| Return to foreground | one request (WP5); with Strava connected, `POST /strava/sync` (WP5's call in `main.tsx`, routed through `stravaSyncNow` by WP1 so the status line can see it; WP2 draws the line and the landing, §6) |

CSS shell (final):

```css
html, body, #root, .shell { height: 100%; }
body { margin: 0; background: var(--bg); overflow: hidden; touch-action: manipulation; -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }
textarea, input, [contenteditable='true'], .jentry-body, .esheet-text, .dsheet-text, .quote-text, .reads-body { -webkit-user-select: text; user-select: text; }
.shell { display: grid; grid-template-rows: minmax(0, 1fr) auto; }
.tab-scroll { overflow-y: auto; overscroll-behavior-y: contain; }
.tabbar { height: calc(50px + var(--safe-b)); background: var(--surface); border-top: 1px solid var(--line-strong); }
html.kb-open .tabbar { visibility: hidden; }
```

---

## 13. What is deleted, and what is kept

### 13.1 Deleted (file:line as read on 2026-10-23)

| Deleted | Where | Closes |
|---|---|---|
| The Morning tab, `/morning/*`, `TAB_SECTIONS.morning`; `MorningView`'s `TabHeader`, `DayStepper`, `DatePager`, `MiniLine`, `.m-pre now-pulse`, `.m-timings`, `?routine=1`, `enterPull` | `ui/nav.ts:18,29`, `App.tsx:121`, `MorningView.tsx:90-97,139-141,218-250`, `mini.css:121` | nav F1/F11/F12, visual F21, perf #13, motion #16 |
| `PageFade`, `.page-enter`, `.page-first`, `page-in`, `Quiet`, `Boot`, `window.scrollTo` on path change | `App.tsx` (`PageFade`, `Quiet`, the `scrollTo` effect), `shell.css:10-38` | motion #2/#3, nav F6/F8, shell F2/F3 |
| `TabHeader`, `PushedHeader`, `useStepDown`, `useStepSwipe`, `DayStepper` (arrows, chip, hold-repeat), `dayTitleWord` in the header | `ui/headers.tsx`, `ui/DayStepper.tsx`, `DayView.tsx:73-78` | nav F3/F4, touch F16, motion #13, critic C5/C6 |
| `FocusStrip` above the header (the editor body moves to `WordSheet.tsx`) | `DayView.tsx:71`, `day.css:776-825` | nav F16, visual F4, flows 2.5 |
| `usePullToMorning` | `Hero.tsx:474-525,605` | nav F11, touch F11 |
| `disabled={multi}`, `.hero-pages`, `.hero-dots`, the inner carousel | `DayView.tsx:64,85`, `Hero.tsx:687-725`, `day.css:426-471` | nav F13, touch F12 |
| `HeroWeekRing`, the `HOLD` caption, the 64 px ring (→ 48), `min-height: 196px` | `Hero.tsx:90-95,639,444-449`, `day.css:19,33-44,251-320` | visual F5/F13/F14, critic C7 |
| `DatePager` v1's `warm`/`cool`, `x.jump` on date change, the commit haptic, the hand-rolled velocity | `ui/DatePager.tsx:50-57,63-80,84,113-124` | touch F2, motion #4, critic C2 |
| `PushedPage` v1 (document listeners, `innerWidth` reads, `.then(go)`) | `ui/PushedPage.tsx` | shell F9, navlive M1-M3 |
| `Sheet` v2's `drag="y"` + `dragElastic`, the scrim timer, the 30 ms focus timer, the title flyer, `layoutId`/`shared()` | `ui/Sheet.tsx:84-181,187-191,256-261,375-379` | motion #6, touch F14, critic C14, perf §4a |
| `styledCopy`, the swipe-down dismiss | `ui/ContextMenu.tsx:56-86,227-244` | touch F6/F18, motion #14, perf #4 |
| The five hold clocks; `useHoldDrag`'s 300 ms; `Schedule.tsx` 380; the grip column; `RestLine`'s timer | `useDrag.ts:14`, `Schedule.tsx:33,230-251`, `TodoList.tsx:21`, `JournalHome.tsx:136`, `Week.tsx:312-336` | touch F7/F13 |
| `TodoList`'s motion-drag rows and timer chain; `rowPresence`; `TodayTodos` `FOLD_MS 700` (→ 600 on `settle`); `SwipeRow` on Today's to-dos | `TodoList.tsx:109-173`, `motion.ts:81-85`, `TodayTodos.tsx:16,77-89` | touch F8, motion #12, decisions §2 |
| `SwipeRow` on Plan rows, `pl-slot` `stopPropagation`, `useSwipeKeepsName` | `Week.tsx:200-219,252-253` | nav F14, evening #2 |
| The pinch, the header pull, `PullHint`, `.pl-plate`, `.pl-zoom`, the TODAY glow, red MISSED, the 0.6× month follow | `PlanView.tsx:28,96-142,155-163`, `Week.tsx:86-167`, `plan.css:169-178,331-341`, `Month.tsx:133` | nav F15, critic C10, visual F16 |
| `/plan/plans` as a URL-rewriting sheet; `PlanEnd → /plan/plans`; `openPlans` from Today | `PlanView.tsx:71-77`, `PlanEnd.tsx:40`, `Blocks.tsx:111` | flows 6.1, nav F12 |
| `DayEditor.tsx`; `mode/type/miles/minutes` on the override; `LateNote`'s override writes | `features/morning/DayEditor.tsx`, `MorningView.tsx:27-57,161-164`, `packages/shared/src/types.ts:187-193`, `schemas.ts`, `morning.ts:160-172` | flows 2.3, decisions §5 |
| `springs.press`, `complete` at bounce 0.55, every CSS `:active` scale, `whileTap`, `DROP_SPRING`, the variants | `motion.ts`, `ui.css:382,456,591,1175`, `Hero.tsx:680`, `useDrag.ts:18` | motion #7, touch F9 |
| `haptics.select()` on tabs, pager commits, segmented, date line, calendar, PlanEnd; `threshold` on disarm; `success` for all habits lit | `Shell.tsx:193`, `DatePager.tsx:84`, `primitives.tsx:247`, `Calendar.tsx:250`, `PlanEnd.tsx:39`, `headers.tsx:49`, `OrbRow.tsx` | touch F10, critic D6 |
| The 500 ms refresh floor, the 260 ms hold, PTR on Plan and Progress, the document-level PTR listeners | `Shell.tsx:43-51,146-163` | critic C9 |
| `Toast`'s per-frame `querySelector`; toasts for plain saves | `Toast.tsx:34-59`, `FocusStrip.tsx:24`, `StepSheets.tsx:222` | critic C8, newuser 2.2 |
| `window.scrollTo` on the Journal segment switch; `journal/gestures.ts` | `JournalView.tsx:36-39` | critic C13 |
| `/welcome/strava` screen (the card stays); the route cut on `Open Today` | `Welcome.tsx:302-307,427-437` | flows 1.5, newuser 1.10 |
| `100dvh` sizing; `Keyboard.resize: 'native'`; `ios.scrollEnabled` left as is | `shell.css`, `capacitor.config.ts:21` | shell F7 |
| Copy: `Rest. It counts.`, `5 to light`, `Add the first one`, every gesture instruction, `Saved. It stays until you change it.`, `Alarm 7:30 on today` | `Hero.tsx:421,430`, `OrbRow.tsx`, `TodayTodos.tsx:104`, `Schedule.tsx:458`, `JournalHome.tsx:122` | visual F12 |

### 13.2 Kept (and why; do not "improve" these)

| Kept | Why |
|---|---|
| The orb tick (fill ~110 ms, pop to 1.12 on `complete`, check draw, label to white) | the one Things-grade moment; the completion grammar everywhere |
| `HoldRing`'s 400 ms linear fill with the early-release reverse | a confirm with visible progress |
| The session sheet's content (Plan / Floor / Out at / Back, the big Done) | right |
| The calendar sheet (behind the title's hold) | a jump for far dates |
| The word-and-sentence editor (as `WordSheet`) | the best sheet in the app |
| Morning's schedule rows, hold-to-drag reorder (lift at 10 ms after the hold, 1 px lag), the step editors | right |
| The route draw once a day, Tickers, `useFirstToday` | the daily celebration |
| The edge swipe's velocity carry | the template for every hand-off |
| 10 px direction locks, swallowed clicks after holds and swipes, `inert` overlays, focus return | right |
| `lib/haptics.ts` and `logbook:haptic` | the callers were wrong, not the file |
| The template builder's live ghost preview and honest destructive verb | strong |
| Plan's drag-to-move with the swap rule and inline conflict; the Move sheet; the future-week copy | right |
| `Day, closed.`; the Share the day card | the link between Today and Journal |
| Reduced motion as a design (fades for x/y/z, tracking kept, haptics kept) | HIG |
| `dpager-sr` buttons; 44 px hit areas; the outbox, idempotency keys, persisted cache | right |

---

## 14. Definition of done (Playwright at 390 × 844, `isMobile`, `hasTouch`, CDP touch; 1× and 4× CPU; real clock unless stated; `?at=` fakes the time of day)

Harness: the rAF recorder of computed transforms from `scratchpad/feel/perf/lib.mjs` and `feel/nav/lib.mjs`; screencast frames for black-frame checks ("black" = ≥ 90 % of pixels below the status bar are `#000`); window events `logbook:haptic`, `logbook:page-commit`, `logbook:nav`.

### 14.1 Shell and tabs
1. `touchstart` on the Plan item → its `[data-pressed]` is set in the next sampled frame (≤ 17 ms at 1×, ≤ 34 at 4×); computed `transform` is `matrix(0.97, …)`.
2. Today → Plan: first visual change ≤ 17 ms after `touchend` at 1×, ≤ 50 at 4×; no element in Plan has `opacity < 1`; zero black frames in the 600 ms after.
3. Zero black frames across push, pop, tab switch, day swipe, sheet open/close and the onboarding hand-off.
4. Plan → next week → scroll 300 → Today → Plan: `pathname` = next week, Plan's `.tab-scroll.scrollTop` = 300 ± 1. Journal scrolled 600 → Today → Journal: 600 ± 1. Journal → Reads → Today → Journal: Reads still on top.
5. On `/today/2026-10-11` scrolled 400, one lit-tab tap → `pathname === '/today'`, the pager's `x` passes through ≥ 6 sampled frames and rests at 0 within 450 ms; a second tap scrolls to 0. On `/today/:date/morning` one tap → `/today/:date` with the pop spring.
6. `document.documentElement.scrollWidth === 390` and `innerWidth === 390` at every sampled frame of a push and an edge swipe; `document.scrollingElement.scrollHeight === innerHeight` at all times.
7. `getEventListeners(document).touchmove` is empty at rest on every tab and pushed page, and during a day swipe, a push and a sheet drag.
8. Focusing the quick-add field changes no element's rect above the field except the tab bar (`visibility: hidden`) and the page's bottom padding; `documentElement.clientHeight` is unchanged.
9. Today → Settings → Plan → Today → chevron on Settings: `pathname === '/today'` on the pop's rest frame, `history.length` unchanged by the pop (the `replaceState` branch); Android/browser Back then lands on `/plan` with Plan shown.

### 14.2 Pager
10. A 270 px left swipe on the hero, the orbs' section head, the to-do group (y 650), the week card and the strip each commits to `/today/<tomorrow>` by `replaceState` (`history.length` unchanged); finger lag median 0 px, max ≤ 1 px during the drag. A swipe on the orb row scrolls the orbs and does not change the date.
11. During the drag at `x = −195`: the disc's `translateX` = `cellX + 27.86 ± 1`, the `Today` label's opacity = 0.5 ± 0.05, `Tomorrow`'s = 0.5 ± 0.05.
12. After a flick ≥ 1500 px/s the track's per-frame displacement never drops below 60 % of the previous frame's in the 100 ms after release; rest within 450 ms.
13. **Catch mid-slide**: swipe to tomorrow; 100 ms later touch at (200, 400) and move 120 px right over 250 ms: the track's `translateX` on the frame after `touchstart` is within 1 px of the previous frame; at `touchend` it is within 2 px of `x_at_touch + 120`; release springs to today; `logbook:page-commit` count 0.
14. **Flick, flick back**: left flick 1500 px/s (80 ms), 80 ms later right flick 1200 px/s: final `pathname === '/today'`, title `Today`, commit count 0.
15. **Clamp**: a 450 px drag in 400 ms moves the track at most W + 12 px (0.2 × 60) and commits exactly one page.
16. Zero React commits while the track moves: `.dp-page[data-role=cur]`'s `data-date` is unchanged until the frame `x` rests; on that frame `data-date`, the URL, the disc and the resting labels change together; the hero's rect before and after the re-base frame differs ≤ 0.5 px.
17. At rest `.dp-page[data-role=prev]` and `[data-role=next]` exist with `textContent.length > 20` and are `inert`; the scroller's `scrollHeight` equals the cur page's `offsetHeight` + chrome (a taller neighbour adds nothing).
18. Scrolled 220, swipe to tomorrow: `.tab-scroll.scrollTop` unchanged on the commit frame (or clamped only if the new page is shorter).
19. A drag that begins on the strip and commits one page fires exactly 1 `select`; the same drag from the hero fires 0. Ten day steps add 0 history entries.
20. Tap the pill from `/today/<+5>`: one slide (the track travels exactly W), `/today`, the avatar is back within 150 ms of rest. A calendar pick 12 days away: no transform animation on the track; a 150 ms opacity change on the cur slot.
21. Reduced motion: the drag tracks 1:1; the release is a 150 ms opacity change with no transform animation.

### 14.3 Push, pop, sheets
22. Tap the stops line: `.pushed` exists with `translateX < 390` within 16 ms of `touchend`; on every frame the Today scroller's `translateX = −0.3 × (390 − x) ± 2` and the scrim's opacity `= 0.12 × (1 − x / 390) ± 0.02`; `.tabbar.getBoundingClientRect().top === 794` on every frame; the parent's `visibility` is `visible` throughout.
23. Edge swipe on Settings from x 12 to 180: on the first locked frame Today is visible under the moving page at `translateX ≈ −63 ± 2`; no frame is black; release at v 0 with `x < 0.35 W` → springs back; at ≥ 300 px/s → the layer unmounts on the frame `x ≥ 389` and `pathname` changes on that same frame.
24. Tap the avatar, then an edge touch 120 ms later: the push spring stops within 1 frame and `x` follows the finger.
25. Settings → Training → Plans: `matchRoute().tab === 'today'` throughout; `pathname === '/settings/plans'`; the tab bar's lit item never changes.
26. The flyer: on the push's first frame the hero's `[data-shared]` has `visibility: hidden` and one `.flyer` exists; on the rest frame the Now card's line is visible and no `.flyer` exists; the flyer's rect at p = 0.5 is the midpoint of the two rects ± 4 px.
27. Hero tap (session day): `.sheet`'s `transform` changes in the first frame after `touchend` (≤ 17 ms at 1×, ≤ 70 at 4×); on every frame the scrim's opacity `= 0.78 × (1 − sheetY / H) ± 0.02` and the active `.tab`'s scale `= 0.92 + 0.08 × sheetY / H ± 0.01`; at rest the scale is 0.92 ± 0.005.
28. A 120 px downward drag on the sheet body at `scrollTop === 0` moves the sheet 120 ± 1 (1:1); release at 500 px/s dismisses; the same drag at `scrollTop 40` scrolls the body and the sheet does not move; a `pointerdown` during the rise stops it within 1 frame.
29. `document.activeElement` is the opener until the open animation finishes; it is the first field within 1 frame after.
30. With a sheet open, browser Back closes the sheet and the page under it is unchanged (`pathname`, stack).

### 14.4 Press, hold, haptics
31. `[data-pressed]` on an orb, a to-do row, a tab item, the hero, a strip cell, a schedule row, the chevron and the Today pill within 16 ms of `touchstart`; cleared within 16 ms of `touchend`; the pressed scale is 0.97 everywhere a scale applies.
32. A 380 ms press on an unlit orb lights it (`aria-pressed` flips, 1 `orb`, 0 menus); a 470 ms unmoved press opens the menu with exactly 1 `lift` and does not light it; at 440 ms no menu, at 460 the menu is in the DOM, opacity ≥ 0.9 by 600; moving 10 px after 470 closes the menu within 100 ms and sets the orb's `data-dragging`; a 300 ms press that moves 12 px does neither.
33. A hold on the hero that reaches 450 ms and then moves 10 px horizontally: the menu closes and the page pages.
34. Every menu ≤ 4 items at every phase; the scrim has no `backdrop-filter`; no `.cm-lift` clone exists.
35. `logbook:haptic` count over a scripted tour (4 tab taps, 3 day swipes from the body, 2 strip taps, the pill, 2 segmented changes, 3 sheet opens, a calendar pick) = 0; over an orb, a to-do mark, a hold, a drop and Close-the-day Save = exactly 5 (`orb`, `toggle`, `lift`, `drop`, `success`).
36. `document.getAnimations()` during a day swipe, a push, a sheet open and a tab tap contains no animation whose keyframes touch `height`, `width`, `top`, `left`, `padding` or `margin`; the hero landing's FLIP is the one exception (`[data-layout-exception]`).

### 14.5 Today
37. At `?at=06:30`, `12:30`, `20:30` on `/today`, `/today/<−1>`, `/today/<+1>`, `/today/<+5>`: the DOM has, in order, `.hero`, `.morning-row`, `.habits`, `.todos`, `.week-card`; the last section's bottom is ≤ 24 px above the tab bar when `scrollHeight > innerHeight`; ≥ 60 % of the viewport below the header is non-black on every page.
38. The hero's height is 184 ± 1 on every face but the landed face (304 ± 1) and the Close card; the pinned chrome (bar + strip) is `96 + safe-t` tall at any scroll offset; after a 60 px scroll `.nb-title` is behind the bar, the inline title's opacity is 1 and the strip's top equals the bar's bottom.
39. `.nb-cap.scrollWidth ≤ clientWidth` at 390 and 320 on today, `/today/<+10>` and with a 16-character word; the trailing slot is 80 px wide before and after the avatar ↔ pill swap and the caps line's width does not change.
40. Cold open of `/today` with an empty months cache: the title is `Today` in the first frame and every later frame (never `Easy`); the day page's skeleton is inside the hero slot.
41. Set the word to `Patient` from the Close card: the caps line reads `PATIENT · FRI, OCT 23` within 150 ms, no toast; after a reload it still does; on `/today/<+1>` it reads `PATIENT · SAT, OCT 24`.
42. **Midnight**: `?at=23:58` with text in the composer; advance 3 min: the textarea exists with its text, the title reads `Today`, the caps line `FRI, OCT 23`, the disc on Friday; hide → show: unchanged; save, then 60 s idle: the page crossfades to Saturday and `/today/<yesterday>` shows the entry in "The day".
43. At `?at=17:59` idle; advance to 18:01 and wait 60 s with no touch: the Close card appears with a 150 ms crossfade; at 18:01 with a touch at 18:00:30 the card appears on that touch and the touch's own action (an orb) also fires.
44. To-do: tap the mark → the check fills on the tap frame with 1 `toggle`; the row's rect is unchanged for 600 ms; then the rows below translate up by 44 on a spring and the row is gone; no element animates `height`. A to-do row has no `.swipe-row` ancestor on `/today`; the To-dos sheet's rows do.
45. **Run landing**: `/strava/sync` mocked to answer `{ changed: 1 }` after 800 ms and the month then containing a run: `Checking Strava…` is visible ≤ 150 ms after visible and for ≥ 600 ms; the ring's `stroke-dashoffset` reaches 0 at +300 ± 50; the check is at scale 1 at +500 ± 50; the ring and the check are the same DOM node; the hero's height is 304 at +850 ± 60 with every intermediate frame showing the content below translated (no layout jump before rest); exactly one `success` within 1 frame of the FLIP's completion; the route's `pathLength` is 1 at +1950 ± 100; zero frames contain `0 mi`.
46. Hold the ring 400 ms: `mark 'done'` is sent; the same node shows the check; the DISTANCE Ticker starts at the planned miles; 1 `success`.

### 14.6 This morning, Plan, Journal, Progress, Settings, cold start
47. On This morning at 06:30, 07:50 and 08:45 the Leave row's bottom ≤ the tab bar's top without scrolling; the page has exactly one four-stop line; a 42 px downward drag on the Wake stamp changes the wake by 15 min with 3 `select` events, every row's time updating on the same frames (≤ 1 frame apart); one `PUT` on release whose body is `{ wake }` only.
48. Tap the Easy run row: the session sheet opens; set miles 3: the request is a session `upsert`; back on Today the hero reads `EASY 3` within one refetch; `morningDays` is unchanged.
49. Plan: a 270 px swipe starting on Tuesday's row lands on next week and opens no sheet; the track's position on the first frame after release equals the finger's last position ± 1 (no kick); hold a row 450 then move 100 px: the menu is gone within 100 ms, `.drag-pill` follows with lag ≤ 2 px; release on another row: the pill's rect shrinks into the slot over ≥ 6 frames; the toast carries Undo; `pathname` has no `/plan/plans`.
50. Journal: switch to Library at `scrollTop 300` and back: Journal's `scrollTop` is 300 ± 1; both panes are in the DOM during the 150 ms crossfade.
51. Progress with one month of its range evicted from the cache: no `.skel` covers the page; the chart renders with a gap.
52. Warm open at 4× / Slow 4G: the number of distinct layouts before Today is 1 (black) + 1 (Today); no `.skel` with today's month cached; the hero's text is painted before the first `/api/*` request (WP5); `document.fonts.check('italic 34px "Instrument Serif"')` is true on the first content frame; the splash hides within 1 frame of the hero's first paint (native: `SplashScreen.hide` called once).
53. Foreground return after 32 s hidden: ≤ 2 requests in 10 s (WP5's one, plus `/strava/sync` when connected).
54. First run: from `Open Today` to Today the hero's rect moves ≤ 2 px; zero black frames.
55. 320 wide: `document.scrollWidth === 320` on every root and pushed page; strip cells 45.7 wide; the caps line fits.
56. Reduced motion parity: every test in 14.2–14.5 passes with transforms replaced by opacity (no transform animation of duration > 0 on page, push, pop or sheet).

---

## 15. Risks

1. **Three mounted day pages per tab, four mounted tabs.** Mitigation: one memoised `useLog` per page, `phaseOf` keyed on `log.snap` + date, neighbours `inert` with `content-visibility: auto` tried under measurement; the acceptance is the 4× swipe with no frame gap > 34 ms. If Plan's three weeks are too heavy, Plan's neighbours mount on `pointerdown` as the fallback that keeps the first frame.
2. **The re-base frame.** `x.jump(0)` and the three-page React commit must land in one frame (test 16). `flushSync` inside `animationComplete`; if WKWebView shows a flash, commit one frame before rest at `|x − dest| < 2`.
3. **Sticky inside a transformed track.** The bar, title and strip are siblings above the pager in the scroller, never inside the track; the pager must never become their ancestor.
4. **The edge band and the day pager.** On a root page the left 24 px pages the day; on a pushed page it pops. On the web in a Safari tab the browser's swipe wins; the chevron is the path.
5. **Negative `scrollTop` on inner scrollers in WKWebView is unverified.** PTR therefore uses the gesture-scoped listener (M24); the native-bounce reading is an upgrade only after a device check.
6. **`--kb` has two code paths** (native `keyboardWillShow`, web `visualViewport`). Device-test on day one before `resize: 'native'` is removed; every field must be reachable above `--kb`.
7. **The landing FLIP** scales children for a frame if misconfigured; `layout="position"` on text, `layout` (size) only on the card and the route slot. Test 45 at 4×. Fallback: a reserved 120 px route slot in the open face.
8. **One editor changes the plan**: a 3-mile Easy set from This morning shows 3 in Plan for that day. Settled (decisions §5); `Back to the plan` must restore the planned miles (store `plannedMiles` on the session on first edit).
9. **The 450 ms single hold** makes routine reorder slower than the old 0 ms grip; the 300 ms pre-grow is the feedback. The only knob is `HOLD_MS`, never a second clock.
10. **Deferred rollover** can show Friday's Close card at 00:40 on a quiet screen if the user typed and walked away; it corrects on the next idle minute after a save, or the next foreground with the composer empty.
11. **The coach read at sync time** adds a Claude call per matched run on the server; the hero shows nothing until it arrives.
12. **The owner asked for the arrows** (task #19). The strip is their successor; the nudge exists; tell him.
13. **`history` as a mirror.** The `popstate`-as-request rule means a stale URL can briefly show in the address bar on the web before `replaceState`; acceptable, never visible in the native shell.
14. **Playwright's CDP touch at ~27 Hz** cannot assert 60 Hz tracking; tracking tests compare per frame against the last dispatched point; the dead-stop test uses relative displacement.
15. **WP5's files overlap WP1's** (`App.tsx`, `main.tsx`, `shell.css`, `base.css`, `foundation.css`, `tokens.css`, `capacitor.config.ts`, `queries.ts`, `PlanView.tsx`). WP5 is merged (`653193b`); every other package branches from that commit and must not undo it (`scratchpad/feel/build-plan.md` §0).

# Logbook foundation: the page teams' manual

Everything a page builds on: navigation, the bar and the pager, primitives, motion, haptics, type and rhythm. **As of the feel
overhaul (spec `docs/feel.md` v4.2) the spec is feel.md; this manual follows it.** The names the overhaul deleted are listed
under [Migration notes](#migration-notes); none of them compiles any more.
Every primitive is live at **`/dev/ui`** (sign in, then open the URL; it is not in the tab bar). Try it on a phone-sized
viewport: the pill at the bottom of that page names each haptic as it fires, so haptics can be checked on a desktop or in
iOS Safari, where nothing vibrates.

- Import from one place: `import { Pressable, ContextMenu, SwipeRow, … } from '@/ui'`. The individual files
  (`@/ui/Pressable`, `@/ui/Sheet`, …) work too.
- Motion: `import { springs, … } from '@/lib/motion'`. Haptics: `import { haptics } from '@/lib/haptics'`.
- Styles for every primitive load once from `apps/web/src/styles/foundation.css` (App.tsx imports it). Tokens live in
  `styles/tokens.css`.

Contents: [Navigation](#navigation) · [The bar, the strip and the pager](#the-bar-the-strip-and-the-pager) · [Primitives](#primitives) · [Motion](#motion) ·
[Haptics](#haptics) · [Shared elements](#shared-elements) · [Type and rhythm](#type-and-rhythm) ·
[Migration notes](#migration-notes)

---

## Navigation

Four tabs: **Today · Plan · Progress · Journal** (bottom bar on a phone, rail at 900px and up). There is no Morning tab:
**This morning** is a page pushed from Today. The model lives in `@/ui/nav` (`TABS`, `ROUTES`, `matchRoute(pathname)`);
history has one owner, `app/NavController.tsx` (`useNav`, `useRouteParams`, `useRootRequest`, `useHomeControl`, `useTab`).

| Route | Kind | Lit tab |
|---|---|---|
| `/today/:date?` | tab root (the date is page state, mirrored with `replaceState`) | Today |
| `/today/:date/morning` | pushed, "This morning", depth 1 | Today |
| `/settings` · `/settings/:section` (`you`, `training`, `habits`, `plans`, `connections`, `app`, `data`, `account`) | pushed, depth 1 · depth 2 | Today |
| `/plan` · `/plan/week/:mon` · `/plan/month/:month` | tab root | Plan |
| `/progress` | tab root | Progress |
| `/journal` · `/journal/library` | tab root | Journal |
| `/journal/reads/:tab?` | pushed, depth 1 | Journal |
| `/dev/ui` | pushed, the gallery | Today |
| `/welcome/*`, `/start`, `/login`, `/signup` | full screen, no tab bar (react-router's; NavController sleeps there) | none |

Redirects: `/morning/:date` → `/today/:date/morning`, `/reads` → `/journal/reads`, `/plan/plans` → `/settings/plans`,
`/trends` → `/progress`, `/settings/<anything else>` → `/settings`.

Behaviour the Shell gives every page for free:

- **Tab switch**: a 0 ms cut. Each tab root mounts once (on its first activation or in idle) and stays mounted in its own
  scroller, so its scroll offset and its pushed pages survive. No fade, no slide, no haptic.
- **Re-tapping the lit tab** pops every pushed page in one spring; at the root it calls the root's `useHomeControl`
  (`goHome`: today, this week, the Journal segment); at home it scrolls to the top.
- **Pushed pages** slide over the mounted parent (`springs.page`, the parent moving to −30 % under a scrim); the layer owns
  the **edge swipe back** (a touch within 24 px of its current left edge; commits at 35 % of the width or 300 px/s) and the
  chevron's `pop()`. Push with `nav.push(path)` (`{ shared: id }` flies the element with that `data-shared` id into the
  page: Today's four-stop line into This morning). Cross-tab links are `nav.go(path)`.
- **Pull to refresh** on Today only, gesture-scoped, `haptics.threshold()` when armed; a commit fires `logbook:refresh`.
- **Inside the framed app nothing imports `react-router`**: read params with `useRouteParams()`, change them with
  `useRootRequest()` / `nav.replace()`.

Don't: add a fifth tab, add a gear, or put prev/next arrows in a bar.

---

## The bar, the strip and the pager

`import { NavBar, DateStrip, TodayPill, PushedBar, BackButton, DayPager, useDayPagerHandle, capsWord, dayCaption } from '@/ui'`

**`NavBar`** (a tab root's bar; `docs/feel.md` §2) returns a fragment whose rows (`.nb-bar`, `.nb-title`, the strip,
`.nb-gap`) are direct children of the page element, so the bar and the strip stick. The **caps line** is two spans:
`.nb-word` (the owner's word, `capsWord(settings.focus.word)`, at most 12 characters, opacity 1 at every offset and on every
day) and `.nb-date` (`dayCaption(date, today)`, fading with `--hdr`): `STEADY · FRI, OCT 23`. The large serif title (34/40)
collapses into a centred 17/22 inline title over the first 44 px of scroll. The title is fixed by the route: `Today`,
`Tomorrow`, `Sat 24`, `Plan`, `Progress`, `Journal`. The title block (caps line, large title, inline title) shares one tap
(home) and one hold menu (Today: `Change the word · Clear the word · Go to a day…`; Plan: `Go to a week…`). The trailing
slot is 80 px (96 on Plan, `wideTrailing`): the `Avatar` on today, the `TodayPill` off today, Plan's `Segmented` Week | Month.

**`DateStrip`** (Today only), pinned under the bar: Mon–Sun of the shown day's week, a status dot per day, the shown day in
one disc that travels with the pager's drag. A tap on a day is `goTo(date)`; a drag that starts on it is the page gesture
(with a `select` tick per cell). It is the successor of the old day arrows.

**`DayPager`** with `useDayPagerHandle()`: the whole page pages. prev / cur / next are mounted and keyed by date (the
neighbours `inert`), the track follows the finger 1:1, a release commits on 30 % of the width or a flick with the velocity
carried (`springs.page` / `springs.pageFlick`), a touch during the slide catches it. `handle.goTo(date, { mode })` slides
(adjacent or 2–7 days, one width) or crossfades (far); `handle.attach([stripEl, titleEl])` lets the strip and the title row
start the gesture; `handle.progress` drives the bar's stacked labels. `step` is `day` (Today), `week` and `month` (Plan).
No haptic on a commit; the hidden `.dpager-sr` Previous / Next buttons and the arrow keys are its keyboard path.

**`PushedBar`** (every pushed page): 44 + safe area, sticky, the chevron (`BackButton`, labelled `Back to <parent>`), a
centred title with an optional caps eyebrow (This morning's date), one trailing action. No large title on pushed pages.

```tsx
<div className="page-root">
  <NavBar
    word={capsWord(focus.word)}
    caps={{ prev: dayCaption(prev, today), cur: dayCaption(date, today), next: dayCaption(next, today) }}
    title={{ prev: dayTitle(prev, today), cur: dayTitle(date, today), next: dayTitle(next, today) }}
    progress={handle.progress}
    trailing={date === today ? <Avatar /> : <TodayPill onPress={goHome} />}
    onTitlePress={goHome}
    titleMenu={titleMenu}
    titleRef={titleRef}
  >
    <DateStrip shown={date} today={today} handle={handle} stripRef={stripRef} onPick={(d) => handle.goTo(d)} />
  </NavBar>
  <DayPager handle={handle} date={date} step="day" onCommit={setDate} render={(d, live) => <DayPage date={d} live={live} />} />
</div>
```

---

## Primitives

Every primitive: keyboard and VoiceOver complete, 44px targets, reduced motion handled, typed props with JSDoc.

### Pressable

`import { Pressable } from '@/ui'` · the one way to make a thing pressable; replaces ad-hoc `whileTap`.

| Prop | Type | |
|---|---|---|
| `onPress` | `(e) => void` | Tap (from the click), Enter, Space. |
| `onHold` / `holdMenu` | `(info: HoldInfo) => void` / `ContextMenuItem[]` | The one 450 ms hold (`HOLD_MS`): a pre-grow at 300 ms, the lift in place at 450 with `haptics.lift()`, then the menu (≤ 4 items) under the cut-out scrim; also right-click and Shift+F10. The tap after a hold is swallowed. |
| `onDragStart` / `onDragMove` / `onDragEnd` | | A move after the hold hands the object to the finger (the menu closes). |
| `press` | `'scale' \| 'surface' \| 'dim' \| 'none'` | Default `scale`: `data-pressed` on touch-down and a CSS 0.97 (120 ms in, 160 out); `surface` for rows, `dim` for text verbs. |
| `ignore` | `string` | A selector: pointers that start inside it (an inner ring or button) are not this Pressable's. |
| `haptic` | `HapticEvent` | Fired with `onPress`. Leave off for taps that only navigate or open a sheet (§11.4: almost every tap). |
| `as` | `'button' \| 'div' \| 'li'` | `div`/`li` get role="button", tabIndex, Enter/Space. Use it when the thing contains other buttons. |
| `disabled`, `label`, `className` | | `label` is the accessible name for an icon-only thing. |

```tsx
<Pressable className="orb" onPress={() => light(h)} holdMenu={orbMenu(h)} label={`${h.name}, ${done ? 'lit' : 'not lit'}`}>
  <OrbRing value={progress} />
</Pressable>
```

Do: give it real size (`.pressable` sets min-height 44px). Don't: nest a Pressable button inside another button.
For a long-press *menu*, pass `holdMenu` (or wrap the object in `ContextMenu`).

### ContextMenu and useContextMenu

`import { ContextMenu, useContextMenu, type ContextMenuItem } from '@/ui'`

`ContextMenuItem = { label: string; icon?: ReactNode; onSelect: () => void; destructive?: boolean; disabled?: boolean }`

| Prop | Type | |
|---|---|---|
| `items` | `ContextMenuItem[]` | Destructive items are moved last and drawn red. List every action the object's gestures perform. |
| `children` | one element | The object. Its own taps keep working. |
| `label` | `string` | The object's name: menu is "Easy 6 actions". |
| `as` | `'div' \| 'li' \| 'span'` | The wrapper, `display: contents` (never changes layout). Use `li` in a list. |
| `a11yButton` | `boolean` | Default true: a visually hidden "Easy 6 actions" button after the child for VoiceOver and Tab users (shown as a pill when focused). |
| `disabled` | `boolean` | |

Behaviour: a 450ms hold (or right-click, Shift+F10, the ContextMenu key) fires `haptics.lift()`, lifts the child itself in
place to scale 1.03 on `springs.lift` (no copy, no z-index), dims everything else to 70% black through a cut-out around it
(`.cm-hole`, no blur), and shows a menu card (surface-2, 14px radius, ≤ 4 items) below the object, or above it when there is
no room. A tap outside (which is swallowed), Escape or Back closes it. Arrow keys, Home and End move between items; focus returns
to where it was. Picking an item closes the menu first, then calls `onSelect` (so a sheet opened there captures the right
opener). It renders through a portal; mount nothing yourself (the provider is in main.tsx, above the `SheetProvider`, so
anything inside a sheet can open a menu too).

```tsx
<ContextMenu
  label={s.name}
  items={[
    { label: 'Move', icon: <ArrowRightLeft size={18} />, onSelect: () => openMoveSheet(sheet, date, s) },
    { label: 'Skip', icon: <SkipForward size={18} />, onSelect: () => skip(s) },
    { label: 'Not feeling 100%', onSelect: () => ease(s) },
    { label: 'Delete', icon: <Trash2 size={18} />, destructive: true, onSelect: () => remove(s) },
  ]}
>
  <button className="srow" onClick={() => openSession(date, s)}>…</button>
</ContextMenu>
```

Imperative (from a gesture you own, e.g. after a drag hold that did not move):

```tsx
const menu = useContextMenu();
menu.open({ items, anchor: el, label: 'Easy 6 actions' }); // anchor: element, DOMRect or {x, y}; lift?: element
```

Do: put the one-tap action on the object and the rest in the menu. Don't: make the menu the only path to an action that
matters (also offer it in the object's sheet), or wrap something that already handles long-press itself.

### SwipeRow

`import { SwipeRow, type SwipeAction } from '@/ui'`

`SwipeAction = { label: string; icon?: ReactNode; tone?: 'ok' | 'warn' | 'bad' | 'neutral'; onCommit: () => void; destructive?: boolean }`

| Prop | Type | |
|---|---|---|
| `right` | `SwipeAction` | Swiping the row **to the right** (→) reveals it on the left edge. To-dos: Done. Sessions: Done. |
| `left` | `SwipeAction` | Swiping the row **to the left** (←) reveals it on the right edge. To-dos: Later. Sessions: Move. |
| `menuItems` | `ContextMenuItem[]` | Extra long-press items after the swipe actions. |
| `label` | `string` | The row's name for the menu. |
| `menu` | `boolean` | Default true: the row is wrapped in a `ContextMenu` listing every action (the keyboard and VoiceOver path). |
| `as` | `'div' \| 'li'` | |
| `onReveal` | `(side) => void` | The reveal detent opened (`'left'` / `'right'`) or closed (`null`). |
| `disabled`, `className` | | |

Behaviour (v2, `docs/feel.md` §11.3): the first 10px decide the direction (a vertical scroll always wins); the pane follows
the finger 1:1; a slow release past 72 px rests at the **reveal detent**, the action a 72 px wide, ≥ 44 px tall button
(`.swipe-row[data-revealed]`) until a tap elsewhere closes it; a release past 0.55 of the width, or at 600 px/s, commits:
the pane leaves with the release velocity on `springs.settle`, `onCommit` runs on completion and the rows below FLIP up.
`haptics.threshold()` fires once on arming, never on disarming. A side without an action does not move. Swipe rows live in
sheets, Library and Reads only, never inside the day pager.

```tsx
<div className="list-edge">
  {top3.map((t) => (
    <SwipeRow
      key={t.id}
      label={t.text}
      right={{ label: 'Done', icon: <Check size={20} />, tone: 'ok', onCommit: () => (haptics.toggle(), complete(t)) }}
      left={{ label: 'Later', icon: <Clock size={20} />, tone: 'warn', onCommit: () => later(t) }}
      menuItems={[{ label: 'Delete', destructive: true, onSelect: () => remove(t) }]}
    >
      <TodoRowContent t={t} />
    </SwipeRow>
  ))}
</div>
```

The row's content gets an opaque background (`--swipe-bg`, black; surface inside `.card`/`.group`); set `--swipe-bg` if
your row sits on something else. `onCommit` fires no haptic itself: fire the event that fits (`toggle` for Done, `delete`
for Delete with an Undo toast). Do: keep both actions in the menu (automatic). Don't: put a SwipeRow inside a horizontal
scroller. On a pushed page a touch that starts in the left 20px is the edge swipe back, not the row's swipe (as on iOS).

### Ticker

`import { Ticker } from '@/ui'` · a number that springs to its value on `springs.number`.

| Prop | Type | |
|---|---|---|
| `value` | `number` | |
| `format` | `(v: number) => string` | Default: rounded integer. |
| `from` | `number` | Start of a mount animation. Alone: animates from it on every mount. |
| `onceADay` | `string` | A `useFirstToday` key: the mount animation (from `from`, default 0) runs only on the first view of the day. |
| `className` | `string` | |

Default: shows the first value as is (never counts up from 0 on a revisit) and animates on change. VoiceOver reads the
final value once. Reduced motion: the value is shown directly.

```tsx
<span className="stamp aura-num">
  <Ticker value={weekMiles} format={mi} from={0} onceADay="today-week-miles" />
  <small>mi</small>
</span>
```

### useFirstToday

`import { useFirstToday, markSeenToday, resetSeenToday } from '@/ui'`

`useFirstToday(key: string | null): boolean` is true on the first mount of the day for `key` and false on every later
mount that day (localStorage `logbook.seen.<key>.<date>`; old days are pruned). The answer is fixed for the component's
life. Use it for the once-a-day route draw and ring fill; key per object when each has its own moment.

```tsx
const draw = useFirstToday(`route-${session.id}`);
<motion.path d={route} initial={draw && !reduce ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease }} />
```

### Skeleton

`import { Skeleton, SkeletonGroup, SkeletonRows, SkeletonPage } from '@/ui'` · grey blocks shaped like the real layout,
`surface` at 100% (`surface-2` inside a card), no shimmer, nothing moves.

- `Skeleton` `{ w?, h?, r?: 'card' | 'control' | 'line' | 'pill' | number, circle?, className?, style? }` (aria-hidden).
- `SkeletonGroup` `{ label, children }` announces "Loading …" once (role="status", aria-busy).
- `SkeletonRows` `{ rows?, label?, sub? }`: list rows, 60px each, hairlines between.
- `SkeletonPage`: the shell's boot placeholder (header, hero, three rows).

```tsx
if (!loaded)
  return (
    <SkeletonGroup label="Loading today">
      <Skeleton h={220} r="card" />
      <div className="row" style={{ gap: 12, marginTop: 24 }}>{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} circle h={56} />)}</div>
    </SkeletonGroup>
  );
```

Do: draw the shape of what is coming. Don't: show words ("Loading to-dos…") or a spinner. `Loading` and `Spinner` are gone.

### EmptyState v2

`import { EmptyState } from '@/ui'`

| Prop | Type | |
|---|---|---|
| `children` / `text` | `ReactNode` | One sentence, said forward. |
| `verb` | `{ label, onPress, haptic?, primary? }` | The one verb button (soft blue; `primary` for the screen's one blue). |
| `ghost` | `ReactNode \| 'bars' \| 'rows' \| 'lines'` | The *shape* of the filled state at 30%, aria-hidden and inert, fading out at the bottom. Use a ghost primitive (below), never sample content. |
| `starters` | `string[]` | One-tap chips; each calls `onStarter(s)` (may return a promise), then shows as added (no haptic). |
| `onStarter` | `(s: string) => void \| Promise` | |
| `startersLabel` | `string` | VoiceOver group name. Default "Starters". |
| `action` | `ReactNode` | v1: any node at the right. With only `children` + `action` the v1 compact row is drawn, so old call sites keep their look. |

**Ghosts are shapes, never content (critic B1).** A new athlete must never see made-up personal data: no numbers, words,
dates, domains or entries, not even at 30%. In a private log they read as a bug or as someone else's account. Use one of
the three ghost primitives (`import { GhostBars, GhostLines, GhostRows } from '@/ui'`), or the shorthand string:

| Ghost | Props | For |
|---|---|---|
| `GhostBars` / `ghost="bars"` | `count?` (8), `height?` (120) | Progress: bars rising and dipping, a baseline, no axis, no numbers, no "PLAN" label |
| `GhostRows` / `ghost="rows"` | `rows?` (3), `lead?: 'dot' \| 'square' \| 'none'`, `rowHeight?` (60) | Journal entries, Library, Reads: rows of two grey text bars (≈60% and 35%), hairlines between |
| `GhostLines` / `ghost="lines"` | `widths?` ([60, 35]), `h?` (12) | a quote, a paragraph, one entry |

Shapes of real controls (empty orbs, an empty ring) are fine as long as they carry no text. Dev builds log a console
warning when a ghost renders any text. Reads: no ghost rows at all (the slim "Save links…" card is the empty state).

```tsx
<EmptyState ghost={<GhostBars />} verb={{ label: 'Log a run', onPress: logRun }}>Each run you log lands here.</EmptyState>
<EmptyState ghost={<GhostRows rows={3} lead="dot" />} verb={{ label: 'Write the first one', onPress: write }}>Two sentences a day add up.</EmptyState>
```

```tsx
<EmptyState
  ghost={<OrbRow empty count={4} />}
  starters={['Sleep 7 h', 'Stretch', 'Read', 'Protein', 'No phone in bed']}
  onStarter={(name) => addHabit.mutateAsync({ name })}
  verb={{ label: 'Add a habit', onPress: openAddHabit }}
>
  Habits light up here as you do them.
</EmptyState>
```

### WeekRing

`import { WeekRing, type WeekDayStatus } from '@/ui'`

`WeekDayStatus = 'done' | 'floor' | 'missed' | 'skipped' | 'rest' | 'open' | 'future'`

| Prop | Type | |
|---|---|---|
| `days` | `WeekDayStatus[]` | Seven, Monday first. A continuous `--surface-3` track; an arc only on a day with a session: done solid `--accent`, floor solid `--warn`, missed no arc and an `--ink-4` stretch of track (never red), skipped (and sick) grey, open/future a faint arc. Rest (and a day with nothing planned) has no arc. No dashes. |
| `size` | `40 \| 64` | 40 in a hero, 64 in a sheet. |
| `today` | `number` | 0–6: a small tick outside today's arc. |
| `label` | `string` | Default spells the week: "Week: 3 done, 1 floor, 1 rest, 2 to go". |
| `onceADay` | `string \| null` | Fill key (default `'week-ring'`); the fill (≤ 900ms, `springs.number`) runs once a day. `null`: never. |
| `marked` | `number` | 0–6: the shown day, its segment ringed 1.5px `--ink` (Today's week card). |
| `onPress` | `() => void` | Makes it a 44px button (tap → week sheet). |
| `children` | `ReactNode` | The middle. Left out: the days kept (done + floor) in the stamp face (Inter Tight 800, 13 at 40), nothing while 0. Pass a node to replace it (a check), `null`/`''` for nothing. |

```tsx
<WeekRing days={weekStatuses} today={todayIndex} onPress={openWeekSheet} />
```

It should read as a calendar of the week at a glance, never as a spinner (critic B2). `weekRingKept(days)` gives the
middle number. Reduced motion: drawn complete. Do: pair it with words in the sheet it opens. Don't: use colour alone to say
"missed"; don't pass `rest` for a day that has a session.

### Sheet v3

`import { useSheet, useSheetDepth, type SheetSpec } from '@/ui'`

`SheetSpec = { title, body, eyebrow?, detent?: 'auto' | 'medium' | 'large', detents?, header?, wide?, sticky?, action?, onClose? }`

| API | |
|---|---|
| `sheet.open(spec)` | Show a sheet, replacing the whole stack (the v1 call; unchanged). |
| `sheet.push(spec)` | Slide a panel in from the right inside the open sheet, with a back chevron in the header (`springs.page`). Opens one if none is up. |
| `sheet.pop()` | Back one panel; closes from the first. |
| `sheet.close()` | Close everything. |
| `sheet.update(partial)` | Change the top panel in place. |
| `useSheetDepth()` | 1 for the first panel, 2 for a pushed one. |

One header for every sheet: optional caps `eyebrow`, the serif `title` (28), an optional `action` (one icon button before
Close: the session sheet's ⋯ opens a `useContextMenu()` menu from it), Close. Detents (`docs/feel.md` §9.4): `auto` (the
content's height), `medium` (half the screen), `large` (the screen less the safe area and 10 px); the grabber cycles
`detents`. `header` is a fixed, sticky block under the grabber (the builder's ghost). `sticky` ignores scrim taps. The sheet
follows a drag 1:1 from the header or from the body at `scrollTop` 0 and dismisses on a flick (≥ 400 px/s) or a quarter of
its height; the page behind recedes to 0.92 as it rises. Escape and Back close it (one history entry per sheet; an inner
`push` adds none); focus moves in once the rise completes and returns to the opener. Reduced motion: every move is a 150ms
fade. There is no title flyer.

```tsx
const sheet = useSheet();
sheet.open({ eyebrow: fmtDate('long', date), title: s.name, body: <SessionSheet … /> });
// inside SessionSheet:
<Button variant="quiet" onClick={() => sheet.push({ title: 'Edit', body: <SessionEditor … /> })}>Edit</Button>
// inside SessionEditor, after saving:
sheet.pop();
```

Do: use `push` for Edit and Move (they used to replace the sheet). Don't: put a caps kicker in `title`; use `eyebrow`.

### Toast

`import { useToast } from '@/ui'` · `toast(text, action?)`. One line (or two) of feedback, as wide as its words, above the
tab bar; the action (Undo) is a 44px target; 4 s, 6 s with an Undo (`TOAST_MS`, `TOAST_UNDO_MS`). Only Undo and errors toast (§8); a toast belongs to the tab it was raised on.

- An action may show a follow-up toast ("Ease them" → "Eased. Undo"): acting clears only the toast that was acted on,
  before the action runs, so the follow-up stays for its full time (QA D-F1; `ui/toastStore.ts`, tested).
- While a sheet is open the toast sits just above the sheet's top edge (pinned to the top of the screen when a tall sheet
  leaves no room), never over its actions (QA D-F3). Only the action button takes taps; the words let taps through.

```tsx
haptics.delete();
toast('Deleted', { label: 'Undo', fn: restore });
```

### Section

`import { Section } from '@/ui'` · `{ title, meta?, action?, level?: 'primary' | 'secondary' | 'none' }`: a sentence-case
section title (Inter 17/600) with 48px (primary) or 24px (secondary) above. Prefer it to the caps `SectionHead`.

```tsx
<Section title="To-dos" meta={openCount} level="primary">
  <div className="list-edge">…</div>
</Section>
```

### Smaller pieces

- `Avatar` (Today's bar on today; the one door to Settings).
- `BackButton` (the chevron `PushedBar` draws).
- `useHold(opts)` returns `{ handlers }` to spread: the one hold clock, for an element that is not a `Pressable`.
- Unchanged v1 pieces: `Button`, `IconButton`, `ChipButton`, `Chip`, `Field`, `Group`, `Card`, `Row`, `Mark`, `Ring`,
  `Segmented` (one thumb on `springs.settle`, no haptic; `className="in-bar"` in Plan's 96 px slot), `Stepper`
  (`haptics.select()` per step), `Stat`, `AuraStat`, `StatStrip`, `Note`, `LogoMark`. `Mark` fires no haptic of its own
  (a to-do's `toggle` is its caller's, on the visual peak through `hapticAtPeak`).

---

## Motion

`import { springs, springFor, forScale, forRange, ease, fadeIn, fadeOut, crossfade, crossfadeSlow, colorTween, sheetOpen, menuIn, reducedFade, motionFor, useMotionFor, useReduced, PRESS_SCALE, PREHOLD_SCALE, LIFT_SCALE, COMPLETE_SCALE } from '@/lib/motion'`
· the numbers live only here and in `@/lib/gesture` (`HOLD_MS`, `EDGE_PX`, `FLICK_V`, `TOAST_MS`, …); never type them.

Eight springs, written as Apple's duration / bounce (`springFor(d, b)`), every one resting at |Δ| ≤ 1 px and |v| ≤ 30 px/s
(a move under 5 units, a scale or a fill, rests on scale thresholds), so "rest" is the frame `animationComplete` fires:

| Spring | Duration / bounce | Use it for |
|---|---|---|
| `springs.page` | 0.35 s / 0 | The pager's release and `goTo`, push, pop, the push flyer, a sheet's inner push/pop. |
| `springs.pageFlick` | 0.35 s / 0.15 | A pager or edge-swipe release that ended in a flick. |
| `springs.settle` | 0.30 s / 0.10 | A swipe row home, a drop into a slot, siblings reflowing (FLIP), the landing FLIP, the segmented thumb, ring → check. |
| `springs.lift` | 0.25 s / 0 | The hold lift to 1.03. |
| `springs.sheet` | 0.50 s / 0 | Detent snaps and spring-backs after a drag. |
| `springs.sheetFlick` | 0.50 s / 0.10 | A flick dismiss. |
| `springs.number` | 0.48 s / 0 | Ticker, the week ring fill. |
| `springs.complete` | 0.30 s / 0.30 | The one overshoot: an orb or a check to 1.12 (`COMPLETE_SCALE`). |

- Tweens only for things that do not move: `fadeIn` 120 ms, `fadeOut` 100 ms, `crossfade` 150 ms (faces, slots,
  segments), `crossfadeSlow` 200 ms (Week ⇄ Month), `colorTween` 200 ms; `sheetOpen` 500 ms on the sheet curve; `menuIn`.
- Only `transform` and `opacity` animate. A box that changes size uses a FLIP on `settle` (the run landing's growth is the
  one layout exception, `data-layout-exception`). The press is CSS (`[data-pressed]`), not a spring.
- Reduced motion: `motionFor(name, reduce)` / `useMotionFor(name)` return `reducedFade` (150 ms opacity) instead of the
  spring; tracking under a finger stays 1:1.

Never: animate on scroll, loop ambient motion, stagger more than 6 items or more than 30 ms, slide or fade a page on a tab
switch.

---

## Haptics

`import { haptics, hapticAtPeak, useHapticsEnabled, getHapticsEnabled, setHapticsEnabled } from '@/lib/haptics'`

Who fires what is `docs/feel.md` §11.4. In short:

| Call | Native (Capacitor) | Fires on |
|---|---|---|
| none | | tab taps, page commits, the Today pill, strip taps, the title block, segmented changes, opening a sheet or a page, calendar picks, Save of the word or the alarm, Skip |
| `haptics.select()` | `selectionStart` / `selectionChanged` / `selectionEnd` (throttled to 40ms) | the disc crossing a cell in a drag that began on the strip; an alarm step; a reorder or Plan drag crossing a slot; a stepper step; the Progress scrub |
| `haptics.orb()` / `haptics.toggle()` | Impact Light | an orb lit; a to-do's mark; a favourite's star: only through `hapticAtPeak(scale, e)`, on the frame of the pop's apex |
| `haptics.threshold()` | Impact Light | a swipe row arming (once); pull to refresh arming |
| `haptics.lift()` / `haptics.drop()` | Impact Medium / Light | the 450 ms lift (the hold fires it); a drop into a slot |
| `haptics.success()` | Notification Success | Close the day's Save (once); the run landing's settle frame (once, only when it plays on screen) |
| `haptics.celebrate()` | Impact Heavy, then Success 120ms later | the week ring closing (the Week card; once per week) |
| `haptics.delete()` | Impact Medium | a destructive commit with Undo |
| `haptics.warning()` / `haptics.error()` | Notification Warning / Error | a plan conflict on drop / a sync failure |

- The preference is `localStorage` `logbook.haptics` (on unless `'0'`). For the Settings switch:
  `const [on, setOn] = useHapticsEnabled();`
- Every haptic that fires is announced as a `logbook:haptic` window event (detail = the name): /dev/ui shows it, and tests
  can listen for it. The old `haptic(kind)` alias is gone.

---

## Shared elements

One shared element is left: the push flyer. `nav.push(path, { shared: id })` flies the element carrying `data-shared={id}`
on the page you leave to the element with the same `data-shared` on the page that arrives, frame by frame with the push
(`.flyer`, portalled to `body`); the source hides while it is away. The one id in use is `morning-line-<date>`: Today's
four-stop line → This morning's Now card. The sheet title flyer (`shared()`, `SheetSpec.layoutId`) and the app-wide
`LayoutGroup` are deleted; nothing uses motion's `layoutId`.

---

## Type and rhythm

Classes in `styles/foundation.css`; tokens in `tokens.css` (`--sp-secondary` 24, `--sp-group` 12,
`--page-pad`, `--dur-in/out/color`, `--halo-amber`, `--scrim`, `--scrim-menu`, `--r-menu`).

| Class | What |
|---|---|
| `.section-title` | Inter 17/600, sentence case. Use instead of a caps eyebrow unless it is a metric label. `.section-head` lays out title + `.section-meta` + action. |
| `.sec-primary` / `.sec-secondary` | 48px / 24px above a section. |
| `.sec-group` | 12px between things inside a group. |
| `.list-edge` | Edge-to-edge list: no card, rows bleed to the screen edges with a 16px gutter, hairlines start at the gutter. Rows (or SwipeRows, or ContextMenu-wrapped rows, or a wrapper of your own around a SwipeRow) are its direct children; give them their own min-height (44, 52 or 60). A SwipeRow keeps its pane edge to edge with the gutter on its content however it is wrapped; one column the list's width, so long content ellipsizes. |
| `:root[data-input]` | `pointer` or `keyboard`, the last input (`ui/focus.ts`). Focus rings show for the keyboard only, everywhere: while it says `pointer`, every `:focus-visible` outline and shadow ring is off (polish 15). Draw rings with `:focus-visible` as usual; nothing else to do. |
| `.tnum` | Tabular figures, for numbers that tick or line up. `.stamp`, `Ticker`, `<time>` and number inputs have them already. The body does not: Inter's tabular set widens the hyphen ("Wake - up"). |
| `.carousel` | Horizontal snap carousel bleeding to the edges; items `78%` wide (`--carousel-item` to change). |
| `.halo` + `.halo-done` / `.halo-floor` / `.halo-missed` / `.halo-upcoming` / `.halo-rest` | State-driven light: full bloom, amber edge, dim and cool, 60%, soft. 200ms crossfade between states. On an `.aura` card the existing `.aura-glow` layer answers the same classes. Add `.halo-boost` for the day's first completion (20% brighter for 600ms). |

```tsx
<section className={`aura halo-${heroState}`}>
  <div className="aura-glow" />
  …
</section>
<Section title="To-dos" meta={3} level="secondary">
  <div className="list-edge">{rows}</div>
</Section>
```

Page title: the bar's large title, serif italic 34/40 (`NavBar`), collapsing into the 17/22 inline title. Sheet title: serif 28. Never two identical
cards in a row: rotate hero, a row of touchables, an edge-to-edge list, a carousel, a single inset card.

---

## Migration notes

The feel overhaul (spec `docs/feel.md` v4.2), as integrated:

1. **Tabs**: four. The Morning tab is gone; This morning is pushed from Today at `/today/:date/morning` (the hero's four-stop
   line and the `This morning` row under the hero). `/morning/:date` redirects there.
2. **Navigation** has one owner, `NavController`: `useNav()` (`push`, `pop`, `popAll`, `replace`, `go`, `activate`),
   `useRouteParams()`, `useRootRequest()`, `useHomeControl()`. Nothing inside the framed app imports `react-router`; the
   interim `RouterBridge` and the old pages' `<Routes>` wrapping are deleted.
3. **Headers**: `TabHeader`, `PushedHeader`, `PageHeader`, `dateLine` and `usePushedBack` are deleted: `NavBar` (with the
   word in its caps line) on tab roots, `PushedBar` on pushed pages. The FocusStrip above Today's header is deleted; the
   word lives in the caps line and its editor is the word sheet.
4. **Dates**: `DatePager`, `DayStepper` (the arrows and the chip) and `DayStrip` are deleted: `DayPager` pages the whole
   page, `DateStrip` is its affordance and picker, `TodayPill` goes home.
5. **Press and hold**: `useLongPress` / `LONG_PRESS_MS`, Pressable's `onLongPress`, `pressScale` and motion props, and
   ContextMenu's `preview` are deleted: `onHold` / `holdMenu` / `press` / `ignore` and `useHold`.
6. **Motion**: `springs.press`, `spring`, `springSoft`, `tween`, the four variants and `rowPresence` are deleted, and so are
   `lib/useDrag`'s `DROP_SPRING`, `LIFT`, `REST`, `liftFx` and its `HOLD_MS` (import `HOLD_MS` from `@/lib/gesture`).
7. **Sheets**: `shared()` and `SheetSpec.layoutId` are deleted; Sheet v3 has detents, a fixed `header`, and the page
   receding behind it.
8. **Also deleted**: `TAB_RESELECT` (the lit tab goes through `useHomeControl`), `SWIPE_COMMIT/LOCK/RUBBER` (the constants
   are in `@/lib/gesture`), `AnimatedNumber` (use `Ticker`), `Loading` (draw a skeleton), the `haptic()` alias,
   `--sp-primary`.
9. **`/trends` → `/progress`**, `/reads` → `/journal/reads`, `/plan/plans` → `/settings/plans` (redirects).
10. **Settings** is pushed from Today's avatar only (no avatar on other tabs' bars).

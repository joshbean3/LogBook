# Logbook foundation: the page teams' manual

Everything in `docs/experience.md` §2–§3 that a page builds on: navigation, primitives, motion, haptics, type and rhythm.
Every primitive is live at **`/dev/ui`** (sign in, then open the URL; it is not in the tab bar). Try it on a phone-sized
viewport: the pill at the bottom of that page names each haptic as it fires, so haptics can be checked on a desktop or in
iOS Safari, where nothing vibrates.

- Import from one place: `import { Pressable, ContextMenu, SwipeRow, … } from '@/ui'`. The individual files
  (`@/ui/Pressable`, `@/ui/Sheet`, …) work too.
- Motion: `import { springs, … } from '@/lib/motion'`. Haptics: `import { haptics } from '@/lib/haptics'`.
- Styles for every primitive load once from `apps/web/src/styles/foundation.css` (App.tsx imports it). Tokens live in
  `styles/tokens.css`.

Contents: [Navigation](#navigation) · [Headers](#headers) · [Primitives](#primitives) · [Motion](#motion) ·
[Haptics](#haptics) · [Shared elements](#shared-elements) · [Type and rhythm](#type-and-rhythm) ·
[Migration notes](#migration-notes)

---

## Navigation

Four tabs: **Today · Plan · Progress · Journal** (bottom bar on a phone, rail at 900px and up). The model lives in
`@/ui/nav` (`TABS`, `PUSHED`, `routeInfo(pathname)`, `useRouteInfo()`).

| Route | Kind | Lit tab |
|---|---|---|
| `/today/:date?` | tab | Today |
| `/plan/:view?/:date?` | tab | Plan |
| `/progress` (`/trends` redirects here) | tab | Progress (renders `TrendsView` until the Progress team replaces it) |
| `/journal/:tab?` | tab | Journal |
| `/morning/:date?` | pushed | Today |
| `/reads/:tab?` | pushed | Journal |
| `/settings/:section?` | pushed | none (the avatar wears the accent ring) |
| `/welcome/*` | full screen, no tab bar | none (placeholder: `features/onboarding/Welcome.tsx`) |
| `/dev/ui` | pushed, dev gallery | none |

Behaviour the Shell gives every page for free:

- **Tab switch**: an instant cut with a 120ms opacity fade on the incoming page (CSS, `.page-enter`), and
  `haptics.select()`. No slide, no stagger.
- **Re-tapping the lit tab** scrolls to the top (smoothly unless reduced motion); if already at the top it goes to the tab
  root (`/today`, `/plan`), i.e. today / this week. From a pushed page, tapping its lit tab goes to the tab root. Either
  way the Shell then fires `window` event `logbook:tab-reselect` with `detail: { tab, atTop }` (`TAB_RESELECT`). Listen if
  your page keeps its own state (a selected week, an open fold):

  ```tsx
  useEffect(() => {
    const f = (e: Event) => (e as CustomEvent<TabReselectDetail>).detail.atTop && setWeek(thisWeek());
    window.addEventListener(TAB_RESELECT, f);
    return () => window.removeEventListener(TAB_RESELECT, f);
  }, []);
  ```
- **Pushed pages** (every route marked pushed above) render inside `PushedPage` (App.tsx does this; you do nothing). It
  slides in from the right on a push (`springs.page`), owns the **edge swipe back** (a touch starting in the left 20px
  follows the finger; commits at 35% of the width or a 500px/s fling, else springs home), and gives `back()` to the
  chevron. Back pops history when there is in-app history, else goes to the owning tab's root (a cold start on a deep link).
- **Pull to refresh** (Today, Plan, Progress) with `haptics.threshold()` when armed; the net pill and offline behaviour are
  unchanged.
- To push a page, navigate normally: `nav('/morning')` or `<Link to="/reads">`. No haptic (navigation only).

Don't: add a fifth tab, add a gear, or put prev/next arrows in a header. Don't put a pushed page's own back button in the
body; use `PushedHeader`.

---

## Headers

### TabHeader

`import { TabHeader } from '@/ui'`

| Prop | Type | |
|---|---|---|
| `title` | `ReactNode` | The serif word (44; steps to 28 when it would wrap, and always under 360px). |
| `date` | `ReactNode \| false` | Caps line above the title. Default today, "Wed, Oct 14". `false` hides it. |
| `onDatePress` | `() => void` | Makes the date line a button (opens the calendar sheet). 44px hit area. |
| `onDateStep` | `(dir: -1 \| 1) => void` | A horizontal swipe on the date line: `+1` = next day/week. Fires `haptics.select()`. |
| `dateLabel` | `string` | VoiceOver name for the date button. |
| `accessory` | `ReactNode` | One small thing before the avatar ("Today" chip when off today, a "Month" text button). |
| `titleLayoutId` | `string` | Motion `layoutId` on the title (rare). |
| `children` | `ReactNode` | Under the header (Plan's week header, Journal · Library switch). |

```tsx
<div className="page">
  <TabHeader
    title={dayWord ?? 'Today'}
    date={dateLine(date)}
    onDatePress={openCalendar}
    onDateStep={(d) => go(shiftDays(date, d))}
    dateLabel={`${fmtDate('long', date)}. Pick a day`}
    accessory={date !== today ? <ChipButton quiet onClick={() => go(today)}>Today</ChipButton> : null}
  />
  …
</div>
```

The **Avatar** (`<Avatar />`, the account's initial in a 32px disc, 44px hit, pushes `/settings`) is built in. Do: one
accessory at most. Don't: add a gear, arrows, or a second title line.

### PushedHeader

`import { PushedHeader } from '@/ui'`

| Prop | Type | |
|---|---|---|
| `title` | `ReactNode` | Serif 28. |
| `eyebrow` | `ReactNode` | Caps line above the title (Morning's date). |
| `right` | `ReactNode` | One action (icon button or verb). On Settings it defaults to the ringed avatar. |
| `onBack` | `() => void` | Override back (rare: confirm unsaved edits). Default: slide out, then pop or go to the owning tab. |
| `backLabel` | `string` | VoiceOver name for the chevron. Default "Back to Today" / "Back to Journal" / "Back". |
| `children` | `ReactNode` | Under the header (a segmented control). |

```tsx
export default function ReadsView() {
  return (
    <div className="page">
      <PushedHeader title="Reads" right={<IconButton label="Add a link" onClick={add}><Plus size={20} /></IconButton>} />
      …
    </div>
  );
}
```

It pins to the top (glass background) while the page scrolls. The 44px chevron and the edge swipe share one `back()`. Do:
keep the title one or two words. Don't: render it outside a pushed route (it works, but there is no edge swipe there).

### Adopting the headers (the v1 `PageHeader`)

`PageHeader` still works and now knows where it is: on a pushed page it leads with the back chevron, on a tab it ends with
the avatar. Replace it when you rebuild your page:

1. Tab pages: `PageHeader title="Plan" sub=… actions={<DateNav …/>}` → `TabHeader title="Plan"` plus a `DatePager` (or
   `onDateStep`) for dates. Delete `DateNav` and any gear (`shell.css` hides Today's old gear in the meantime; remove that
   rule when Today adopts `TabHeader`).
2. Pushed pages: `PageHeader` → `PushedHeader`. Nothing else: the frame, the edge swipe and back are already there.

---

## Primitives

Every primitive: keyboard and VoiceOver complete, 44px targets, reduced motion handled, typed props with JSDoc.

### Pressable

`import { Pressable } from '@/ui'` · the one way to make a thing pressable; replaces ad-hoc `whileTap`.

| Prop | Type | |
|---|---|---|
| `onPress` | `(e) => void` | Tap, Enter, Space. |
| `onLongPress` | `(info: LongPressInfo) => void` | 450ms hold, cancelled by 8px of travel or a scroll; also right-click and Shift+F10. The tap after a hold is swallowed. |
| `haptic` | `HapticEvent` | Fired with `onPress`. Leave off for taps that only navigate or open a sheet. |
| `pressScale` | `number` | Default 0.97 on `springs.press`. `1` for rows that show their press with a background. |
| `as` | `'button' \| 'div'` | `div` gets role="button", tabIndex, Enter/Space. Use it when the thing contains other buttons. |
| `disabled`, `label`, `className` | | `label` is the accessible name for an icon-only thing. |

```tsx
<Pressable className="orb" haptic="orb" onPress={() => light(h)} onLongPress={() => openOrbMenu(h)} label={`${h.name}, ${done ? 'lit' : 'not lit'}`}>
  <OrbRing value={progress} />
</Pressable>
```

Do: give it real size (`.pressable` sets min-height 44px). Don't: nest a Pressable button inside another button.
For a long-press *menu*, use `ContextMenu` instead of `onLongPress`.

### ContextMenu and useContextMenu

`import { ContextMenu, useContextMenu, type ContextMenuItem } from '@/ui'`

`ContextMenuItem = { label: string; icon?: ReactNode; onSelect: () => void; destructive?: boolean; disabled?: boolean }`

| Prop | Type | |
|---|---|---|
| `items` | `ContextMenuItem[]` | Destructive items are moved last and drawn red. List every action the object's gestures perform. |
| `children` | one element | The object. Its own taps keep working. |
| `preview` | `ReactNode` | Lift a bigger preview instead of the object itself. |
| `label` | `string` | The object's name: menu is "Easy 6 actions". |
| `as` | `'div' \| 'li' \| 'span'` | The wrapper, `display: contents` (never changes layout). Use `li` in a list. |
| `a11yButton` | `boolean` | Default true: a visually hidden "Easy 6 actions" button after the child for VoiceOver and Tab users (shown as a pill when focused). |
| `disabled` | `boolean` | |

Behaviour: a 450ms hold (or right-click, Shift+F10, the ContextMenu key) fires `haptics.lift()`, lifts a styled copy of the
child to scale 1.03 on `springs.lift` (the original hides underneath), dims the page to 70% black with a blur, and shows a
menu card (surface-2, 14px radius) below the object, or above it when there is no room, or pinned to the bottom with the
object nudged up. Tap outside, Escape or a swipe down closes it. Arrow keys, Home and End move between items; focus returns
to where it was. Picking an item closes the menu first, then calls `onSelect` (so a sheet opened there captures the right
opener). It renders through a portal; mount nothing yourself (the provider is in App.tsx).

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
menu.open({ items, anchor: el, label: 'Easy 6 actions' }); // anchor: element, DOMRect or {x, y}; lift?: element; preview?
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
| `disabled`, `className` | | |

Behaviour: the first 10px decide the direction (a vertical scroll always wins); the row follows the finger 1:1 and
rubber-bands past 60% of its width; the icon grows as it nears the commit point (40%); `haptics.threshold()` fires once each
time that line is crossed (out or back); release past it slides the row out, calls `onCommit`, and brings it home after
280ms unless the page removed it; otherwise it springs back on `springs.settle`. A side without an action barely moves.

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
final value once. Reduced motion: the value is shown directly. `AnimatedNumber` is now an alias of `Ticker`.

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

Do: draw the shape of what is coming. Don't: show words ("Loading to-dos…") or a spinner. The old `Loading` still compiles
and draws one neutral grey block; replace it with your page's skeleton. `Spinner` is gone.

### EmptyState v2

`import { EmptyState } from '@/ui'`

| Prop | Type | |
|---|---|---|
| `children` / `text` | `ReactNode` | One sentence, said forward. |
| `verb` | `{ label, onPress, haptic?, primary? }` | The one verb button (soft blue; `primary` for the screen's one blue). |
| `ghost` | `ReactNode` | The filled state at 30%, aria-hidden and inert, fading out at the bottom. |
| `starters` | `string[]` | One-tap chips; each calls `onStarter(s)` (may return a promise), then shows as added with `haptics.toggle()`. |
| `onStarter` | `(s: string) => void \| Promise` | |
| `startersLabel` | `string` | VoiceOver group name. Default "Starters". |
| `action` | `ReactNode` | v1: any node at the right. With only `children` + `action` the v1 compact row is drawn, so old call sites keep their look. |

```tsx
<EmptyState
  ghost={<OrbRow habits={SAMPLE_HABITS} />}
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
| `days` | `WeekDayStatus[]` | Seven, Monday first. Done blue, floor amber, missed/skipped ink-4, rest ink-4 dashed, open/future surface-3. |
| `size` | `40 \| 64` | 40 in a hero, 64 in a sheet. |
| `today` | `number` | 0–6: a small tick outside today's arc. |
| `label` | `string` | Default spells the week: "Week: 3 done, 1 floor, 1 rest, 2 to go". |
| `onceADay` | `string \| null` | Fill key (default `'week-ring'`); the fill (≤ 900ms, `springs.number`) runs once a day. `null`: never. |
| `layoutId` | `string` | `week-<isoWeek>` for a ring that travels. |
| `onPress` | `() => void` | Makes it a 44px button (tap → week sheet). |
| `children` | `ReactNode` | In the middle: a count, a check. |

```tsx
<WeekRing days={weekStatuses} today={todayIndex} onPress={openWeekSheet} />
```

Reduced motion: drawn complete. Do: pair it with words in the sheet it opens. Don't: use colour alone to say "missed".

### DatePager

`import { DatePager } from '@/ui'` · the Today hero, Morning's timeline, Plan's week.

| Prop | Type | |
|---|---|---|
| `date` | `string` (YYYY-MM-DD) | Controlled. |
| `onChange` | `(date: string) => void` | Called on a committed swipe, an arrow key, or the hidden Previous/Next buttons. |
| `render` | `(date: string) => ReactNode` | Called for the neighbours too while a drag or slide is under way: keep it cheap and pure. |
| `step` | `'day' \| 'week'` | |
| `min`, `max` | `string` | A drag past them rubber-bands. |
| `label`, `prevLabel`, `nextLabel` | `string` | VoiceOver names. |
| `className`, `disabled` | | |

Behaviour: follows the finger 1:1 with the neighbour alongside; commits at 30% of the width or a 500px/s fling with
`haptics.select()`; the new content slides home on `springs.page`. A `date` change from outside (a "Today" chip) slides in
from the side it lies on. Left/Right arrows when focused. Reduced motion: a 150ms crossfade; the drag still works.

```tsx
<DatePager date={date} onChange={(d) => nav(d === today ? '/today' : `/today/${d}`)} max={shiftDays(today, 14)} render={(d) => <Hero date={d} />} />
```

Do: wrap only the thing that pages (the hero, the week header). Don't: wrap the whole page, or content that scrolls
horizontally.

### Sheet v2

`import { useSheet, shared, useSheetDepth, type SheetSpec } from '@/ui'`

`SheetSpec = { title, body, eyebrow?, detent?: 'auto' | 'large', layoutId?, wide?, sticky? }`

| API | |
|---|---|
| `sheet.open(spec)` | Show a sheet, replacing the whole stack (the v1 call; unchanged). |
| `sheet.push(spec)` | Slide a panel in from the right inside the open sheet, with a back chevron in the header (`springs.page`). Opens one if none is up. |
| `sheet.pop()` | Back one panel; closes from the first. |
| `sheet.close()` | Close everything. |
| `sheet.update(partial)` | Change the top panel in place. |
| `useSheetDepth()` | 1 for the first panel, 2 for a pushed one. |

One header for every sheet: optional caps `eyebrow`, the serif `title` (28), Close. `detent: 'large'` takes the screen less
a 32px peek (editors). `sticky` ignores scrim taps. Drag the header down 90px (or fling) to dismiss; Escape closes; focus is
trapped and returns to the opener. Reduced motion: every move is a 150ms fade.

```tsx
const sheet = useSheet();
sheet.open({ eyebrow: fmtDate('long', date), title: s.name, layoutId: `session-${s.id}`, body: <SessionSheet … /> });
// inside SessionSheet:
<Button variant="quiet" onClick={() => sheet.push({ title: 'Edit', body: <SessionEditor … /> })}>Edit</Button>
// inside SessionEditor, after saving:
sheet.pop();
```

Do: use `push` for Edit and Move (they used to replace the sheet). Don't: put a caps kicker in `title`; use `eyebrow`.

### Toast

`import { useToast } from '@/ui'` · `toast(text, action?)`. One line (or two) of feedback, as wide as its words, above the
tab bar; the action (Undo) is a 44px target; 2.8s, 6.5s with an action.

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

- `Avatar` (in every TabHeader; export it only if you build a custom header).
- `BackButton` (the chevron, if you build a custom pushed header).
- `useLongPress(onLongPress, { ms?, slop?, disabled? })` returns `{ handlers }` to spread: the same hold grammar as
  everything else.
- Unchanged v1 pieces: `Button`, `IconButton`, `ChipButton`, `Chip`, `Field`, `Group`, `Card`, `Row`, `Mark`, `Ring`,
  `Segmented` (now fires `haptics.select()` on change), `Stepper` (`haptics.select()` per step), `Stat`, `AuraStat`,
  `StatStrip`, `DayStrip`, `Note`, `LogoMark`. `Mark` takes `haptic` (default `toggle` for square/floor, `success` for a
  done session; `false` for none).

---

## Motion

`import { springs, ease, fadeIn, fadeOut, colorTween, reducedFade, motionFor, useMotionFor, useReduced, rowPresence, PRESS_SCALE, LIFT_SCALE, COMPLETE_SCALE } from '@/lib/motion'`

| Preset | Values | Use it for |
|---|---|---|
| `springs.press` | 600 / 35 / 0.6 | Scale 0.97 on press, 1 on release. Pressable does this. |
| `springs.lift` | 500 / 30 / 0.8 | A long-press pick-up to 1.03 (ContextMenu, drag lift). |
| `springs.settle` | 450 / 34 / 1 | A drop into a slot, a swipe springing home, siblings reflowing, a list row inserting or collapsing. |
| `springs.sheet` | 380 / 38 / 1 | Sheets and detents. |
| `springs.page` | 300 / 32 / 1 | Pushed pages, the date pager, sheet push/pop, shared elements. |
| `springs.number` | 170 / 26 / 1 | Ticker, the week ring fill. |
| `springs.complete` | 500 / 18 / 0.8 | The one overshoot: a check or an orb popping to 1.12 (`COMPLETE_SCALE`). Completion only. |

- Tweens only for things that do not move: `fadeIn` (120ms), `fadeOut` (100ms), `colorTween` (200ms on `ease`). Never
  ease-in.
- `rowPresence` = `{ initial, animate, exit }` for a row entering (height 0 → auto + fade, `settle`) and leaving (collapse).
- Reduced motion: `motionFor(name, reduce)` / `useMotionFor(name)` return `reducedFade` (150ms opacity) instead of the
  spring. `MotionConfig reducedMotion="user"` at the root already drops transform animations; ring and route should appear
  complete (`useReduced()`).
- `pageVariants` is opacity only now; `listVariants` no longer staggers; `spring`, `springSoft`, `tween` remain as
  deprecated aliases.

Never: animate on scroll, loop ambient motion (the one exception: Morning's "now" dot, 2s, 4%), stagger more than 6 items or
more than 30ms, slide a page on a tab switch.

---

## Haptics

`import { haptics, useHapticsEnabled, getHapticsEnabled, setHapticsEnabled } from '@/lib/haptics'`

| Call | Native (Capacitor) | Use for |
|---|---|---|
| `haptics.select()` | `selectionStart` / `selectionChanged` / `selectionEnd` (throttled to 40ms) | Day/week step, segmented change, tab change, scrub step, a drag crossing a slot/day/5-min/0.5 mi |
| `haptics.toggle()` | Impact Light | To-do checked, star, small toggles |
| `haptics.orb()` | Impact Light (Soft once a native plugin exists) | Habit orb lit |
| `haptics.lift()` | Impact Medium | A long-press lifts an object (ContextMenu fires it for you) |
| `haptics.drop()` | Impact Light (Rigid when available) | Drop into a slot |
| `haptics.threshold()` | Impact Light | A swipe crossing its commit line (SwipeRow fires it), pull-to-refresh armed (Shell) |
| `haptics.success()` | Notification Success | Session done, Strava run lands, all habits lit, a multi-step save |
| `haptics.celebrate()` | Impact Heavy, then Success 120ms later | Week ring closes, block complete (at most once a week) |
| `haptics.delete()` | Impact Medium | A destructive action committed (with Undo) |
| `haptics.warning()` | Notification Warning | Plan conflict on drop |
| `haptics.error()` | Notification Error | Sync failed, action blocked |

- Fired for you: `select` on tab change, segmented change, Stepper steps and DatePager commits; `threshold` in SwipeRow and
  pull to refresh; `lift` when a ContextMenu opens; `toggle` when an EmptyState starter is added; Mark's on-completion
  event.
- One haptic per action, on the frame of the visual peak. None for taps that only navigate or open a sheet.
- The preference is `localStorage` `logbook.haptics` (on unless `'0'`). For the Settings switch:
  `const [on, setOn] = useHapticsEnabled();`
- Every haptic that fires is announced as a `logbook:haptic` window event (detail = the name): /dev/ui shows it, and tests
  can listen for it.
- `haptic(kind)` still works (deprecated): `tick` → `toggle`, `success` → `success`, `warn` → `warning`. Move your calls to
  the named events; to-do and reads deletes that used `haptic('warn')` should become `haptics.delete()`.

---

## Shared elements

The ids are the contract between the page that opens and the sheet or page that receives:

| Object | Id |
|---|---|
| A session (hero, Plan row → session sheet) | `session-<sessionId>` |
| A habit (orb → habit sheet) | `habit-<habitId>` |
| A journal entry (ribbon dot → entry) | `entry-<YYYY-MM-DD>` |
| A week (week ring / mileage bar → week sheet) | `week-<isoWeek>` (e.g. `week-2026-W42`) |

**Into a sheet** (the common case): mark the opener's title with `shared(id)` and open the sheet with the same `layoutId`.
The title flies from the opener into the sheet header on `springs.page` while the sheet rises, and home again on close
(the opener hides while it is away). Only one element on the page should carry a given id at a time.

```tsx
<span className="stamp" {...shared(`session-${s.id}`)}>{s.name}</span>
…
sheet.open({ title: s.name, layoutId: `session-${s.id}`, eyebrow: fmtDate('long', date), body: <SessionSheet … /> });
```

**Within a page** (a dot that grows into a card on the same page): use motion's `layoutId` with the same id convention.
There is one `LayoutGroup` at the app root, so ids in different subtrees meet. Use `layout="position"` on text so it never
stretches.

Why two mechanisms: the sheet lives in a fixed, clipped layer and the opener in the scrolled page; motion's projection
mis-measures across that boundary, so the sheet carries a small hand-made FLIP (a fixed "flyer" copy of the title).

---

## Type and rhythm

Classes in `styles/foundation.css`; tokens in `tokens.css` (`--sp-primary` 48, `--sp-secondary` 24, `--sp-group` 12,
`--page-pad`, `--dur-in/out/color`, `--halo-amber`, `--scrim`, `--scrim-menu`, `--r-menu`).

| Class | What |
|---|---|
| `.section-title` | Inter 17/600, sentence case. Use instead of a caps eyebrow unless it is a metric label. `.section-head` lays out title + `.section-meta` + action. |
| `.sec-primary` / `.sec-secondary` | 48px / 24px above a section. |
| `.sec-group` | 12px between things inside a group. |
| `.list-edge` | Edge-to-edge list: no card, rows bleed to the screen edges with a 16px gutter, hairlines start at the gutter. Rows (or SwipeRows, or ContextMenu-wrapped rows) are its direct children; give them their own min-height (44, 52 or 60). |
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

Page title: serif 44 (28 when it wraps or under 360px; TabHeader does this). Sheet title: serif 28. Never two identical
cards in a row: rotate hero, a row of touchables, an edge-to-edge list, a carousel, a single inset card.

---

## Migration notes

Breaking or visible changes a page team must know:

1. **Tabs**: Morning is no longer a tab. Nothing in Today links to `/morning` yet: the Today team must add the entry (tap the
   mini timeline / pull down on the hero → `nav('/morning')`). Until then it is reachable by URL and from /dev/ui.
2. **`/trends` → `/progress`** (redirect). Link to `/progress`.
3. **Settings** is pushed from the avatar in every header; Today's gear is hidden by a transitional rule in `shell.css`.
4. **Loading**: `Loading` draws a neutral grey block (no spinner, no words on screen); `Spinner` and the `.spinner` and
   `.loading` classes are deleted. `.skeleton` no longer shimmers.
5. **Sheets**: the scrim is 78% black (brand §5) and only the header drags the sheet down. `open()` behaves as before;
   `push()`/`pop()`/`eyebrow`/`detent`/`layoutId` are new.
6. **PageHeader** adds a back chevron on pushed pages and the avatar on tabs by itself.
7. **Haptics**: `haptic()` is deprecated; Segmented, Stepper, tab changes and pull-to-refresh now fire named events.
8. **Motion**: `pageVariants` lost its y offset and `listVariants` its stagger.
9. **Toast** is placed by a host element; the pill becomes a rounded card when its words take two lines.

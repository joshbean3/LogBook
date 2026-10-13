# Review notes: Interaction & Accessibility

Branch `worktree-agent-a4f6a79b7d435e27a`. Served for review on **http://localhost:8801** (sign in `josh@example.com` / `password123`), from this worktree's `apps/web/dist` through `apps/api` with the seed `test.db`.

Audit numbers (Playwright over 18 screen/sheet states × iPhone 14 at 100%, 120%, 135% root font size, and 320×640 = 72 states; script: scratchpad `a11y-audit.mjs`):

| check | before | after |
| --- | --- | --- |
| tap targets under 44×44 (day cells exempt from the width rule) | 12 | 0 |
| icon-only controls without a label | 0 | 0 |
| text/background pairs under WCAG AA (4.5:1, 3:1 for large) | 128 | 0 |
| horizontal overflow / clipped nowrap stamps and titles | 0 | 0 |

Behaviour checks: `a11y-behaviour.mjs` 36/36, `a11y-review.mjs` (the reviewers' items) 40/40.

## 1. Files changed

- `apps/web/src/styles/tokens.css` — adds `--accent-text` (#7a84ff, the blue as a word at ≥4.5:1 on black and on a card) and `--r-sm`.
- `apps/web/src/styles/base.css` — `html { font-size: 100% }`, body and the type scale in rem; `.page` becomes a size container (`page`); `a` uses `--accent-text`; reduced-motion block also stops smooth scroll.
- `apps/web/src/styles/ui.css` — every font-size/line-height in rem; container queries: aura stats 2×2 under an 18rem card, `.sheet .sh-stats` 2×2 under a 19rem sheet, 3-up `.strip` keeps three columns with the number at 22 and the unit free to wrap under a 17.9rem page, titles step down under a 19rem page, segments may wrap under a 15rem page, `.aura-top` may wrap under a 14rem card; `.lrow.tappable` press state, hover, `button/a/label.lrow` resets with a press lift on label rows, `.lrow-verb`/`.lrow-chev`; 44px hit areas for `.btn.sm`, `.chip-btn`, `.icon-btn.sm`, `.toast-act`, `.link` (min-width 44); `--accent-text` on links, ghost/soft buttons, done chip, ok stat/verdict/note; placeholders at `--ink-3`; 48px `.sheet-foot .btn.primary`; `.aura-pill`/`.aura-share` at 44px tall; `.aura-note`; `.dcell.out` stays readable (ink-3 number, dots at half); reduced-motion rules for the route draw, orb bloom, mark and meter.
- `apps/web/src/ui/primitives.tsx` — `Row` gains `href`, `as="label"`, `label`, and ignores taps that land on a control inside it (`onOwnControl`); `Stat` reads as one line (`role="img"` + `aria-label`, or `read` prop); new `AuraStat`, `readStat`, `unitWords`.
- `apps/web/src/ui/Sheet.tsx` — focus trap (Tab cycles inside, first control focused, focus returned on close to the element captured in `open()` before any `autoFocus` field takes it), `#root` made `inert` while a sheet is up, instant open/close under reduced motion. (The `aria-labelledby`/`id` lines are another team's and untouched.)
- `apps/web/src/app/Shell.tsx` — `<nav aria-label="Views">` keeps the landmark and holds a `<div role="tablist">` of `role="tab"`/`aria-selected` links; rail and tab icons `aria-hidden`; new `PullToRefresh` on Today, Plan and Trends (24px ring; fires after ~90px of travel; only a downward, mostly vertical move from the top counts, the first pulled move is prevented; refetches months, bootstrap, to-dos, lifts, activities).
- `apps/web/src/app/shell.css` — rem sizes; page fade kept at 200ms under reduced motion; `.ptr` ring (static when busy, z-index above the net pill); `.tabbar .tabs` grid; rail active link uses `--accent-text`.
- `apps/web/src/app/dynamicType.ts` (new) — on iOS/iPadOS only (native shell, iPhone/iPad user agent, or a Mac user agent with a touch screen) measures `-apple-system-body` and scales the root font size by (measured / 17); elsewhere it does nothing.
- `apps/web/src/app/App.tsx` — starts `watchDynamicType()` once.
- `apps/web/src/features/morning/MorningView.tsx` — hero card is the button (role, keyboard, press) named by its own content (eyebrow, duration, word, verdict and the four `AuraStat` readouts; nothing aria-hidden) with an `Edit` pill; `TapToEdit` wrapper opens the editor from a tap on any timeline block, measuring travel on pointermove so a drag over 8px (mouse or touch) is not a tap (the `Timeline` component itself is untouched); Type row and the settings rows are labels so a tap anywhere focuses the control.
- `apps/web/src/features/morning/morning.css` — rem sizes; block press states and cursor; past blocks dim the bar/border/halo instead of fading text below 4.5:1, past free slots drop their words to ink-3 (future free slots at ink-2); eyebrow nowrap with the duration hidden and the pill tightened on a narrow card (≤359px or an 18rem card); rest-morning 3-up stamps step to 17 on a narrow card; the range under a stamp hides when the page is narrow in rem.
- `apps/web/src/features/trends/TrendsView.tsx` — `Stamp` reads as one line; effort rows open the day (whole-row tap, label, chevron); lift rows carry `tr-lift`.
- `apps/web/src/features/trends/trends.css` — rem sizes; the narrow-in-rem block (strip number at 22, sparkline/change hidden, consistency names on two lines) placed last so it outranks the base rules; hero step-down under an 18rem card; lift row sub-line wraps; chevron at ink-3.
- `apps/web/src/features/settings/SettingsView.tsx` — Import, Add to Home Screen and Run sync (web: an anchor row, native: a button row) are whole-row actions with a verb and chevron at the right; the hidden file input is `tabIndex={-1} aria-hidden`; Reconnect/Disconnect stay two buttons.
- `apps/web/src/features/settings/settings.css` — rem sizes; tappable row title in ink, Sign out stays red.
- `apps/web/src/features/journal/JournalView.tsx` — new `QuoteSheet` (the quote at 22/28, author/work, theme caps, `Star`/`Unstar`, `Delete` for your own); the words of a quote row, of the quote hero and of the memory card are buttons: row and hero words open the quote sheet, memory words open that entry's editor; the star and Delete on a row are real 44px `IconButton`s again.
- `apps/web/src/features/journal/JournalDaySection.tsx` — `EntrySheet` exported; the entry star stops propagation.
- `apps/web/src/features/journal/journal.css` — rem sizes; `.q-open`, `.jq-open`, `.jmem-open` bare-button rules with press states; the entry body carries the left gutter so the tap starts at the group edge; `.qsheet`; placeholders at ink-3.
- `apps/web/src/features/auth/auth.css` — rem sizes; the screen is a size container so the title steps down at a larger text size.
- `docs/brand.md` — §3 gains the `--accent-text` row; `--ok` corrected to `#2f3bff` (what tokens.css ships).
- `docs/design-spec.md` — §3 Timeline: past blocks "sit back (bar, border and halo faded, words at `--ink-3`)" instead of "60% opacity".
- `REVIEW.md` — this file.

## 2. What to verify by hand (http://localhost:8801, iPhone-size viewport, touch emulation on)

1. **Today, Share pill**: open `/today/2026-10-04`. The `Share` pill in the hero's top-right is 44px tall. Tap it: the Share sheet opens, the `Share` button at the bottom is 48px tall. Press Tab repeatedly: focus never leaves the sheet. Press Escape: the sheet closes and focus is back on the Share pill.
2. **Sheet is modal**: with any sheet open, inspect `#root`: it has the `inert` attribute; after close it does not.
3. **Focus returns past an autoFocus field**: `/journal`, tap an entry's words: the editor opens with its textarea focused. Escape: focus is on that entry's words (`.jentry-body`). Same for a to-do without a note on Today (`.trow-name`).
4. **Morning hero**: `/morning`. Tap anywhere on the hero card (not only the `Edit` pill): the Edit morning sheet opens; its `Done` is 48px tall. In the accessibility tree the card is one button whose name includes "Today's morning", "2 h 15 min", "Run", the verdict and "Wake 7:15 AM … Leave 9:30 AM" (the four stamps are `role="img"` readouts, nothing on the card is aria-hidden except the halo).
5. **Morning timeline**: tap any block (Wake up, the run, Free, Leave for work): the Edit morning sheet opens. Press and drag 10–14px on a block (touch or mouse) and release: nothing opens.
6. **Morning editor Type row**: in the sheet, tap the word `Type`: the type picker gets focus (opens on iOS).
7. **Morning settings rows**: Morning → Settings tab. Tap the words `Pace` or `Wake-up routine`: the number field gets focus; the row lifts to `--surface-2` while pressed.
8. **Trends lift row**: `/trends`, tap a lift row anywhere: the lift sheet opens. Close it: focus returns to that row. The row's second line ("2 sessions · Oct 11") is never cut with an ellipsis.
9. **Trends effort rows** (only when runs with heart-rate exist): a tap anywhere on a row opens that day on Today.
10. **Journal quote rows**: `/journal/quotes`. Tap the words of a quote: a sheet opens with the full quote, author, theme in caps and a `Star`/`Unstar` button (`Delete` too for a quote you added); Enter on the focused words does the same. Tap the star at the row's edge: it toggles the favorite and opens nothing. On the Journal page, tap the words of today's quote: the same sheet. Tap the words of the "From your journal" memory: that entry's editor opens.
11. **Settings rows**: `/settings`. Tap the words `Import` / `From your old log`: the file chooser opens; the right side reads `Import ›`. There is no second "Choose File" control in the tab order. `Sign out` is a red whole-row button.
12. **Tab bar**: the bottom bar is `<nav aria-label="Views">` containing a `role="tablist"` with five `role="tab"` links, the current one `aria-selected="true"`.
13. **Stamp readouts**: inspect a stamped stat on the Morning hero or Trends hero: `role="img"` with `aria-label` such as `Wake 7:15 AM` / `This week 0.0 miles, −12.2 miles vs avg`; the visual children inside that stat are `aria-hidden`.
14. **Pull to refresh**: on `/today`, `/plan` or `/trends`, at the top of the page, drag straight down about 90px: a 24px ring slides in under the status bar and fills; it is full and there is one haptic tick at ~90px; let go: the ring sits full and still while the months, bootstrap, to-dos and lifts refetch (network tab shows `/api/months/...`), then fades. A 60px pull shows the ring and lets go with no fetch. A sideways swipe with some downward drift (a to-do swipe) never shows the ring. On `/journal`, `/morning` and `/settings` nothing happens.
15. **Dynamic Type**: in DevTools run `document.documentElement.style.fontSize='135%'`. Everything scales; the aura stats go 2×2, the session sheet's four stamps go 2×2, the three-up strip under the Today hero keeps three columns with the number at the 22 size and "of 26 mi" under it, page titles step to the 28 size (37.8px rendered at 135%) and wrap on words, Trends habit names take two lines instead of truncating, the orb row stays a row, no horizontal scrollbar on any tab. Reset with `''`. At 100% nothing changes from the pixel scale (body 17/22, titles 44); on a 360px phone the hero keeps four stat columns.
16. **Reduced motion**: emulate `prefers-reduced-motion: reduce`. Tab changes still fade in (200ms); a sheet appears without the slide; on a day with a route the line is already drawn; orbs light without the bloom.
17. **Contrast**: placeholders ("Add a habit", "What's on your mind today?") are at 50% white; link words, `Reset`, ghost/soft buttons and the done chip are `#7a84ff`; past timeline blocks on Morning keep their words readable; a past free slot is quieter than a coming one (border and words one step down).
18. **Tap targets**: Add (36px) buttons, chips (32px), small icon buttons, the toast's Undo and section-head links all take a 44px tap (the hit area extends with `::after`); the Share pill and Morning `Edit` are 44px visible. On a 320 phone the Morning eyebrow stays on one line beside the pill (the duration caps are hidden).

## 3. Left out or not finished

- `features/day`, `features/plan`, `features/sessions`, `features/share` were not edited (other teams). Things in those folders that this brief asks for and that the primitives could not reach:
  - Today's `Stat` strip passes `AnimatedNumber` nodes, so `Stat` cannot build its readout; pass `read="Week 6.0 of 26 miles"` etc. (`Stat` now accepts it).
  - The aura stats in `DayView.tsx` (Hero), `PlanView.tsx` (DayAura, PlanAura) and `SessionCard.tsx` (SheetHead) still render raw spans; replace each with `<AuraStat label value unit note />` from primitives to get the "Distance 6.0 miles" readout.
  - To-do rows (`DayView.tsx` TodoRow): the name button already fills `lrow-main`; the `lrow-right` (carried date) is not part of the tap.
  - `sessions.css`: `.assess.v-on .assess-head` uses `--ok` as text (3.2:1) → `--accent-text`; `.srow.s-skipped .srow-main { opacity: .55 }` and `.mv-day.is-dim { opacity: .4 }` fade text below 4.5:1 (not in the audited states, but the same pattern); `.srow-chev` at `--ink-4` → `--ink-3`.
  - `plan.css`: `.mcell.out { opacity: .35 }` is overridden by `.dcell.out:not(.is-sel)` in ui.css; the Plan team can delete their rule.
  - `day.css`, `plan.css`, `sessions.css`, `share.css` still have px font sizes; they do not scale with Dynamic Type until converted to rem (16px = 1rem). The rest of the app scales around them.
- Dynamic Type scaling relies on the `-apple-system-body` keyword on iOS WebKit; it was verified here by forcing the root font size (the same code path the app takes), not on a device. A Mac Safari user agent was verified to get no probe and no scaling.
- Pull to refresh is touch-only (no mouse gesture) and is not shown on the desktop rail layout.
- Morning timeline blocks are not themselves buttons (the `Timeline` component is another team's): the tap is delegated from a wrapper, so VoiceOver reaches the editor through the hero card and the blocks read as content.
- The `QuoteSheet` keeps its own star state while it is up (the list and hero update through the mutation's cache write); it does not re-read the quote if it changes elsewhere while open.

## 4. Shared-file edits needed from the integrator

- None required for this branch to build or run. `docs/brand.md` and `docs/design-spec.md` carry the two one-line edits the reviewers asked for. Optional and recommended edits in the other teams' folders are listed in §3.

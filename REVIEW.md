# Review notes: Interaction & Accessibility

Branch `worktree-agent-a4f6a79b7d435e27a`. Served for review on **http://localhost:8801** (sign in `josh@example.com` / `password123`), from this worktree's `apps/web/dist` through `apps/api` with the seed `test.db`.

Audit numbers (Playwright over 18 screen/sheet states × iPhone 14 at 100%, 120%, 135% root font size, and 320×640; script: scratchpad `a11y-audit.mjs`):

| check | before | after |
| --- | --- | --- |
| tap targets under 44×44 (day cells exempt from the width rule) | 12 | 0 |
| icon-only controls without a label | 0 | 0 |
| text/background pairs under WCAG AA (4.5:1, 3:1 for large) | 128 | 0 |
| horizontal overflow / clipped nowrap stamps and titles | 0 | 0 |

Behaviour checks (`a11y-behaviour.mjs`): 36/36 pass.

## 1. Files changed

- `apps/web/src/styles/tokens.css` — adds `--accent-text` (#7a84ff, the blue as a word at ≥4.5:1 on black and on a card) and `--r-sm`.
- `apps/web/src/styles/base.css` — `html { font-size: 100% }`, body and the type scale in rem; `.page` becomes a size container (`page`); `a` uses `--accent-text`; reduced-motion block also stops smooth scroll.
- `apps/web/src/styles/ui.css` — every font-size/line-height in rem; container queries that wrap stat strips 2×2 and step titles down when the page or card is narrow in rem; `.lrow.tappable` press state, hover, `button/a/label.lrow` resets, `.lrow-verb`/`.lrow-chev`; 44px hit areas for `.btn.sm`, `.chip-btn`, `.icon-btn.sm`, `.toast-act`, `.link` (min-width 44); `--accent-text` on links, ghost/soft buttons, done chip, ok stat/verdict/note; placeholders at `--ink-3`; `.sheet` size container and 48px `.sheet-foot .btn.primary`; `.sh-stats` 2×2 in a narrow sheet; `.aura-pill`/`.aura-share` at 44px tall; `.aura` size container with 2×2 stats; `.dcell.out` stays readable (ink-3 number, dots at half); reduced-motion rules for the route draw, orb bloom, mark and meter.
- `apps/web/src/ui/primitives.tsx` — `Row` gains `href`, `as="label"`, `label`, and ignores taps that land on a control inside it (`onOwnControl`); `Stat` reads as one line (`role="img"` + `aria-label`, or `read` prop); new `AuraStat`, `readStat`, `unitWords`.
- `apps/web/src/ui/Sheet.tsx` — focus trap (Tab cycles inside, first control focused, focus returned to the opener on close), `#root` made `inert` while a sheet is up, `aria-labelledby` the title, instant open/close under reduced motion.
- `apps/web/src/app/Shell.tsx` — tab bar is `role="tablist"` with `role="tab"`/`aria-selected`; rail and tab icons `aria-hidden`; new `PullToRefresh` on Today, Plan and Trends (24px ring, refetches months, bootstrap, to-dos, lifts, activities).
- `apps/web/src/app/shell.css` — rem sizes; page fade kept at 200ms under reduced motion; `.ptr` ring styles; rail active link uses `--accent-text`.
- `apps/web/src/app/dynamicType.ts` (new) — measures `-apple-system-body` and scales the root font size by (measured / 17); no-op where the keyword is unknown, so the brand scale stays at 100%.
- `apps/web/src/app/App.tsx` — starts `watchDynamicType()` once.
- `apps/web/src/features/morning/MorningView.tsx` — hero card is the button (role, label, press, keyboard) with an `Edit` pill; `TapToEdit` wrapper opens the editor from a tap on any timeline block (the `Timeline` component itself is untouched); Type row and the settings rows are labels so a tap anywhere focuses the control; stamps use `AuraStat`.
- `apps/web/src/features/morning/morning.css` — rem sizes; block press states and cursor; past blocks dim the bar/border instead of fading text below 4.5:1; narrow-card step-downs; the range under a stamp hides when the page is narrow in rem.
- `apps/web/src/features/trends/TrendsView.tsx` — `Stamp` reads as one line; effort rows open the day (whole-row tap, label, chevron).
- `apps/web/src/features/trends/trends.css` — rem sizes; container step-downs for the hero stamps, the strip, the lift rows (sparkline/change hidden) and the consistency labels; chevron at ink-3.
- `apps/web/src/features/settings/SettingsView.tsx` — Import, Add to Home Screen and Run sync (web: an anchor row, native: a button row) are whole-row actions with a verb/chevron at the right; Reconnect/Disconnect stay two buttons.
- `apps/web/src/features/settings/settings.css` — rem sizes; tappable row title in ink, Sign out stays red.
- `apps/web/src/features/journal/JournalView.tsx` — quote rows are `role="checkbox"`: a tap anywhere toggles favorite, Delete keeps its own 44px control; chevrons/stars inside rows `aria-hidden`.
- `apps/web/src/features/journal/JournalDaySection.tsx` — the entry star stops propagation.
- `apps/web/src/features/journal/journal.css` — rem sizes; the entry body carries the left gutter so the tap starts at the group edge; quote row press state; placeholders at ink-3.
- `apps/web/src/features/auth/auth.css` — rem sizes; the screen is a size container so the title steps down at a larger text size.
- `REVIEW.md` — this file.

## 2. What to verify by hand (http://localhost:8801, iPhone-size viewport, touch emulation on)

1. **Today, Share pill**: open `/today/2026-10-04`. The `Share` pill in the hero's top-right is 44px tall. Tap it: the Share sheet opens, the `Share` button at the bottom is 48px tall. Press Tab repeatedly: focus never leaves the sheet. Press Escape: the sheet closes and focus is back on the Share pill (a focus ring shows if you were using the keyboard).
2. **Sheet is modal**: with any sheet open, inspect `#root`: it has the `inert` attribute; after close it does not.
3. **Morning hero**: `/morning`. Tap anywhere on the hero card (not only the `Edit` pill): the Edit morning sheet opens. Its `Done` button is 48px tall.
4. **Morning timeline**: tap any block (Wake up, the run, Free, Leave for work): the Edit morning sheet opens. A drag of more than 8px on a block does not open it.
5. **Morning editor Type row**: in the sheet, tap the word `Type` (not the picker): the type picker gets focus/opens.
6. **Morning settings rows**: Morning → Settings tab. Tap the words `Pace` or `Wake-up routine`: the number field at the right gets focus.
7. **Trends lift row**: `/trends`, tap a lift row on its name or anywhere else: the lift sheet opens. Close it: focus returns to that row.
8. **Trends effort rows** (only when runs with heart-rate exist): tapping anywhere on a row opens that day on Today.
9. **Journal quote rows**: `/journal/quotes`. Tap anywhere on a quote row: the star fills (favorite) and the row is `role="checkbox"` with `aria-checked`. Tap again to unstar. On a quote you added, the trash icon deletes without toggling the star.
10. **Journal entries**: `/journal`. Tap the left edge of an entry (the 16px gutter): the editor sheet opens. Tap its star: the star toggles and no sheet opens.
11. **Settings rows**: `/settings`. Tap the words `Import` / `From your old log`: the file chooser opens. `Sign out` is a red whole-row button.
12. **Tab bar**: the bottom nav is `role="tablist"`, each tab `role="tab"`, the current one `aria-selected="true"`.
13. **Stamp readouts**: inspect any stamped stat on the Morning hero or Trends hero: `role="img"` with `aria-label` like `Wake 7:15 AM` / `This week 0.0 miles, −12.2 miles vs avg`; the visual children are `aria-hidden`.
14. **Pull to refresh**: on `/today`, `/plan` or `/trends`, at the top of the page, drag down ~100px: a 24px ring slides in under the status bar and fills; past the threshold there is one haptic tick; let go: the ring sits full while the months, bootstrap, to-dos and lifts refetch (network tab shows `/api/months/...`), then fades. On `/journal`, `/morning` and `/settings` nothing happens.
15. **Dynamic Type**: in DevTools run `document.documentElement.style.fontSize='135%'`. Everything scales; the aura stats go 2×2, the three-up strip under the Today hero wraps 2+1, page titles step down to 28px and wrap on words, the orb row stays a row, no horizontal scrollbar on any tab. Reset with `''`. At 100% nothing changes from the pixel scale (body 17/22, titles 44).
16. **Reduced motion**: emulate `prefers-reduced-motion: reduce`. Tab changes still fade in (200ms); a sheet appears without the slide; on a day with a route the line is already drawn; orbs light without the bloom.
17. **Contrast**: placeholders ("Add a habit", "What's on your mind today?") are at 50% white; link words, `Reset`, ghost/soft buttons and the done chip are `#7a84ff`; past timeline blocks on Morning keep their words readable (no 60% fade on text).
18. **Tap targets**: Add (36px) buttons, chips (32px), small icon buttons, the toast's Undo and section-head links all take a 44px tap (the hit area extends with `::after`); the Share pill and Morning `Edit` are 44px visible.

## 3. Left out or not finished

- `features/day`, `features/plan`, `features/sessions`, `features/share` were not edited (other teams). Things in those folders that this brief asks for and that the primitives could not reach:
  - Today's `Stat` strip passes `AnimatedNumber` nodes, so `Stat` cannot build its readout; pass `read="Week 6.0 of 26 miles"` etc. (`Stat` now accepts it).
  - The aura stats in `DayView.tsx` (Hero), `PlanView.tsx` (DayAura, PlanAura) and `SessionCard.tsx` (SheetHead) still render raw spans; replace each with `<AuraStat label value unit note />` from primitives to get the "Distance 6.0 miles" readout.
  - To-do rows (`DayView.tsx` TodoRow): the name button already fills `lrow-main`; the `lrow-right` (carried date) is not part of the tap.
  - `sessions.css`: `.assess.v-on .assess-head` uses `--ok` as text (3.2:1) → `--accent-text`; `.srow.s-skipped .srow-main { opacity: .55 }` and `.mv-day.is-dim { opacity: .4 }` fade text below 4.5:1 (not in the audited states, but the same pattern); `.srow-chev` at `--ink-4` → `--ink-3`.
  - `plan.css`: `.mcell.out { opacity: .35 }` is now overridden by `.dcell.out:not(.is-sel)` in ui.css; the Plan team can delete their rule.
  - `day.css`, `plan.css`, `sessions.css`, `share.css` still have px font sizes; they do not scale with Dynamic Type until converted to rem (16px = 1rem). The rest of the app scales around them.
- Dynamic Type scaling relies on the `-apple-system-body` keyword, which only WebKit on Apple platforms knows; it was verified here by forcing the root font size (the same code path the app takes), not on a device.
- Pull to refresh is touch-only (no mouse gesture) and it is not shown on the desktop rail layout.
- Morning timeline blocks are not themselves buttons (the `Timeline` component is another team's): the tap is delegated from a wrapper, so VoiceOver reaches the editor through the hero card and the blocks read as content.
- `docs/brand.md` §3 was not edited; `--accent-text` should be added to its colour table (one row: "the blue as a word").

## 4. Shared-file edits needed from the integrator

- None required for this branch to build or run. Optional and recommended for the other teams' folders, listed in §3.

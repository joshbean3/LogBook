# Foundation review: navigation, primitives, motion, haptics, type and rhythm

Scope: `docs/experience.md` §2 (navigation) and §3 (foundation). The page teams' manual is `docs/foundation.md`; every
primitive is live at `/dev/ui`.

## Files changed and why

**Motion and haptics**
- `apps/web/src/lib/motion.ts`: `springs` exactly as §3.2 (press, lift, settle, sheet, page, number, complete), `ease`
  kept; `fadeIn`/`fadeOut`/`colorTween`; reduced-motion helpers (`reducedFade`, `motionFor`, `useMotionFor`, `useReduced`);
  `rowPresence` for list insert/remove. `pageVariants` lost the y offset, `listVariants` the stagger. Old `spring`,
  `springSoft`, `tween` kept as deprecated aliases.
- `apps/web/src/lib/haptics.ts`: named API (`haptics.select/toggle/orb/lift/drop/threshold/success/celebrate/delete/warning/error`)
  mapped to @capacitor/haptics (selectionStart/Changed/End with a 600ms idle end, ImpactStyle Light/Medium/Heavy,
  NotificationType), `navigator.vibrate` fallback off-native. `select` throttled to 40ms. Preference `logbook.haptics`
  (default on) with `getHapticsEnabled/setHapticsEnabled/useHapticsEnabled` (kept in step across components and tabs).
  `haptic(kind)` kept as a deprecated alias (tick → toggle, success → success, warn → warning). Every fired haptic is also a
  `logbook:haptic` window event so /dev/ui and tests can see it.

**Primitives (`apps/web/src/ui/`)**
- New: `Pressable.tsx`, `ContextMenu.tsx` (+ `useContextMenu`, `ContextMenuProvider`), `SwipeRow.tsx`, `Ticker.tsx`,
  `useFirstToday.ts`, `Skeleton.tsx`, `WeekRing.tsx`, `headers.tsx` (`TabHeader`, `PushedHeader`, `BackButton`),
  `PushedPage.tsx` (pushed-route frame: slide-in, edge swipe back), `Avatar.tsx`, `DatePager.tsx`, `nav.ts` (tab model and
  route info), `useLongPress.ts` (one hold grammar), `inert.ts` (shared inert/focus helpers), `index.ts` (barrel).
- `Sheet.tsx`: v2. Stack (`push`/`pop`) inside one sheet with a back chevron, `detent: 'large'`, one header (eyebrow +
  serif title + close), header-only drag dismiss, shared-element title (`layoutId` + `shared(id)` on the opener).
  `open/close/update` unchanged.
- `Toast.tsx`: placed by a host, sized to its words, Undo 44px, `springs.settle`, reduced-motion fade.
- `AnimatedNumber.tsx`: now an alias of `Ticker`.
- `primitives.tsx`: `Loading` draws a neutral skeleton block (no spinner, no words on screen); `Spinner` deleted;
  `EmptyState` v2 (ghost + verb + starters, v1 props unchanged); new `Section`; `Mark` takes a `haptic` event;
  `Segmented` and `Stepper` fire `haptics.select()`; `PageHeader` adds the back chevron on pushed pages and the avatar on
  tabs (and the ringed avatar on Settings).

**Navigation (`apps/web/src/app/`)**
- `App.tsx`: routes per §2. `/progress` renders `TrendsView`; `/trends` redirects. `/morning/:date?`, `/reads/:tab?`,
  `/settings/:section?` and `/dev/ui` render inside `PushedPage`. `/welcome/*` is full screen (no Shell). Boot shows
  `SkeletonPage`. `ContextMenuProvider` mounted. Page arrival: 120ms fade on tab pages, none on pushed pages (they slide).
- `Shell.tsx`: four tabs (bar and rail) from `ui/nav`; owning tab lit for pushed pages; `haptics.select()` on tab change;
  re-tap scrolls to top, then goes to the tab root, then fires `logbook:tab-reselect`; rail footer is the avatar →
  Settings; pull-to-refresh fires `haptics.threshold()` and covers Progress. Net pill and offline behaviour untouched.
- `shell.css`: 4 columns, 44px tabs, 120ms fade, pushed-page frame, transitional rule hiding Today's old gear.
- `app/dev/UiGallery.tsx` + `gallery.css`: the living gallery.

**Styles**
- `styles/foundation.css` (new): section titles, 48/24/12 rhythm, `.list-edge`, `.carousel`, the halo state classes
  (`.halo-done/.halo-floor/.halo-missed/.halo-upcoming/.halo-rest`, 200ms crossfade, also driving `.aura-glow`,
  `.halo-boost`), and every primitive's styles.
- `styles/tokens.css`: added (none removed) `--halo-amber`, `--scrim`, `--scrim-menu`, `--r-menu`, `--dur-in/out/color`,
  `--sp-primary/secondary/group`, `--page-pad`, `--dpager-gap`, `--hit`.
- `styles/base.css`: `--page-pad` is 40px beside the rail.
- `styles/ui.css`: removed `.spinner`/`.loading`; `.skeleton` no shimmer; sheet scrim 78% (brand §5), `.sheet.large`,
  no horizontal overflow in sheets; toast positioned by its host, 22px radius so two lines read as a card.

**Elsewhere**
- `apps/web/src/main.tsx`: one `LayoutGroup` around the app (motion layoutIds across subtrees).
- `apps/web/src/features/onboarding/Welcome.tsx`: 10-line placeholder for `/welcome/*` (onboarding team replaces it).
- No other file under `features/**` changed.
- `docs/foundation.md` (new): the manual. `docs/brand.md`: §9 Motion rewritten to the new springs (only that section).

## Verify by hand

Build and run as in the brief, sign in (josh@example.com / password123), use a phone-sized viewport with touch.

**/dev/ui** (open the URL; not in the tab bar)
1. Haptics: tap each chip; the bottom pill names the event. Untick "Haptics": chips fire nothing (pill stops changing).
2. Springs: tap each row; `complete` overshoots, the others do not.
3. Pressable: "Hold me" says "Long-pressed (touch)" after ~0.45s and its tap does not fire; "Disabled" does nothing.
4. Context menu: hold "Easy 6": the row lifts, the page dims and blurs, the menu sits below; pill shows `lift`. Tap Move →
   toast. Tap outside / swipe down / Escape close it. Scroll so "Long 12" is near the bottom and hold it: its preview card
   lifts and the menu sits above. Tab to the row and press Shift+F10; arrows move, Escape returns focus to the row. Tab onto
   the hidden "Easy 6 actions" button: it shows as a pill.
5. Swipe rows: swipe "Buy trail shoes" right past ~40% (pane turns blue, pill shows `threshold`), release → checked. Swipe
   less → springs back. Swipe out and back across the line → two `threshold`s. Drag far → rubber band. Scroll vertically
   starting on a row → the page scrolls, the row does not move. Swipe left → Later (amber); last row left → Delete + Undo.
   Hold a row → menu lists Done, Later/Delete, Copy.
6. Ticker: +3.1 springs; the 42 counts up only on the first view of the day ("Replay first views" resets it). Week ring
   fills once a day.
7. Skeletons and empty states: grey blocks, no shimmer; v2 starters add with a check and `toggle`.
8. Tab header: tap the date line (toast), swipe it left/right (toast + `select`); the long title steps down to 28.
9. Date pager: drag the card left past 30% or fling → next day (header meta changes, `select`); short drag springs back;
   focus it and press arrows; "Back to today" slides in from the side it lies on.
10. Sheets: "Open + push" → Push (slides in, back chevron), chevron pops, Escape closes and focus returns. "Large detent"
    fills the screen less a peek. Tap "Tempo 5": the title flies into the sheet header and home again on close. Drag the
    sheet header down to dismiss.
11. Toast: Short / With Undo (44px Undo) / Long (wraps into a rounded card, never wider than the screen).
12. Type and rhythm: sentence-case titles with 48/24 spacing, edge-to-edge list with gutter hairlines, snap carousel of
    halo states, halo crossfade chips (floor shows amber, missed dims).
13. Edge swipe: from the left 20px drag right: the page follows; past 35% (or a fling) it goes back.

**Tabs and pages**
1. Four tabs; switching is a cut with a short fade (no slide) and `select`.
2. Today: scroll down, tap Today → scrolls up; tap again → back to today's date. Plan the same → this week.
3. Journal → Reads link: Reads slides in, Journal stays lit, chevron says "Back to Journal"; chevron or edge swipe returns.
4. Any tab header avatar → Settings: no tab lit, the avatar wears the ring; back returns.
5. `/morning`: Today lit, chevron "Back to Today". `/trends` lands on `/progress`. `/welcome` has no tab bar.
6. Pull down from the top of Today/Plan/Progress: the ring fills and arms (threshold haptic), release refreshes.
7. Open sheets on each page (Today Add, a Plan session → Edit, a to-do, a journal entry): they open, close, and focus returns.

## What I ran

- Gates: `pnpm -r --filter @logbook/shared --filter @logbook/api --filter @logbook/web exec tsc --noEmit -p .` (clean),
  `pnpm --filter @logbook/shared test` (13 passed), `pnpm --filter @logbook/api test` (22 passed),
  `pnpm --filter @logbook/web build` (clean).
- Playwright at 390×844 and 320×568 (deviceScaleFactor 2, isMobile, hasTouch), CDP touch for long-press, swipe, drag and
  edge swipe, plus a reduced-motion pass: no console errors, no horizontal overflow on any page or the gallery, every
  interactive gallery target ≥ 44px. Scripts and shots: the session scratchpad `foundation/` folder (`all.sh`, `shots/`).

## Left out, on purpose

- Page restructuring (TabHeader/PushedHeader/DatePager adoption, page skeletons, SwipeRow on to-dos, etc.): page teams.
  Pages keep the v1 `PageHeader`, which now shows the chevron/avatar itself.
- **No in-app link to Morning** now that it has no tab: the Today team adds it (hero / mini timeline → `/morning`).
- The Haptics switch in Settings: the settings team (hook ready: `useHapticsEnabled`).
- Soft/Rigid impacts need a native plugin; `orb` and `drop` use Light until then.
- Onboarding routing (`onboardedAt = null` → `/welcome`) and the real Welcome flow: onboarding/platform teams.
- The sheet's shared element is a hand-made FLIP of the title only (motion's projection mis-measures between the scrolled
  page and the fixed sheet); tone bar / route line travel is not built.
- `/dev/ui` is routed in production builds too (lazy chunk, not linked, not prefetched), so reviewers can use it on the
  deployed app.

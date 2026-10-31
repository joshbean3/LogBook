# Logbook system, v5: one language

This is the binding contract for every screen. It replaces the per-feature dialects added in October (the warm "feel" palette, the day-planner board, the Strava sheet kit, the One Year garden). `docs/brand.md` still decides colour, type and voice; this document says how those values become screens, and what is forbidden. When a screen and this document disagree, this document wins.

## 1. The verdict we are fixing

Five tabs share one chrome (NavBar, Sheet, ContextMenu, Toast, tab bar) and five content dialects. Today alone stacks a black-and-blue hero, a yellow goal sun with emoji cards, and green/blue/red section pills. Goals is a four-colour orbit with sparks and a full-screen celebration. Journal is monospace periwinkle. Progress is empty. The reader can tell which team built which band.

The target: a user opens any tab and cannot tell where one feature ends and the next begins.

## 2. Information architecture

Four tabs. Every tab root carries the Ask bar as its first row.

| Tab | Title | Job |
|---|---|---|
| Today | Today / Tomorrow / Sat 24 | Today's workout, the day's goal, the schedule and to-dos, habits, the week line. |
| Goals | Goals | The day, week, month and year goals as one stack. The day goal is the same object Today shows. |
| Plan | Workout Plan | The progress strip (collapsed, expands to charts, routes, records), the week, the block, the plan library and builder. |
| Journal | Journal | The logbook: a page per day built from what happened, plus what you wrote. |

Removed from navigation: Progress (folded into Plan), the Library segment, Reads, the Morning tab's descendants except the morning sheet. Settings stays pushed from Today's avatar.

## 3. Tokens (`apps/web/src/styles/tokens.css`)

Colour: `--bg`, `--surface`, `--surface-2`, `--surface-3`, `--ink` / `-2` / `-3` / `-4`, `--line`, `--line-strong`, `--accent`, `--accent-bright`, `--accent-text`, `--accent-tint`, `--halo`, `--halo-amber`, `--ok`, `--warn`, `--bad`, the seven `--t-*` session tones.

Deleted: `--sun`, `--mint`, `--coral`, `--sky`, every `--g-*` gradient, `--mono`, `--j-ink`, `--j-ink-soft`, `--star`, `--sun-ink`. Goal levels and schedule bands carry no hue: a level is a caps label, a band is a caps label.

Radius: `--r-card` 20, `--r-group` 12, `--r-control` 9, `--r-pill`. Nothing else.

Type (rem only; `px` in a `font` declaration is a build error):

| Token | Size / line | Face | Use |
|---|---|---|---|
| `--fs-display` | 34 / 40 | Instrument Serif italic | Tab titles |
| `--fs-sheet` | 28 / 34 | Instrument Serif italic | Sheet titles, one goal's text |
| `--fs-stamp` | 28 / 34 | Inter Tight 800 | The hero's name, a stat |
| `--fs-title` | 22 / 28 | Inter 600 | A card's title |
| `--fs-head` | 17 / 22 | Inter 600 | Section titles, row titles |
| `--fs-body` | 17 / 22 | Inter 400 | Body |
| `--fs-sub` | 15 / 20 | Inter 400 | Row subtitles |
| `--fs-foot` | 13 / 16 | Inter 400 | Captions, units |
| `--fs-caps` | 11 / 13 | Inter 600, +0.12em, uppercase | Eyebrows, metric labels |

Spacing: 48 before a primary section, 24 before a secondary one, 12 inside a group, 16 gutter, 44 hit.

Shadow: none on the canvas. `--shadow-sheet` and `--shadow-menu` only. No glow, no blur, no gradient except the halo and the orb's ring.

## 4. The ten primitives (`apps/web/src/ui/`)

Every screen is built from these and nothing else. A feature folder may not define a button, a check, a ring, a pill, a stat tile, an empty state, a segmented control or a FLIP engine of its own.

1. `Pressable`: the one press (scale, surface, dim), the one hold (450 ms) and hold menu.
2. `Button`: `primary` (white pill), `soft` (accent tint), `quiet`, `danger`; heights 32, 44, 48.
3. `Mark`: the one check. `circle` (sessions, habits, goal steps) or `square` (to-dos). Statuses done / floor / missed / open / rest / skipped. 22 or 28.
4. `Orb`: the habit light, 56, serif initial, accent ring when lit. The only object that glows.
5. `Ring` and `WeekRing`: stroke rings on `springs.number`.
6. `Card`: `--surface`, 20 radius, 6% border. `hero` adds the halo. `StatRow` inside it: caps labels over stamps, hairline above, 2 to 4 columns.
7. `Group` + `Row`: inset list, 12 radius, 44 or 60 rows, hairlines from the gutter. `SwipeRow` lives inside a Group.
8. `Segmented`: 44 (full width) or 32 (in a bar).
9. `SectionHead`: a 17/600 title in sentence case, or an 11 caps eyebrow for a metric block. Meta on the right. Nothing else.
10. `EmptyState`: one sentence, one verb, optional ghost.

Chrome, unchanged: `NavBar` (caps line, serif 34 title, trailing slot), `PushedBar`, `Sheet` (28 serif title, `sheet-foot`), `ContextMenu` (at most 4 items), `Toast` with Undo.

New in v5: `AskBar` moves to `ui/` and takes a `context` prop (the tab and its visible object) so every tab's assistant knows where it was asked.

## 5. Patterns

- One hero per tab, a `Card hero`. Everything under it is list weight.
- A section is a `SectionHead` and either a `Group` or an edge-to-edge list. Never two identical cards in a row. Never a card inside a card.
- Status is a word from `packages/shared/status.ts` beside a `Mark`. Colour is never the only signal.
- Every write is optimistic and gets a toast with Undo when it is destructive or moves something.
- Every gesture has a visible fallback in the object's hold menu.
- Completion is the one celebration: the `Mark` pops once on `springs.complete`, one haptic. No confetti, sparks, flashes, blobs, points or levels.
- Time of day changes words, never layout. The hero's subtitle says "Out the door in 22 min" or "Back by 8:13"; the hero does not become another card.
- Empty states name the state and offer one verb. Setup never replaces a page.

## 6. Forbidden

Emoji as icons. Hard-coded colours outside `tokens.css`. `px` font sizes. Radii other than the four. Box-shadows other than the two. Gradient fills behind text. A second check-mark, button, pill or segmented style. A feature-local motion engine. Monospace. Caps eyebrows where the content names itself. A page that is replaced wholesale by a setup card.

## 7. The agent

The assistant is one object across the app: one persisted conversation per user, one `AskBar` on every tab, one proposal model (propose, Apply, Undo) with one exception: a single, obviously reversible change asked in plain words ("check stretch", "move my run to Friday") applies at once with an Undo toast. Its operations cover sessions, to-dos, goals, habits, reminders and plan selection. It reads the plan, the week's runs, habits and goals; it does not see journal entries unless asked.

## 8. Review checklist

1. Could a reader tell which feature a band belongs to by its colours or radii? If yes, it fails.
2. Every colour, size and radius resolves to a token.
3. One hero, one accent element, one celebration.
4. Every section is a `SectionHead` over a `Group` or list.
5. Every check is a `Mark`; every button a `Button`.
6. 390 and 320 wide with no horizontal overflow; 44 px targets.
7. Typecheck clean; tests pass; console clean.

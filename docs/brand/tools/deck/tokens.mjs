// Generates docs/brand/tokens.json and docs/brand/tokens.css from one table, so the two never drift.
import fs from 'fs';
const OUT = '/home/user/LogBook/docs/brand';

// [cssName, value, role, replaces (old app value or null), group]
const T = [];
const add = (group, rows) => rows.forEach(([name, value, role, replaces]) => T.push({ group, name, value, role, replaces: replaces ?? null }));

add('palette', [
  ['--sky', '#38B6F2', 'Sky. The signature fill: the Orb body, selected day, active tab disc, primary button, selected segment. Never text on light grounds (2.26 on Paper).', 'feel --sky #4f74e8'],
  ['--deep-sky', '#0A6CA6', 'Deep Sky. Blue words and links (5.57 on Paper), the gauge fill, done dots, the far hill.', null],
  ['--haze', '#CBE8F8', 'Haze. Tracks, icon tiles, the top of the dawn wash, chart tints.', null],
  ['--cloud', '#EAF5FC', 'Cloud. The app ground and segmented tracks.', null],
  ['--paper', '#FFFDF8', 'Paper. Cards, sheets, the ask bar, the tab capsule.', null],
  ['--linen', '#F6F0E5', 'Linen. Brand paper only: splash variant, store art, share cards, the deck. Never app chrome.', null],
  ['--night-ink', '#0E2236', 'Night Ink. All primary text, the wordmark.', null],
  ['--dusk', '#46596D', 'Dusk. Muted text, captions, metadata. The lightest neutral text color (Deep Sky and Ember are lighter colored text).', null],
  ['--graphite', '#33475B', 'Graphite. Dusk under Increase Contrast (9.42 on Paper).', null],
  ['--pencil', '#7A8794', 'Pencil. Non-text marks only: ticks, hairline dots, disabled glyphs (3.61 on Paper).', null],
  ['--twilight', '#1B4870', 'Twilight. Dark brand ground (night splash, dark icon, deck section slides).', null],
  ['--sunrise', '#F2600C', 'Sunrise. The accent and the now-mark: today dot, gauge pointer, badge dot, the stamp. A fill, never text on light.', 'accent #f2600c'],
  ['--apricot', '#FFB680', 'Apricot. Light, not ink: the Orb underlight, the hero glow, the horizon in brand art.', null],
  ['--ember', '#B4430C', 'Ember. Orange words, rare: a Today tag, a streak label (5.51 on Paper).', 'accent-text #c2410c'],
  ['--white', '#FFFFFF', 'White. Text on dark grounds: dark brand surfaces, the Night Ink toast, Signal destructive fills (6.45), the caption on the hills.', null],
]);
add('brand-art', [
  ['--poster-sky-1', '#8DD0F5', 'Poster sky, top band.', null],
  ['--poster-sky-2', '#AEDDF8', 'Poster sky, middle band.', null],
  ['--poster-sky-3', '#CFEBFA', 'Poster sky, low band.', null],
  ['--horizon-1', '#F4E6D2', 'Horizon, cool end.', null],
  ['--horizon-2', '#FFD2AE', 'Horizon, warm end.', null],
  ['--hill-1', '#8FCDEE', 'Near hill.', null],
  ['--hill-2', '#4FA9DB', 'Middle hill.', null],
  ['--hill-3', '#0A6CA6', 'Far hill (Deep Sky).', null],
  ['--grain-opacity', '0.4', 'Paper grain over brand surfaces (35 to 50 percent, multiply). Never on app cards or chrome.', null],
]);
add('surfaces-and-ink', [
  ['--bg', '#EAF5FC', 'App ground (Cloud).', '#f3f8fb'],
  ['--surface', '#FFFDF8', 'Cards and sheets (Paper).', '#ffffff'],
  ['--surface-2', '#EAF5FC', 'Inset and track fill (Cloud).', '#eaf3f9'],
  ['--surface-3', '#CBE8F8', 'Tracks, icon tiles (Haze).', '#dceaf3'],
  ['--ink', '#0E2236', 'Primary text (Night Ink), 15.88 on Paper.', '#0f2a44'],
  ['--ink-2', '#46596D', 'Secondary text (Dusk), 7.10 on Paper.', '#2f5d85'],
  ['--ink-3', '#46596D', 'Muted text (Dusk).', '#57718a'],
  ['--ink-4', '#46596D', 'Captions, hints, axis labels (Dusk).', '#57718a'],
  ['--ink-faint', '#7A8794', 'Non-text marks (Pencil).', '#7c90a5'],
  ['--line', 'rgba(14, 34, 54, 0.10)', 'Hairlines inside cards.', 'rgba(15, 42, 68, 0.08)'],
  ['--line-strong', 'rgba(14, 34, 54, 0.18)', 'Stronger hairline: the off filter chip edge (decorative; the label carries the state).', 'rgba(15, 42, 68, 0.16)'],
  ['--edge', 'rgba(14, 34, 54, 0.12)', 'The 1 px edge of a secondary button, the composer, light swatches, Paper on Linen.', null],
  ['--tick', 'rgba(14, 34, 54, 0.22)', 'Minor gauge ticks. Decorative: the readout carries the value.', null],
  ['--tick-major', 'rgba(14, 34, 54, 0.5)', 'Major gauge ticks (3.20 on Paper).', null],
  ['--grid', 'rgba(14, 34, 54, 0.08)', 'Chart gridlines, the readout pill edge.', null],
  ['--grabber', 'rgba(14, 34, 54, 0.18)', 'The sheet grabber.', null],
  ['--coin-ring', 'rgba(14, 34, 54, 0.28)', 'The off habit coin ring. Decorative: the name and the check carry the state.', null],
  ['--dot-ahead', 'rgba(14, 34, 54, 0.10)', 'Habit week dots for days ahead.', null],
  ['--wash-bar', '#D0EAF8', 'Bottom stop of the sticky title bar (top stop Haze). The dawn wash scrolls with the page (background-attachment: scroll).', null],
  ['--wash-strip', '#DAEEFA', 'Top stop of the sticky week strip.', null],
  ['--wash-strip-end', '#E2F2FB', 'Bottom stop of the sticky week strip.', null],
  ['--welcome-warm', '#FFF1E4', 'The warm bottom stop of the welcome and splash grounds.', null],
  ['--entry-2', '#7FCBF3', 'Journal: a day with two entries (with the numeral 2 inside the disc).', null],
  ['--orb-arc', '#FF9F5A', 'The thinking arc. Decorative; the status line is the accessible signal. Not a Sunrise mark.', null],
  ['--field-edge', 'rgba(14, 34, 54, 0.5)', 'Edge of a field or empty check circle, 3.20 on Paper.', 'rgba(15, 42, 68, 0.5)'],
  ['--columbia', '#CBE8F8', 'Retired name: use --haze.', '#b9d9eb'],
  ['--columbia-wash', '#EAF5FC', 'Retired name: use --cloud.', '#e8f3f9'],
  ['--dawn', 'linear-gradient(180deg, #CBE8F8 0, #EAF5FC 300px)', 'The dawn wash: the ground of every tab root. Pushed pages and sheets are flat.', null],
]);
add('accent-and-primary', [
  ['--accent', '#38B6F2', 'Lit things (a done habit coin, selected day, active tab disc): Sky now. Orange moved to --now.', '#f2600c'],
  ['--accent-bright', '#5CC4F5', 'Pressed and hover lift of Sky.', '#ff7a2e'],
  ['--accent-ink', '#0E2236', 'Text and glyphs on Sky (7.03).', '#0f2a44'],
  ['--accent-soft', '#CBE8F8', 'Soft lit fill (Haze).', '#ffe6d6'],
  ['--accent-tint', 'rgba(56, 182, 242, 0.16)', 'Lit tint behind a row.', 'rgba(242, 96, 12, 0.14)'],
  ['--accent-text', '#0A6CA6', 'Blue words and links (Deep Sky), 5.57 on Paper.', '#c2410c'],
  ['--now', '#F2600C', 'The now-mark (Sunrise): today dot, gauge pointer, badge dot, stamp. Budget: 3 per screen, each with a 2 px Paper keyline.', null],
  ['--now-keyline', '#FFFDF8', 'The keyline around every Sunrise mark.', null],
  ['--now-text', '#B4430C', 'Orange words (Ember), 5.51 on Paper.', null],
  ['--primary', '#38B6F2', 'The primary button fill (Sky).', '#0f2a44'],
  ['--primary-ink', '#0E2236', 'The primary button label (Night Ink on Sky 7.03).', '#ffffff'],
  ['--primary-glow', '0 8px 18px -10px rgba(10, 108, 166, 0.45)', 'Under the primary button only.', 'navy-glow'],
  ['--halo', 'radial-gradient(60% 70% at 50% 110%, rgba(203, 232, 248, 0.95), rgba(203, 232, 248, 0) 70%)', 'Cool light from under a card.', 'Columbia halo'],
  ['--halo-amber', 'radial-gradient(60% 70% at 50% 110%, rgba(255, 182, 128, 0.42), rgba(255, 182, 128, 0) 70%)', 'The sunrise glow under the one hero card per screen.', 'orange halo rgba(242,96,12,.32)'],
]);
add('status', [
  ['--ok', '#0A6CA6', 'Success marks and words (Deep Sky).', '#2f5d85'],
  ['--ok-soft', '#EAF5FC', 'Success tint.', '#e1edf6'],
  ['--warn', '#E0A21B', 'Warning fill and mark (Marigold). Not text.', '#e08a00'],
  ['--warn-soft', '#FBF0D6', 'Warning tint.', '#fdf0d9'],
  ['--warn-text', '#7A5A00', 'Warning words, 6.28 on Paper, 5.63 on --warn-soft.', '#8f5800'],
  ['--bad', '#B42340', 'Errors and destructive words, 6.35 on Paper.', '#c8243f'],
  ['--bad-soft', '#F9E3E7', 'Error tint (bad on it 5.27).', '#fbe4e8'],
  ['--star', '#0A6CA6', 'A Favorite mark (Deep Sky). Not orange: orange means now.', '#f2600c'],
]);
add('data-tones', [
  ['--t-easy', '#117A74', 'Easy run (Lagoon), 5.09 on Paper. Glyphs, lines, 3 px markers; never a surface.', '#1e9e5e'],
  ['--t-long', '#0A6CA6', 'Long run (Deep Sky), 5.57.', '#2b6cd4'],
  ['--t-hard', '#7E3F8F', 'Tempo and intervals (Plum), 6.90.', '#e8650f'],
  ['--t-fast', '#B23A5B', 'Race and fast (Rose), 5.66.', '#d93275'],
  ['--t-lift', '#4A4FB0', 'Strength (Indigo), 6.80.', '#7b4fd6'],
  ['--t-cross', '#7D6210', 'Cross-training (Ochre), 5.70.', '#a57a35'],
  ['--t-rest', '#7A8794', 'Rest (Pencil), marks only.', '#8696a7'],
  ['--prio-1', '#B42340', 'Priority 1 flag.', 'var(--bad)'],
  ['--prio-2', '#7D6210', 'Priority 2 flag (Ochre, not orange).', 'var(--t-hard)'],
  ['--prio-3', '#0A6CA6', 'Priority 3 flag.', 'var(--t-long)'],
  ['--tag-red', '#B42340', 'To-do color red (Signal). Read as var(--tag-${c}) in features/todos/colors.tsx.', 'var(--bad)'],
  ['--tag-orange', '#7D6210', 'To-do color "orange" renders Ochre: orange means now. Rename the option when the app migrates.', 'var(--t-hard)'],
  ['--tag-yellow', '#E0A21B', 'To-do color yellow (Marigold). A mark, never text.', 'var(--warn)'],
  ['--tag-green', '#117A74', 'To-do color green (Lagoon).', 'var(--t-easy)'],
  ['--tag-blue', '#0A6CA6', 'To-do color blue (Deep Sky).', 'var(--t-long)'],
  ['--tag-purple', '#4A4FB0', 'To-do color purple (Indigo).', 'var(--t-lift)'],
  ['--tag-pink', '#B23A5B', 'To-do color pink (Rose).', 'var(--t-fast)'],
]);
add('feel', [
  ['--sun', '#FFB680', 'Plan your day disc and the goal sun (Apricot). Words on it are Night Ink (9.42).', '#f5b10a'],
  ['--sun-ink', '#0E2236', 'Words on --sun.', '#0f2a44'],
  ['--mint', '#117A74', 'Feel: calm (Lagoon).', '#1fbf86'],
  ['--coral', '#B23A5B', 'Feel: hard (Rose).', '#ef4f4f'],
  ['--g-sun', 'radial-gradient(120% 120% at 30% 25%, #FFE9D6, #FFC99F 55%, #FFB680)', 'Lit sun.', 'radial #ffe17a to #ff9f1c'],
  ['--g-mint', 'radial-gradient(120% 120% at 30% 25%, #BFEDE6, #5CC9B5 55%, #117A74)', 'Lit calm.', 'radial #9cf5c9 to #14b877'],
  ['--g-coral', 'radial-gradient(120% 120% at 30% 25%, #F8C6D0, #E07A92 55%, #B23A5B)', 'Lit hard.', 'radial #ffa38f to #f2304f'],
  ['--g-sky', 'radial-gradient(120% 120% at 30% 25%, #E4F6FE, #97D8F9 55%, #38B6F2)', 'Lit sky.', 'radial #c9dcf0 to #4f74e8'],
]);
add('depth', [
  ['--shadow-1', '0 1px 1px rgba(14, 34, 54, 0.04), 0 10px 28px -14px rgba(14, 34, 54, 0.20)', 'Every card and tile. The only card shadow.', 'craft.css layered navy + bevel'],
  ['--shadow-float', '0 1px 1px rgba(14, 34, 54, 0.05), 0 12px 28px -12px rgba(14, 34, 54, 0.28)', 'Floating chrome: ask bar, tab capsule, round buttons, avatar.', 'craft.css float'],
  ['--shadow-2', '0 18px 40px -16px rgba(14, 34, 54, 0.30)', 'Menus and popovers.', '0 12px 40px rgba(15,42,68,.14)'],
  ['--shadow-sheet', '0 -8px 40px rgba(14, 34, 54, 0.14)', 'Sheets.', '0 -8px 40px rgba(15,42,68,.12)'],
  ['--card-border', '1px solid transparent', 'Cards have no visible border; the 1 px keeps box sizes stable.', '1px solid rgba(15,42,68,.04)'],
  ['--glass', 'rgba(255, 253, 248, 0.88)', 'The rare frosted surface (status pill). Opaque Paper under Increase Contrast.', 'rgba(255,255,255,.82)'],
  ['--glass-blur', 'blur(18px) saturate(1.2)', 'Paired with --glass.', 'blur(18px) saturate(1.7)'],
  ['--bevel-hi', 'none', 'Retired: no inset bevels.', 'inset 0 1px 0 rgba(255,255,255,.95)'],
  ['--pearl', '#FFFDF8', 'Retired: secondaries are Paper with a hairline.', 'linear-gradient(#fff, #f4f8fb)'],
  ['--navy-pill', '#38B6F2', 'Retired: the primary is --primary (Sky with Night Ink words).', 'linear-gradient navy'],
  ['--navy-glow', '0 8px 18px -10px rgba(10, 108, 166, 0.45)', 'Retired name: use --primary-glow.', 'navy glow'],
  ['--well', '#EAF5FC', 'Track and inset fill (Cloud).', '#ecf4f9'],
  ['--well-shadow', 'inset 0 0 0 1px rgba(14, 34, 54, 0.08)', 'A flat hairline, not a pressed-in well.', 'inset 1.5px shadow'],
  ['--shadow-pill', '0 0 0 1px rgba(14, 34, 54, 0.08), 0 6px 16px -10px rgba(14, 34, 54, 0.30)', 'The gauge readout pill.', null],
  ['--focus-ring', '0 0 0 4px rgba(56, 182, 242, 0.28)', 'Focus-visible: a Deep Sky edge (--focus-edge) plus this ring.', null],
  ['--focus-edge', '#0A6CA6', 'Focus-visible edge, 1.5 px.', null],
  ['--glow-hero', 'radial-gradient(closest-side, rgba(255, 182, 128, 0.42), rgba(255, 182, 128, 0))', 'Below the bottom edge of the one hero card per screen: left -12%, right -12%, bottom -52%, height 78%.', null],
  ['--scrim', 'rgba(14, 34, 54, 0.32)', 'Behind sheets.', 'rgba(15,42,68,.32)'],
  ['--scrim-menu', 'rgba(14, 34, 54, 0.28)', 'Behind context menus.', 'rgba(15,42,68,.28)'],
  ['--scrim-solid', '#0E2236', 'Scrim color where its opacity animates.', '#0f2a44'],
]);
add('type', [
  ['--display', "'Fraunces', 'Fraunces Fallback', 'Iowan Old Style', Georgia, serif", 'Display serif. Always with --serif-axes.', "'Instrument Serif'"],
  ['--serif', "'Fraunces', 'Fraunces Fallback', 'Iowan Old Style', Georgia, serif", 'Same face; the italic is the sentence voice.', "'Instrument Serif'"],
  ['--serif-axes', "'SOFT' 100, 'WONK' 0", 'font-variation-settings for every Fraunces setting, with font-optical-sizing: auto.', null],
  ['--sans', "'Inter', 'Inter Fallback', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", 'Everything a person reads or taps below display sizes.', null],
  ['--stamp', "'Inter Tight', 'Inter Tight Fallback', 'Inter', -apple-system, sans-serif", 'Captions (600, caps, +0.14em) and gauge labels.', null],
  ['--mono', "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace", 'Code only.', null],
  ['--j-ink', '#1B4870', 'Journal pen ink (Twilight), 9.36 on Paper.', '#2f5d85'],
  ['--j-ink-soft', 'rgba(27, 72, 112, 0.4)', 'Journal pen ink, faint (rules and marks, not text).', 'rgba(47, 93, 133, 0.4)'],
  ['--fs-hero', '3.5rem', 'Hero: splash, onboarding, empty states. Fraunces 700, line 3.5rem, -0.02em.', null],
  ['--fs-title', '2.375rem', 'Screen title. Fraunces 650, line --lh-title, -0.015em.', '2.125rem'],
  ['--lh-title', '2.625rem', '', '2.5rem'],
  ['--fs-section', '1.625rem', 'Section title. Fraunces 600, line 2rem.', null],
  ['--lh-section', '2rem', '', null],
  ['--fs-stamp', '2.5rem', 'Hero session name in the gauge. Fraunces 650, line 2.625rem, -0.015em; 1.875rem when longer than 12 characters.', '1.75rem (Inter Tight caps)'],
  ['--lh-stamp', '2.625rem', '', '2.125rem'],
  ['--fs-stat', '2.75rem', 'Static hero stat: a number that never changes after first paint. Fraunces 650, line 1, -0.02em (Fraunces has no tabular figures).', null],
  ['--fs-sentence', '1.375rem', 'Sentence as a prompt or greeting. Fraunces italic 420, line 1.75rem.', '1.375rem (Instrument Serif)'],
  ['--lh-sentence', '1.75rem', '', '1.75rem'],
  ['--fs-sentence-sm', '1.0625rem', 'Sentence in lists and sublines. Fraunces italic 420, line 1.375rem, Dusk.', null],
  ['--fs-head', '1.375rem', 'Card title. Fraunces 600, line 1.75rem.', '1.25rem'],
  ['--lh-head', '1.75rem', '', '1.5625rem'],
  ['--fs-row', '1.0625rem', 'Headline below the serif floor. Inter 600, line 1.375rem.', '1.0625rem'],
  ['--lh-row', '1.375rem', '', '1.375rem'],
  ['--fs-body', '1rem', 'Body and assistant replies. Inter 400, line 1.5rem.', null],
  ['--lh-body', '1.5rem', '', null],
  ['--fs-sub', '0.9375rem', 'Secondary, row subtitle. Inter 500, line 1.25rem, Dusk.', '0.9375rem'],
  ['--lh-sub', '1.25rem', '', '1.25rem'],
  ['--fs-foot', 'max(13px, 0.8125rem)', 'Footnote. Inter 500, Dusk. Floor 13 px.', 'same'],
  ['--lh-foot', 'max(18px, 1.125rem)', '', 'same'],
  ['--fs-tile', '0.9375rem', 'Habit tile name. Inter 600, line --lh-tile (the --fs-sub size at 600).', '0.875rem'],
  ['--lh-tile', '1.125rem', '', '1.0625rem'],
  ['--fs-tag', 'max(13px, 0.8125rem)', 'Tag (Today, Planned). Inter 600, the footnote size.', null],
  ['--fs-stat-live', '2.75rem', 'A hero stat that changes. Inter 650, line 1, -0.02em, tabular-nums.', null],
  ['--fs-orb', 'max(12px, 0.75rem)', 'Small tile label. Inter 600. Floor 12 px.', 'same'],
  ['--lh-orb', 'max(16px, 1rem)', '', 'same'],
  ['--fs-caps', 'max(11px, 0.6875rem)', 'Caption and tab label. Floor 11 px.', 'same'],
  ['--lh-caps', 'max(14px, 0.875rem)', '', 'max(13px, 0.8125rem)'],
  ['--tr-caps', '0.14em', 'Caption tracking. The only caps tracking.', '.02 to .12em (six values)'],
  ['--tr-title', '-0.015em', 'Screen title and stamp tracking.', null],
  ['--tr-hero', '-0.02em', 'Hero and stat tracking.', null],
]);
add('shape', [
  ['--r-card', '24px', 'Cards, the hero card, sheets (top corners).', '22px'],
  ['--r-lg', '24px', 'Alias of --r-card.', '22px'],
  ['--r-group', '18px', 'Inset groups.', '18px'],
  ['--r-tile', '18px', 'Tiles, habit tiles, context chips.', '18px'],
  ['--r-chip', '18px', 'Context chips (two-line).', '16px'],
  ['--r-control', '14px', 'Inputs, inset controls.', '12px'],
  ['--r-md', '14px', 'Alias of --r-control.', '12px'],
  ['--r-menu', '14px', 'Context menu card.', '14px'],
  ['--r-icon', '12px', 'Icon tiles 32 px and up. Under 28 px an icon tile is a circle.', '10px'],
  ['--r-sm', '12px', 'Alias of --r-icon.', '8px'],
  ['--r-pill', '999px', 'Buttons, chips, segmented controls, the ask bar, the tab capsule.', '999px'],
]);
add('space', [
  ['--sp-1', '4px', 'Spacing step.', null], ['--sp-2', '8px', 'Spacing step.', null], ['--sp-3', '12px', 'Spacing step.', null],
  ['--sp-4', '16px', 'Spacing step.', null], ['--sp-5', '20px', 'Spacing step.', null], ['--sp-6', '24px', 'Spacing step.', null],
  ['--sp-8', '32px', 'Spacing step.', null], ['--sp-12', '48px', 'Spacing step.', null],
  ['--gutter', '16px', 'Phone side gutter, for text and cards.', '16px'],
  ['--page-pad', 'var(--gutter)', 'Page side padding.', 'same'],
  ['--section', '32px', 'Between sections.', '28px'],
  ['--sec-gap', '12px', 'Section header to its first card.', '12px'],
  ['--gap', '12px', 'Between cards.', '12px'],
  ['--gap-tile', '12px', 'Between habit tiles in the grid; tile padding is 12 too.', '8px'],
  ['--gap-dot', '3px', 'Named exception: the gap between habit week dots.', null],
  ['--dot-offset', '-7px', 'Named exception: today\'s dot sits 7 px above its letter.', null],
  ['--fade-h', '52px', 'Named exception: the Cloud fade under the dock.', null],
  ['--dock-inset', '12px', 'The dock column, in from each edge.', null],
  ['--sp-group', '12px', 'Between rows of an inset group stack (foundation.css).', '12px'],
  ['--sp-secondary', '24px', 'Above a secondary section (foundation.css).', '24px'],
  ['--dpager-gap', '16px', 'The gap between day pages in the pager.', '16px'],
  ['--maxw', '720px', 'Widest content column (iPad, web).', '720px'],
  ['--safe-t', 'env(safe-area-inset-top, 0px)', 'Top safe area. Live in 35 places; keep.', 'same'],
  ['--safe-b', 'env(safe-area-inset-bottom, 0px)', 'Bottom safe area. Live in 32 places; keep.', 'same'],
  ['--kb', '0px', 'Keyboard height, set at runtime. Keep.', 'same'],
  ['--pad-card', '16px', 'Card padding. The hero card uses 20px.', '16px'],
  ['--pad-hero', '20px', 'Hero card padding.', null],
  ['--hit', '44px', 'Minimum hit target.', '44px'],
  ['--tabbar-h', '56px', 'Tab capsule height.', '56px'],
  ['--ask-h', '48px', 'Ask bar height.', '48px'],
  ['--dock-gap', '8px', 'Ask bar to capsule.', '8px'],
]);
add('motion', [
  ['--ease-out', 'cubic-bezier(0.22, 1, 0.36, 1)', 'Everything that moves in.', 'same'],
  ['--ease-sheet', 'cubic-bezier(0.32, 0.72, 0, 1)', 'Sheets.', null],
  ['--dur-fast', '160ms', 'Press to scale 0.97.', 'same'],
  ['--dur', '220ms', 'Small state changes.', 'same'],
  ['--dur-in', '120ms', 'Fade in.', 'same'],
  ['--dur-out', '100ms', 'Fade out.', 'same'],
  ['--dur-color', '200ms', 'Color and halo changes.', 'same'],
  ['--dur-page', '350ms', 'Page push and pop.', null],
  ['--dur-sheet', '500ms', 'Sheet open on --ease-sheet.', null],
  ['--dur-number', '480ms', 'Numbers and gauge fill.', null],
  ['--dur-complete', '300ms', 'The one overshoot to 1.12, with the orb haptic on the peak.', null],
  ['--dur-needle', '480ms', 'Gauge pointer sweep, then --dur-settle with at most 2% overshoot.', null],
  ['--dur-settle', '300ms', 'Gauge pointer settle.', null],
  ['--tick-stagger', '6ms', 'Gauge ticks draw in, capped at 240ms total. First view only.', null],
  ['--dur-sunrise', '900ms', 'Splash on the first open of the day: the Orb rises 24px while its underlight warms.', null],
  ['--dur-title-in', '200ms', 'Splash wordmark fade after the rise.', null],
  ['--dur-launch', '300ms', 'Later launches: fade only.', null],
  ['--dur-dawn', '600ms', 'The dawn wash fades in on the first open after 4 a.m. local. Once a day.', null],
  ['--orb-breath', '4000ms', 'Idle Orb: scale 1 to 1.015 and back.', null],
  ['--orb-orbit', '1200ms', 'Thinking Orb: one turn of the Apricot arc.', null],
  ['--dur-reduce', '150ms', 'Under Reduce Motion every move becomes this linear fade.', null],
  ['--dur-ring', '600ms', 'The hold-to-complete ring fill.', '600ms'],
]);
add('orb', [
  ['--orb-full-min', '48px', '48 px and up: full Orb with Apricot glow.', null],
  ['--orb-gloss-min', '28px', '28 to 47 px: gloss, no glow.', null],
  ['--orb-flat-max', '27px', 'Under 28 px: a flat Sky disc.', null],
  ['--orb-fold', '28px', 'The Orb inside the 48 px fold button: gloss tier, still.', null],
  ['--orb-dock', '28px', 'The Orb in the ask bar: 28 px, the smallest gloss size.', '22px'],
  ['--orb-assistant', '56px', 'Assistant empty state.', null],
  ['--orb-splash', '96px', 'Splash.', null],
]);

const IC = [
  ['--ink-2', '#33475B', 'Graphite'], ['--ink-3', '#33475B', 'Graphite'], ['--ink-4', '#33475B', 'Graphite'],
  ['--accent-text', '#085A8C', 'Deep Sky step, 7.24 on Paper'], ['--ok', '#085A8C', ''], ['--ink-faint', '#5F6D7B', 'Pencil step, 5.22 on Paper'],
  ['--t-rest', '#5F6D7B', ''], ['--line', 'rgba(14, 34, 54, 0.30)', ''], ['--line-strong', 'rgba(14, 34, 54, 0.55)', ''],
  ['--card-border', '1px solid rgba(14, 34, 54, 0.16)', ''], ['--field-edge', 'rgba(14, 34, 54, 0.7)', '5.98 on Paper'], ['--glass', '#FFFDF8', 'opaque'],
  ['--dusk', '#33475B', 'palette names step too'], ['--deep-sky', '#085A8C', ''], ['--pencil', '#5F6D7B', ''], ['--t-long', '#085A8C', ''],
  ['--star', '#085A8C', ''], ['--prio-3', '#085A8C', ''], ['--tag-blue', '#085A8C', ''], ['--tick', 'rgba(14, 34, 54, 0.45)', ''], ['--coin-ring', 'rgba(14, 34, 54, 0.55)', ''],
  ['--edge', 'rgba(14, 34, 54, 0.30)', ''], ['--dot-ahead', 'rgba(14, 34, 54, 0.22)', ''],
];

// ---------- JSON ----------
const json = {
  $schema: 'Orby brand tokens. Generated with docs/brand/tokens.css from one table. Names are the CSS custom properties without the leading --.',
  name: 'Orby',
  direction: 'Sunrise optimism',
  version: '1.1.0',
  date: '2026-11-10',
  note: 'Internal identifiers keep the old name: repository LogBook, packages @logbook/*, bundle id com.joshbean.logbook, storage keys. Only what a person sees says Orby.',
  groups: {},
  increaseContrast: Object.fromEntries(IC.map(([n, v, r]) => [n.slice(2), { value: v, role: r }])),
  contrast: {
    method: 'WCAG 2.x relative luminance. Body text 4.5:1, large text (24 px regular, 18.66 px bold) and non-text 3:1.',
    allowedText: [
      ['night-ink', 'paper', 15.88], ['night-ink', 'cloud', 14.58], ['night-ink', 'linen', 14.23], ['night-ink', 'haze', 12.64], ['night-ink', 'apricot', 9.42],
      ['night-ink', 'sky', 7.03], ['night-ink', 'sunrise', 4.96], ['dusk', 'paper', 7.10], ['dusk', 'cloud', 6.52], ['dusk', 'linen', 6.36], ['dusk', 'haze', 5.65],
      ['deep-sky', 'paper', 5.57], ['deep-sky', 'cloud', 5.11], ['deep-sky', 'linen', 4.99], ['ember', 'paper', 5.51], ['ember', 'cloud', 5.06], ['ember', 'linen', 4.94],
      ['white', 'night-ink', 16.14], ['white', 'twilight', 9.51], ['white', 'dusk', 7.22], ['white', 'deep-sky', 5.66], ['white', 'ember', 5.60],
      ['paper', 'twilight', 9.36], ['paper', 'night-ink', 15.88], ['haze', 'twilight', 7.45], ['apricot', 'twilight', 5.55], ['haze', 'night-ink', 12.64], ['apricot', 'night-ink', 9.42],
      ['graphite', 'paper', 9.42], ['graphite', 'cloud', 8.65], ['graphite', 'haze', 7.49], ['deep-sky-ic #085A8C', 'paper', 7.24], ['deep-sky-ic #085A8C', 'haze', 5.76], ['white', 'signal', 6.45], ['dusk', 'splash sky (cloud)', 6.52],
      ['twilight', 'paper', 9.36], ['warn-text', 'paper', 6.28], ['warn-text', 'warn-soft', 5.63], ['bad', 'paper', 6.35], ['bad', 'bad-soft', 5.27],
    ],
    largeTextOnly: [['deep-sky', 'haze', 4.43], ['sky', 'twilight', 4.14]],
    banned: [['sky', 'paper', 2.26], ['sky', 'cloud', 2.07], ['white', 'sky', 2.30], ['white', 'sunrise', 3.25], ['sunrise', 'paper', 3.20], ['sunrise', 'cloud', 2.94], ['dusk', 'sky', 3.14], ['dusk', 'sunrise', 2.22], ['night-ink', 'twilight', 1.70], ['sunrise', 'sky (touching)', 1.42]],
    nonText: [['sky', 'paper', 2.26, 'needs a shape change or an Ink label'], ['deep-sky', 'haze', 4.43, 'gauge fill on track'], ['sunrise', 'paper', 3.20, 'now-marks pass 3:1'], ['pencil', 'paper', 3.61, 'ticks'], ['field-edge', 'paper', 3.20, 'field edges'], ['rest glyph #5F6D7B', 'haze', 4.15, 'rest session glyph in a Haze tile'], ['pencil', 'haze', 2.87, 'never a meaningful mark on Haze']],
    decorative: ['minor gauge ticks (--tick 1.57)', 'off coin ring (--coin-ring 1.80)', 'off filter chip edge (--line-strong 1.44)', 'the thinking arc (#FF9F5A 2.0) and its Sky ring (1.3)', 'the Marigold warning mark (2.21): always with a glyph and words'],
  },
};
for (const t of T) { (json.groups[t.group] ||= {})[t.name.slice(2)] = { value: t.value, role: t.role, ...(t.replaces ? { replaces: t.replaces } : {}) }; }
fs.writeFileSync(`${OUT}/tokens.json`, JSON.stringify(json, null, 2) + '\n');

// ---------- CSS ----------
const pad = (s, n) => s + ' '.repeat(Math.max(1, n - s.length));
let css = `/*
 * Orby brand tokens, Sunrise optimism (v1.1, Nov 10 2026).
 * Generated together with tokens.json from one table: change both or neither.
 *
 * How to use: MERGE this :root block into apps/web/src/styles/tokens.css (do not replace the file's block wholesale). Names match the app's
 * existing tokens wherever one exists, so components pick up the new values without edits. Each line says what it
 * replaces ("was ..."). New names (palette, --now, --dawn, motion, orb tiers) are additions. Retired names are kept with
 * the new value so nothing breaks; migrate them away (brand-guide.md section 12).
 * craft.css overrides --shadow-1, --shadow-float, --card-border and --glass today: delete those overrides when this lands.
 * Do not paste the !important overrides from mockups/override.css into the app.
 */
:root {
  color-scheme: light;
`;
let g0 = '';
for (const t of T) {
  if (t.group !== g0) { css += `\n  /* ---------- ${t.group} ---------- */\n`; g0 = t.group; }
  const c = [t.role, t.replaces ? `was ${t.replaces}` : ''].filter(Boolean).join(' ');
  css += `  ${pad(`${t.name}: ${t.value};`, 58)}${c ? `/* ${c.replace(/\*\//g, '')} */` : ''}\n`;
}
css += `  --chrome-h: calc(var(--ask-h) + var(--dock-gap) + var(--tabbar-h) + 8px);\n}\n
/* iOS Increase Contrast (prefers-contrast: more): grey words step to Graphite, Deep Sky and Pencil one step darker,
   hairlines and edges darker, frosted surfaces opaque. */
@media (prefers-contrast: more) {
  :root:root {
${IC.map(([n, v, r]) => `    ${pad(`${n}: ${v};`, 50)}${r ? `/* ${r} */` : ''}`).join('\n')}
  }
}

/* Fraunces axes for the whole document: the woff2 defaults to WONK 1 and SOFT 0, so any element without this would render
   wonky and hard. Inter and Inter Tight ignore axes they do not have. Never set font-variation-settings anywhere else
   (check-brand.mjs flags it). */
html { font-variation-settings: var(--serif-axes); font-optical-sizing: auto; font-synthesis: none; }

.t-easy { --tone: var(--t-easy); }
.t-long { --tone: var(--t-long); }
.t-hard { --tone: var(--t-hard); }
.t-fast { --tone: var(--t-fast); }
.t-lift { --tone: var(--t-lift); }
.t-cross { --tone: var(--t-cross); }
.t-rest { --tone: var(--t-rest); }
`;
fs.writeFileSync(`${OUT}/tokens.css`, css);
console.log('tokens:', T.length);

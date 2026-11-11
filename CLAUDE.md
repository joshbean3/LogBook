# CLAUDE.md

This repo is **Orby**, a personal iPhone app for one person's training plan (running and strength), daily habits, goals, a journal, what they learned, and an AI assistant. It is a pnpm monorepo: `apps/web` (React 19 + Vite, shipped as a PWA and inside a Capacitor iOS shell), `apps/api` (Hono on Node 22, Drizzle + SQLite), `packages/shared` (types, dates, zod contracts) and `packages/capacitor-health` (the Apple Health plugin). The product was renamed from Logbook to Orby. Internal identifiers keep the old name and must not be renamed: the repo, package names `@logbook/*`, the bundle id `com.joshbean.logbook`, storage keys, database names and file names.

## Working rules

- Before calling a change done, run `pnpm typecheck` and `pnpm test` at the repo root, and for web changes the build: `pnpm --filter @logbook/shared build && pnpm --filter @logbook/web build` (or `pnpm build` for everything).
- Never edit `apps/web/ios/App/CapApp-SPM/Package.swift`. The Capacitor CLI manages it.
- Layout (`docs/shape-system.md`, restated in the brand guide section 5): a 16 px side gutter (`--gutter`) on every phone width, and every tappable thing at least 44 x 44 pt (`--hit`).

## Brand

- Every UI change follows `docs/brand/brand-guide.md` and uses the values in `docs/brand/tokens.css`: colors, type, radii, spacing, shadows and motion come from tokens, never raw values. When the guide and the code disagree, the guide wins. When the guide is silent, ask.
- Before a change to UI, styles, copy, icons or assets is called done (in `apps/web`, or visible copy in `apps/api` and `packages/shared`, or the shell files `index.html`, `capacitor.config.ts`, `Info.plist`, the manifest), run the **brand-guardian** agent (`.claude/agents/brand-guardian.md`, guide section 13.1) on the diff and fix every violation it reports. Give it the dev server URL when one is running so it can run the runtime audit (`node docs/brand/tools/audit.mjs <url> /today,...`); without one it reports the screen-level rules as not verified. Then work through the checklist in section 13 of the guide.
- Layout, spacing, grouping and emphasis follow `docs/brand/layout-and-hierarchy.md`: the order of emphasis on each screen (section 2), the spacing uses (3), type levels (4), containers (5), component values (6), and the per-screen checks in section 8, which you run with the guide's section 13 checklist before calling a screen done.
- The app has not migrated to the brand yet (order in guide section 12.3). Until it has, use `node apps/web/scripts/check-brand.mjs` as a migration aid: it prints `file:line` for raw hex, rgb/hsl and unlisted rgba colors, named colors, retired navy and orange values, font families that are not tokens, px and off-scale rem font sizes, radii, tracking, off-step spacing, motion properties and literal durations, Fraunces under 600, stray `font-variation-settings`, and copy problems (em dashes, British spellings, "the Orby") in `apps/web/src`, outside the token file. Pass a folder or files to check part of the app (`node apps/web/scripts/check-brand.mjs src/features/day`), or `--summary` for counts per file. It is not part of `pnpm test` yet; it joins once its count reaches 0. New code must add no findings.

## Copy

- Plain and short. One idea per line. American spelling (color, favorite, center).
- No em dashes: use a period, a comma or a colon.
- The assistant is "the assistant" in copy, never "coach", "AI", "bot" or "Orby".
- The product is "Orby": capital O, no "the", no "app", possessive "Orby's". Caps only inside the letterspaced caption style.
- No model names in product copy. The provider disclosure under the composer stays exactly as written.

# Deck and asset generators

The scripts that produced `docs/brand/Orby Brand Guide.pptx`, the sheets and the mockups, kept so the deck can be rebuilt.

- `tokens.mjs` writes `tokens.json` and `tokens.css`.
- `build-svg.mjs`, `orby.mjs` and the `*.part.mjs` files draw the wordmark, lockups and sheet parts (the orb itself is `../orb.mjs`).
- `sheets.mjs` renders the palette, type and component sheets; `mock.mjs` shoots the mockups over the running app with `../../mockups/override.css`.
- `prep2.mjs` prepares slide images, then `build2.js` builds the deck with pptxgenjs.

They were written in a scratch folder and still use absolute paths from that session. Point the path constants at the matching folders in `docs/brand` before running them again.

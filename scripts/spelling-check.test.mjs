// The British spelling check: visible words only, every form the plan names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { britishIn } from './spelling-check.mjs';

test('finds Colour, Favourite and Kilometre forms in strings and JSX text', () => {
  const src = `const a = 'No colour';
const b = <p>No favourites yet</p>;
const c = \`\${n} Kilometres\`;
const d = fav ? 'Unfavourite' : 'Favourite';`;
  const words = britishIn(src, 'x.tsx').map((h) => h.word);
  assert.deepEqual(words, ['colour', 'favourites', 'Kilometres', 'Unfavourite', 'Favourite']);
});

test('leaves identifiers, comments, imports and American words alone', () => {
  const src = `import { colourOf } from './colour';
// the favourite colour
const favouriteColour = colourOf(x);
const e = <p>Favorite color, 5 kilometers</p>;`;
  assert.deepEqual(britishIn(src, 'x.tsx'), []);
});

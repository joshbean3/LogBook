import { describe, expect, it } from 'vitest';
import { fitHeight } from './fitHeight';

/**
 * A page as far as fitting a field needs one: a scroller whose content is the field plus `rest`, which cannot be scrolled
 * past its end (the browser clamps `scrollTop` the moment the content gets shorter), and a field whose words need `words` px.
 */
const page = ({ words, height, rest, view, at }: { words: number; height: number; rest: number; view: number; at: number }) => {
  let fieldHeight = height;
  let top = at;
  const collapsed = 96;
  const max = () => Math.max(0, fieldHeight + rest - view);
  const clamp = () => {
    top = Math.min(top, max());
  };
  const moves: number[] = [];
  const scroller = {
    get scrollTop() {
      clamp();
      return top;
    },
    set scrollTop(v: number) {
      top = v;
      clamp();
      moves.push(top);
    },
  };
  const style = {
    get height() {
      return `${fieldHeight}px`;
    },
    set height(v: string) {
      fieldHeight = v === 'auto' ? collapsed : parseFloat(v);
    },
  };
  const el = {
    style,
    get scrollHeight() {
      // reading it lays the page out: a scroller past its new end is clamped here
      clamp();
      return words;
    },
    closest: () => scroller,
  };
  return { el: el as unknown as HTMLTextAreaElement, scroller, height: () => fieldHeight, moves };
};

/**
 * A growing field is measured by letting it collapse for a moment. With the page scrolled near its end (a long entry, the
 * keyboard up, little under the field) the collapse made the page shorter than its scroll position: the browser pulled the
 * page up, and it jumped under every key.
 */
describe('fitting a field to its words', () => {
  it('does not move the page, even when the page is scrolled to its end', () => {
    const p = page({ words: 420, height: 396, rest: 600, view: 500, at: 496 });
    expect(fitHeight(p.el)).toBe(420);
    expect(p.height()).toBe(420);
    expect(p.scroller.scrollTop).toBe(496);
  });

  it('leaves the page alone when nothing moved it', () => {
    const p = page({ words: 120, height: 96, rest: 2000, view: 500, at: 40 });
    fitHeight(p.el);
    expect(p.scroller.scrollTop).toBe(40);
    expect(p.moves).toEqual([]);
  });

  it('stops at a largest height and says how tall the words are', () => {
    const p = page({ words: 900, height: 300, rest: 600, view: 500, at: 380 });
    expect(fitHeight(p.el, 422)).toBe(900);
    expect(p.height()).toBe(422);
    expect(p.scroller.scrollTop).toBe(380);
  });

  it('works for a field outside any scroller', () => {
    const p = page({ words: 200, height: 96, rest: 0, view: 500, at: 0 });
    (p.el as unknown as { closest: () => null }).closest = () => null;
    expect(fitHeight(p.el)).toBe(200);
    expect(p.height()).toBe(200);
  });
});

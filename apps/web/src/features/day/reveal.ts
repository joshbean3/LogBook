import { revealField } from '@/lib/keyboard';

/** Room kept between a composer's Save and the keyboard's top edge. */
const MARGIN = 12;

/**
 * Keeps a composer's whole box, its field and its Save, above the keyboard (§5.1; day review 3 #3). WP1's `revealField`
 * scrolls the focused element in after the keyboard's rise, but the textarea alone left Save under the keyboard; and nothing
 * scrolled as the field grew with the words. So: the box is revealed on focus (through `revealField`), and again, at once,
 * on every input that pushes its bottom under the keyboard (the keyboard is already up then).
 */
export const revealBox = (box: HTMLElement | null) => {
  if (box) revealField(box);
};
export const keepAboveKeyboard = (box: HTMLElement | null) => {
  if (!box) return;
  // after the Composer's own layout effect has grown the field
  requestAnimationFrame(() => {
    const scroller = box.closest<HTMLElement>('.sheet-body, .pushed, .tab-scroll');
    if (!scroller) return;
    const kb = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kb')) || 0;
    if (kb <= 0) return;
    const r = box.getBoundingClientRect();
    const s = scroller.getBoundingClientRect();
    const bottom = Math.min(s.bottom, window.innerHeight - kb) - MARGIN;
    // at once, as a text view follows its caret (a smooth scroll per keystroke lagged behind the growing field)
    if (r.bottom > bottom) scroller.scrollBy({ top: r.bottom - bottom, behavior: 'instant' });
  });
};

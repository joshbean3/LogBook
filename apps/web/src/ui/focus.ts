/**
 * How the page was last driven, a pointer (touch, mouse, pen) or the keyboard, so focus handed back after an overlay
 * closes can carry a ring only when the keyboard closed it.
 *
 * Why: browsers decide `:focus-visible` for a scripted `focus()` from what had focus before. A sheet closed by a tap on its
 * scrim leaves focus on whatever was focused inside it, so if a key was pressed in the sheet, the opener (the hero, the
 * date pager) lights up its ring under the finger. Only `:focus-visible` should ring, and only for keyboard users.
 */
let modality: 'pointer' | 'keyboard' = 'pointer';
/**
 * The last input is also on <html> as data-input="pointer" | "keyboard": foundation.css drops every focus ring while it
 * says pointer (polish 15), so a ring the browser chose to show (after Escape closed a sheet, say) goes the moment the
 * athlete touches the screen again, and comes back with the next key press.
 */
const mark = (m: 'pointer' | 'keyboard') => {
  modality = m;
  const root = document.documentElement;
  if (root.dataset.input !== m) root.dataset.input = m;
};
if (typeof document !== 'undefined') {
  mark('pointer');
  document.addEventListener('pointerdown', () => mark('pointer'), true);
  // a touch that never becomes a pointer event (some WebViews) still counts
  document.addEventListener('touchstart', () => mark('pointer'), { capture: true, passive: true });
  document.addEventListener(
    'keydown',
    (e) => {
      // a shortcut chord or a lone modifier is not keyboard navigation
      if (e.metaKey || e.ctrlKey || e.altKey || ['Shift', 'Meta', 'Control', 'Alt', 'CapsLock'].includes(e.key)) return;
      mark('keyboard');
    },
    true,
  );
}

/** The last kind of input: 'pointer' or 'keyboard'. */
export const lastInput = () => modality;

/**
 * Give focus back to `el` after a sheet or menu closes. Closed from the keyboard: an ordinary focus (the ring shows).
 * Closed by a pointer: focus without the ring (`focusVisible: false` where supported, and `data-quiet-focus`, which the
 * foundation CSS uses to drop the ring, until the element blurs or a key is pressed).
 */
export const restoreFocus = (el: HTMLElement) => {
  if (modality === 'keyboard') {
    el.focus({ preventScroll: true });
    return;
  }
  el.setAttribute('data-quiet-focus', '');
  const clear = () => {
    el.removeAttribute('data-quiet-focus');
    el.removeEventListener('blur', clear);
    document.removeEventListener('keydown', clear, true);
  };
  el.addEventListener('blur', clear);
  document.addEventListener('keydown', clear, true);
  el.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
};

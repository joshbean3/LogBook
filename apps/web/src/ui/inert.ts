/**
 * Panels that sit above the app (a sheet, a context menu) make #root inert while they are up, so focus and the screen
 * reader stay with them. Several may be up at once; the attribute comes off when the last one goes.
 */
let holders = 0;
export const holdInert = () => {
  const root = document.getElementById('root');
  holders++;
  root?.setAttribute('inert', '');
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders = Math.max(0, holders - 1);
    if (!holders) root?.removeAttribute('inert');
  };
};

export const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
export const focusables = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.closest('[aria-hidden="true"]') && !el.closest('[inert]') && el.offsetParent !== null);

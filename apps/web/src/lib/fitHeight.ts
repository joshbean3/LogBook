/**
 * Fit a textarea's height to its words (up to `max`), and say how tall the words are. The field is measured by letting it
 * collapse for a moment (`height: auto`), which for that moment makes the page shorter: a scroller near its end is pulled
 * up by the browser (it cannot be scrolled past its content), and where the browser anchors the scroll it can be pushed on
 * instead. Either way the page jumped under the keys while a long text was typed with the keyboard up. So the scroller's
 * place is read first and put back after the field has its height again, in the same task: nothing moves on screen.
 */
export const fitHeight = (el: HTMLTextAreaElement, max = Infinity): number => {
  const scroller = el.closest<HTMLElement>('.sheet-body, .pushed, .tab-scroll');
  const top = scroller ? scroller.scrollTop : 0;
  el.style.height = 'auto';
  const full = el.scrollHeight;
  el.style.height = `${Math.min(full, max)}px`;
  if (scroller && scroller.scrollTop !== top) scroller.scrollTop = top;
  return full;
};

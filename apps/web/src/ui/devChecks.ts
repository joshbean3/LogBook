/**
 * Layout checks for development builds only (docs/brand/layout-and-hierarchy.md 4.4 and 5.2). main.tsx loads this module
 * behind `import.meta.env.DEV`, so a release bundle never carries it. It watches the page and warns once per offender:
 *
 *   - a shadowed surface inside a card, group or tile ("no card in a card"). Inset shadows are rings, not lift, and do not
 *     count.
 *   - a stacked header: a 26 px section title directly above a card whose first line is a 22 px card title.
 *
 * It only reads the page; it never changes it.
 */

const CONTAINERS = '.card, .group, .tile, .k-card, .k-rows, .aura';
// a switch's knob (a control's own part) is not a card
const ALLOWED = '.s-knob';
const seen = new Set<string>();

const nameOf = (el: Element): string => {
  const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
  return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`;
};

const warnOnce = (key: string, message: string) => {
  if (seen.has(key)) return;
  seen.add(key);
  console.warn(message);
};

/** A box-shadow that lifts: not `none`, and not only rings (inset, or a keyline with no offset and no blur). */
export const liftsShadow = (shadow: string): boolean => {
  if (!shadow || shadow === 'none') return false;
  // split on commas outside parentheses
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of shadow) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  const lifts = (p: string) => {
    if (!p.trim() || /\binset\b/.test(p)) return false;
    // the lengths after the color: x, y, blur, spread. A keyline ring (0 0 0 2px, the now-mark's Paper edge) does not lift
    const len = [...p.replace(/rgba?\([^)]*\)/g, '').matchAll(/(-?\d*\.?\d+)px/g)].map((m) => parseFloat(m[1]!));
    return !(len.length >= 3 && len[0] === 0 && len[1] === 0 && len[2] === 0);
  };
  return parts.some(lifts);
};

const visible = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};

const checkShadows = (root: ParentNode) => {
  for (const box of root.querySelectorAll(CONTAINERS)) {
    if (!visible(box)) continue;
    for (const el of box.querySelectorAll('*')) {
      if (el.matches(ALLOWED) || !visible(el)) continue;
      if (!liftsShadow(getComputedStyle(el).boxShadow)) continue;
      const key = `shadow:${nameOf(box)}>${nameOf(el)}`;
      warnOnce(key, `Layout: a shadowed ${nameOf(el)} sits inside ${nameOf(box)}. No card in a card: use a hairline row, a Haze icon tile or space (layout standard 5.2).`);
    }
  }
};

const px = (el: Element | null | undefined) => (el ? parseFloat(getComputedStyle(el).fontSize) : 0);

const checkStackedHeaders = (root: ParentNode) => {
  for (const sec of root.querySelectorAll('.lb-sec')) {
    const head = sec.querySelector(':scope > .lb-head');
    if (!head || !visible(head) || sec.classList.contains('is-list')) continue;
    const title = head.querySelector('.lb-title');
    const next = head.nextElementSibling;
    if (!title || !next) continue;
    const first = next.firstElementChild;
    const sectionSize = px(title);
    const firstIsCardTitle = !!first && (first.matches('.card-title, .card-head') || (getComputedStyle(first).fontFamily.includes('Fraunces') && px(first) < sectionSize && px(first) >= 20));
    if (firstIsCardTitle) {
      const key = `stack:${title.textContent?.trim()}`;
      warnOnce(key, `Layout: the section "${title.textContent?.trim()}" sits directly above a card that opens with its own title. No stacked headers: keep one of the two (layout standard 4.4).`);
    }
  }
};

let timer: ReturnType<typeof setTimeout> | undefined;
const run = () => {
  timer = undefined;
  try {
    checkShadows(document);
    checkStackedHeaders(document);
  } catch {
    // a check never breaks the app
  }
};

export const startDevChecks = () => {
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
  const schedule = () => {
    if (timer) return;
    timer = setTimeout(run, 1500);
  };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  schedule();
};

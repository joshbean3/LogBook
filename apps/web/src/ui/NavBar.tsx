import { ChevronLeft } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion, type MotionValue } from 'motion/react';
import type * as React from 'react';
import { isValidElement, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useNavInternal, usePushedEntry } from '@/app/NavController';
import { haptics } from '@/lib/haptics';
import { fadeIn, fadeOut } from '@/lib/motion';
import type { ContextMenuItem } from './ContextMenu';
import type { DayPagerHandle } from './DayPager';
import { tabDef } from './nav';
import { Pressable } from './Pressable';
import { usePop } from './PushedLayer';
import { usePress } from './usePress';

/**
 * The bar (docs/feel.md §2, contracts §B.2): `NavBar` (the sticky 44 px bar, the large title, the strip slot and the gap,
 * returned as a FRAGMENT so they are direct children of the page element and stay sticky), `DateStrip` (Today's week, the
 * disc riding the pager), `TodayPill`, `PushedBar` and `BackButton`, and the captions.
 *
 * Nothing here animates layout: `--hdr` (written by the tab scroller) fades the large title and the date part out and the
 * centred inline title in, in CSS; during a day drag the date part and both titles are three stacked labels each (prev ·
 * cur · next, absolute in one row) whose opacities are written from the pager's `progress` on every change, with no React
 * render; the strip's disc is one element translated from `progress × span`. The word (`.nb-word`) never fades, never
 * stacks and never drops: the date part shortens instead (full → short → day, measured by a ResizeObserver).
 */

import { D, DAYN, FORMS, fmt, iso, mondayOfIso, shorten, type Form } from './captions';
export { capsWord, dayCaption, dayTitle, monthCaption, weekCaption } from './captions';

// ---------- the root bar ----------
/** cur always; prev/next only while a pager can drive the bar (rendered stacked and bound to `progress`). */
export interface StackedLabel {
  prev?: string;
  cur: string;
  next?: string;
}
export interface NavBarProps {
  /** The owner's word (Today only; capsWord(settings.focus.word)): `.nb-word` 'STEADY · ', opacity 1 at every --hdr. */
  word?: string | null;
  /** The date part, `.nb-date`. */
  caps: StackedLabel;
  title: StackedLabel;
  progress?: MotionValue<number>;
  /** The 80 px slot: <Avatar/> | <TodayPill/> | nothing. */
  trailing?: ReactNode;
  /** Plan: the slot is 96 wide (`.nb-bar.has-seg`) and holds <Segmented/>. */
  wideTrailing?: boolean;
  onTitlePress?: () => void;
  titleMenu?: ContextMenuItem[] | (() => ContextMenuItem[]);
  titleLabel?: string;
  gap?: 16 | 24;
  /** The DateStrip (Today only); rendered sticky under the bar. */
  children?: ReactNode;
  /** Ref to the large title row, for handle.attach. */
  titleRef?: React.Ref<HTMLElement>;
}

/** Three labels stacked in one row: the cur one in flow, prev and next absolute over it (opacities written from progress). */
const Stacked = ({ l, form = 'full', stacked }: { l: StackedLabel; form?: Form; stacked: boolean }) => (
  <>
    <span className="nb-sl" data-sl="cur">
      {shorten(l.cur, form)}
    </span>
    {stacked && l.prev != null ? (
      <span className="nb-sl nb-sl-abs" data-sl="prev" aria-hidden="true">
        {shorten(l.prev, form)}
      </span>
    ) : null}
    {stacked && l.next != null ? (
      <span className="nb-sl nb-sl-abs" data-sl="next" aria-hidden="true">
        {shorten(l.next, form)}
      </span>
    ) : null}
  </>
);

const keyOf = (n: ReactNode): string => {
  if (!isValidElement(n)) return n == null || n === false ? 'none' : 'node';
  if (n.key != null) return String(n.key);
  const t = n.type as { displayName?: string; name?: string } | string;
  return typeof t === 'string' ? t : (t.displayName ?? t.name ?? 'el');
};

const setRef = <T,>(r: React.Ref<T> | undefined, v: T | null) => {
  if (typeof r === 'function') r(v);
  else if (r) (r as React.RefObject<T | null>).current = v;
};

/** Returns a FRAGMENT: .nb-bar, .nb-title, {children}, .nb-gap, as direct children of the page element. Never a wrapper. */
export const NavBar = ({ word, caps, title, progress, trailing, wideTrailing, onTitlePress, titleMenu, titleLabel, gap = 24, children, titleRef }: NavBarProps): React.JSX.Element => {
  const reduce = !!useReducedMotion();
  const barRef = useRef<HTMLDivElement>(null);
  const capRef = useRef<HTMLElement>(null);
  const wordRef = useRef<HTMLSpanElement>(null);
  const titleEl = useRef<HTMLElement | null>(null);
  const stacked = !!progress;

  // the date part's form: the longest that fits (re-tried from 'full' whenever the words change or the bar widens)
  const capsKey = `${word ?? ''}|${caps.prev ?? ''}|${caps.cur}|${caps.next ?? ''}`;
  const [form, setForm] = useState<Form>('full');
  const [seenKey, setSeenKey] = useState(capsKey);
  if (seenKey !== capsKey) {
    setSeenKey(capsKey);
    setForm('full');
  }
  useLayoutEffect(() => {
    const cap = capRef.current;
    const bar = barRef.current;
    if (!cap || !bar) return;
    const writeWord = () => bar.style.setProperty('--nb-word-w', `${wordRef.current ? wordRef.current.getBoundingClientRect().width : 0}px`);
    writeWord();
    if (cap.scrollWidth > cap.clientWidth + 0.5 && form !== 'day') setForm(FORMS[FORMS.indexOf(form) + 1]!);
    let w = cap.clientWidth;
    const ro = new ResizeObserver(() => {
      writeWord();
      if (cap.clientWidth > w + 0.5 && form !== 'full') setForm('full');
      else if (cap.scrollWidth > cap.clientWidth + 0.5 && form !== 'day') setForm(FORMS[FORMS.indexOf(form) + 1]!);
      w = cap.clientWidth;
    });
    ro.observe(cap);
    return () => ro.disconnect();
  }, [form, capsKey]);

  // the stacked labels follow the pager: |p| for the one in the drag's direction, 1 − |p| for the current, 0 for the other
  useLayoutEffect(() => {
    if (!progress) return;
    const els = [...(barRef.current?.querySelectorAll<HTMLElement>('[data-sl]') ?? []), ...(titleEl.current?.querySelectorAll<HTMLElement>('[data-sl]') ?? [])];
    const apply = (p: number) => {
      const a = Math.abs(p);
      // reduced motion: the labels swap at the halfway mark instead of fading
      const k = reduce ? (a >= 0.5 ? 1 : 0) : a;
      for (const el of els) {
        const r = el.dataset.sl;
        const toward = (r === 'next' && p > 0) || (r === 'prev' && p < 0);
        el.style.opacity = String(r === 'cur' ? 1 - k : toward ? k : 0);
      }
    };
    apply(progress.get());
    return progress.on('change', apply);
    // re-bound only when the labels' nodes or the binding change (code review 1 #12)
  }, [progress, reduce, stacked, capsKey, title.prev, title.cur, title.next, form]);

  // the title block acts only when it has something to do: otherwise it is text (no dead buttons, code review 1 #10)
  const pressable = !!onTitlePress || !!titleMenu;
  const tp = {
    onPress: onTitlePress ? () => onTitlePress() : undefined,
    holdMenu: titleMenu,
    menuLabel: 'Title actions',
    press: 'dim' as const,
  };
  const capInner = (
    <>
      {word ? (
        <span ref={wordRef} className="nb-word">
          {word}&nbsp;·&nbsp;
        </span>
      ) : null}
      <span className="nb-date">
        <Stacked l={caps} form={form} stacked={stacked} />
      </span>
    </>
  );
  const titleRefCb = (el: HTMLElement | null) => {
    titleEl.current = el;
    setRef(titleRef, el);
  };
  return (
    <>
      <div ref={barRef} className={`nb-bar ${wideTrailing ? 'has-seg' : ''}`.trim()}>
        {pressable ? (
          <Pressable ref={capRef} className="nb-cap" label={titleLabel} {...tp}>
            {capInner}
          </Pressable>
        ) : (
          <div ref={capRef as React.Ref<HTMLDivElement>} className="nb-cap">
            {capInner}
          </div>
        )}
        {pressable ? (
          <Pressable as="div" className="nb-inline" tabIndex={-1} aria-hidden="true" {...tp}>
            <Stacked l={title} stacked={stacked} />
          </Pressable>
        ) : (
          <div className="nb-inline" aria-hidden="true">
            <Stacked l={title} stacked={stacked} />
          </div>
        )}
        <div className="nb-trail">
          <AnimatePresence initial={false}>
            <motion.div key={keyOf(trailing)} className="nb-trail-item" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: fadeIn }} exit={{ opacity: 0, transition: fadeOut }}>
              {trailing}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      {/* the page's level-1 heading (code review 1 #8); its tap and hold are the caps line's too, which is the button VoiceOver reads */}
      {pressable ? (
        <Pressable as="div" ref={titleRefCb} className="nb-title" role="heading" aria-level={1} tabIndex={-1} {...tp}>
          <Stacked l={title} stacked={stacked} />
        </Pressable>
      ) : (
        <h1 ref={titleRefCb} className="nb-title">
          <Stacked l={title} stacked={stacked} />
        </h1>
      )}
      {children}
      <div className={`nb-gap ${gap === 24 ? 'lg' : ''}`.trim()} />
    </>
  );
};

// ---------- the date strip (Today only) ----------
export type StripStatus = 'done' | 'bonus' | 'floor' | 'planned' | 'missed' | 'skipped' | 'rest' | null;
export interface DateStripProps {
  shown: string;
  today: string;
  handle: DayPagerHandle;
  stripRef?: React.Ref<HTMLElement>;
  statusOf: (date: string) => StripStatus;
  onPick: (date: string) => void;
  labelOf?: (date: string) => string;
}
const STATUS_WORD: Record<Exclude<StripStatus, null>, string> = { done: 'done', bonus: 'bonus run', floor: 'floor', planned: 'planned run', missed: 'missed', skipped: 'skipped', rest: 'rest' };

/**
 * Mon–Sun of the shown day's week, seven full-bleed cells (W / 7 × 52). The disc is one element translated to
 * `(cellIndex + progress × span) × cellPitch`, clamped to the first and last cells, so it rides every drag, slide and goTo.
 * A cell tap is `onPick` (no haptic); a drag that began in the strip ticks `select` each time the disc's centre crosses a
 * cell boundary (a drag that began anywhere else never ticks). A new week crossfades its cells in over 120 ms.
 */
export const DateStrip = ({ shown, today, handle, stripRef, statusOf, onPick, labelOf }: DateStripProps): React.JSX.Element => {
  const mon = mondayOfIso(shown);
  const days = Array.from({ length: 7 }, (_, i) => iso(D(mon).getTime() + i * 86_400_000));
  const idx = days.indexOf(shown);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const discRef = useRef<HTMLDivElement>(null);
  const fromStrip = useRef(false);
  const lastCell = useRef(idx);
  const seenMon = useRef(mon);

  useLayoutEffect(() => {
    const strip = rootRef.current!;
    const disc = discRef.current!;
    let pitch = strip.clientWidth / 7;
    const write = () => {
      const pos = Math.max(0, Math.min(6, idx + handle.progress.get() * handle.span.get()));
      disc.style.transform = `translateX(${(pos * pitch).toFixed(2)}px)`;
      if (fromStrip.current) {
        const c = Math.round(pos);
        if (c !== lastCell.current) {
          lastCell.current = c;
          haptics.select();
        }
      } else lastCell.current = Math.round(pos);
    };
    write();
    const offs = [handle.progress.on('change', write), handle.span.on('change', write)];
    const ro = new ResizeObserver(() => {
      pitch = strip.clientWidth / 7;
      write();
    });
    ro.observe(strip);
    return () => {
      offs.forEach((f) => f());
      ro.disconnect();
    };
  }, [idx, handle]);

  // the week changed on this commit: its cells crossfade in (the disc has already landed on its cell)
  useLayoutEffect(() => {
    if (seenMon.current === mon) return;
    seenMon.current = mon;
    for (const c of Array.from(rootRef.current?.querySelectorAll<HTMLElement>('.nb-cell') ?? [])) c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
  }, [mon]);

  const onDown = (e: React.PointerEvent) => {
    if (!e.isPrimary) return;
    fromStrip.current = true;
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      fromStrip.current = false;
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
    };
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
  };

  return (
    <div
      className="nb-strip"
      ref={(el) => {
        rootRef.current = el;
        setRef(stripRef, el);
      }}
      role="group"
      aria-label="Week"
      onPointerDown={onDown}
    >
      <div ref={discRef} className={`nb-disc ${shown === today ? 'is-today' : ''}`.trim()} aria-hidden="true" />
      {days.map((d) => {
        const s = statusOf(d);
        const name = labelOf?.(d) ?? `${fmt(d, { weekday: 'long', month: 'long', day: 'numeric' })}${s ? `, ${STATUS_WORD[s]}` : ''}`;
        return (
          <Pressable key={d} className={`nb-cell ${d === shown ? 'is-shown' : ''} ${d === today ? 'is-today' : ''}`} label={name} aria-current={d === shown ? 'date' : undefined} data-date={d} onPress={() => d !== shown && onPick(d)}>
            <span className="nb-letter">{fmt(d, { weekday: 'narrow' })}</span>
            <span className="nb-num tnum">{DAYN(d)}</span>
            <span className={`nb-dot ${s ? `is-${s}` : ''}`.trim()} />
          </Pressable>
        );
      })}
    </div>
  );
};

/** 32 tall, --accent-tint, 'Today', 44 hit via ::after. No haptic. */
export const TodayPill = ({ onPress }: { onPress: () => void }): React.JSX.Element => (
  <Pressable className="today-pill" onPress={onPress} label="Today">
    Today
  </Pressable>
);

// ---------- pushed pages ----------
/** The parent's title for a pushed entry: the tab's name at depth 1, the depth-1 page's title at depth 2. */
const useParentTitle = () => {
  const entry = usePushedEntry();
  const ctl = useNavInternal();
  // a selector: the chevron re-renders when its parent's title changes, not on every NavState change
  const get = () => {
    if (!entry) return null;
    const st = ctl.state;
    for (const t of Object.keys(st.tabs) as Array<keyof typeof st.tabs>) {
      const stack = st.tabs[t].stack;
      const i = stack.findIndex((e) => e.key === entry.key);
      if (i < 0) continue;
      return i === 0 ? tabDef(t).label : stack[i - 1]!.title;
    }
    return null;
  };
  return useSyncExternalStore(ctl.subscribe, get, get);
};

/** The 44 × 44 chevron of a pushed page: pops the layer it is in. Labelled with the parent's title. */
export const BackButton = ({ label }: { label?: string }): React.JSX.Element => {
  const pop = usePop();
  const parent = useParentTitle();
  const press = usePress();
  const name = label ?? (parent ? `Back to ${parent}` : 'Back');
  return (
    <button type="button" className="icon-btn back-btn pressable" data-press="scale" aria-label={name} title={name} {...press.handlers} onClick={pop}>
      <ChevronLeft size={26} strokeWidth={2.2} aria-hidden="true" />
    </button>
  );
};

export interface PushedBarProps {
  title: string;
  eyebrow?: ReactNode;
  trailing?: ReactNode;
  /** Default 'Back to <the parent's title>'. */
  backLabel?: string;
}
/** 44 + --safe-t, sticky, --bg: the chevron, the title centred (an optional caps eyebrow under it), one trailing action. */
export const PushedBar = ({ title, eyebrow, trailing, backLabel }: PushedBarProps): React.JSX.Element => (
  <header className="pushed-bar">
    <BackButton label={backLabel} />
    <div className="pb-text">
      <h1 className="pb-title" tabIndex={-1}>
        {title}
      </h1>
      {eyebrow ? <span className="pb-eyebrow caps">{eyebrow}</span> : null}
    </div>
    <div className="pb-trail">{trailing}</div>
  </header>
);

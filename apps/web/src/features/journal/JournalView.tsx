import type { Quote } from '@logbook/shared';
import { memo, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useHomeControl, useNav, useRootRequest, useRouteParams, useTabScroller } from '@/app/NavController';
import { crossfade, ease } from '@/lib/motion';
import { useToday } from '@/lib/useToday';
import { dayCaption, NavBar, Segmented } from '@/ui';
import { addToDraft } from './JournalDaySection';
import { asPrompt, JournalHome } from './JournalHome';
import { Library } from './Library';
import './journal.css';
import './seg.css';

type Seg = 'journal' | 'library';
// a switch re-renders the view, never the panes (their props are stable): at 4× the two trees cost ~200 ms to render
const JournalPane = memo(JournalHome);
const LibraryPane = memo(Library);
const segOf = (p: Readonly<Record<string, string>>): Seg => (p.segment === 'library' ? 'library' : 'journal');
const pathOf = (s: Seg) => (s === 'journal' ? '/journal' : '/journal/library');
const FADE_MS = ((crossfade as { duration?: number }).duration ?? 0.15) * 1000;
const EASING = `cubic-bezier(${ease.join(', ')})`;

/**
 * Journal (docs/feel.md §8, M28; build plan §7.2 item 1). The NavBar (caps the date, title `Journal`, nothing trailing), then
 * `Journal · Library` as a 32 px Segmented pinned under the bar. Both panes stay mounted; a switch is a 150 ms crossfade, and
 * each pane keeps its own scroll offset: the tab scroller's offset is saved per segment and the incoming one is restored on
 * the commit frame, while the outgoing pane is held still on screen by a transform until its fade ends. The segment is page
 * state, mirrored with `nav.replace` and changed from outside only through `useRootRequest` (a cut sets it at once).
 */
export default function JournalView() {
  const params = useRouteParams();
  const nav = useNav();
  const today = useToday();
  const scroller = useTabScroller();
  const [seg, setSeg] = useState<Seg>(() => segOf(params));
  // the pane that is fading out (absolute, held still) during a switch; null at rest
  const [leaving, setLeaving] = useState<Seg | null>(null);
  const live = useRef(seg);
  live.current = seg;
  const offsets = useRef<Record<Seg, number>>({ journal: 0, library: 0 });
  const pending = useRef<{ from: Seg; old: number; fade: boolean } | null>(null);
  const journalPane = useRef<HTMLElement>(null);
  const libraryPane = useRef<HTMLElement>(null);
  const paneOf = (s: Seg) => (s === 'journal' ? journalPane : libraryPane).current;
  const fades = useRef<Animation[]>([]);
  const [focusKey, setFocusKey] = useState(0);

  const show = useCallback(
    (to: Seg, fade = true) => {
      const from = live.current;
      if (to === from) return;
      const old = scroller.current?.scrollTop ?? 0;
      offsets.current[from] = old;
      pending.current = { from, old, fade };
      setSeg(to);
      setLeaving(fade ? from : null);
      nav.replace(pathOf(to));
    },
    [nav, scroller],
  );

  // the commit frame of a switch: the incoming pane's offset comes back, the outgoing pane is held where it was and fades
  useLayoutEffect(() => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    // a switch inside a running fade (a double tap, a cut, a reselect): the fades stop and so does their hold-still
    // transform; a cancelled animation never fires `finish`, so it is cleared here, on both panes (review code F1)
    for (const a of fades.current) a.cancel();
    fades.current = [];
    for (const el of [journalPane.current, libraryPane.current]) if (el) el.style.transform = '';
    const sc = scroller.current;
    if (sc) sc.scrollTop = offsets.current[seg];
    const now = sc?.scrollTop ?? 0;
    const inc = paneOf(seg);
    const out = paneOf(p.from);
    if (!p.fade || !out || !inc) return;
    out.style.transform = `translateY(${now - p.old}px)`;
    const aIn = inc.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: EASING });
    const aOut = out.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: EASING, fill: 'forwards' });
    fades.current = [aIn, aOut];
    aOut.onfinish = () => {
      // the leaving pane goes off on the frame its fill is dropped
      flushSync(() => setLeaving((l) => (l === p.from ? null : l)));
      out.style.transform = '';
      aOut.cancel();
    };
  }, [seg]); // eslint-disable-line react-hooks/exhaustive-deps

  useHomeControl({ atHome: seg === 'journal', goHome: () => show('journal') });
  useRootRequest((p, how) => {
    const want = segOf(p);
    if (want === live.current) return;
    // a cut: the first frame that shows Journal is already on the segment, no fade
    show(want, !how.cut);
  });

  /** "Write" from the library (a quote's sheet or a row's menu): the quote goes on top of today's draft, the composer opens. */
  const todayRef = useRef(today);
  todayRef.current = today;
  const writeAbout = useCallback(
    (q: Quote) => {
      addToDraft(todayRef.current, asPrompt(q));
      show('journal');
      setFocusKey((k) => k + 1);
    },
    [show],
  );

  const cls = (s: Seg) => (seg === s ? 'is-on' : leaving === s ? 'is-leaving' : 'is-off');
  // the hidden pane is `content-visibility: hidden` (not drawn, hit or focusable) and aria-hidden; no `inert`: flipping it
  // restyles a whole pane on the commit frame. The leaving pane sits under the incoming one, which takes every touch.
  const off = (s: Seg) => (seg !== s && leaving !== s) || undefined;
  return (
    <div className="page journal-page">
      <NavBar caps={{ cur: dayCaption(today, today) }} title={{ cur: 'Journal' }} gap={24}>
        <div className="j-segrow">
          <Segmented
            className="j-seg"
            label="Journal or library"
            options={[
              ['journal', 'Journal'],
              ['library', 'Library'],
            ]}
            value={seg}
            onChange={(s: Seg) => show(s)}
          />
        </div>
      </NavBar>
      <div className="j-panes">
        <section ref={journalPane} className={`j-pane ${cls('journal')}`} aria-hidden={off('journal')} aria-label="Journal">
          <JournalPane today={today} focusKey={focusKey} />
        </section>
        {/* both mounted and laid out from the start (the hidden one is visibility: hidden): a switch restyles, never mounts */}
        <section ref={libraryPane} className={`j-pane ${cls('library')}`} aria-hidden={off('library')} aria-label="Library">
          <LibraryPane onWrite={writeAbout} />
        </section>
      </div>
    </div>
  );
}

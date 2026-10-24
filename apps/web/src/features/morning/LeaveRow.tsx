import { clockOfDay, durationWords, type MorningTimeline } from '@logbook/shared';
import { Briefcase } from 'lucide-react';
import type * as React from 'react';
import { forwardRef, useLayoutEffect, useRef, useState } from 'react';
import { Pressable } from '@/ui';
import { drawnY } from './flip';
import { short, whenSettled } from './model';

/** What the Leave row's sub says: the countdown today, the lateness when the run eats into the routine. */
const subOf = (T: MorningTimeline, rel: 'past' | 'today' | 'future', now: number) => {
  // the late note above says by how much against the routine; this row says it in two words (feel review 1 FL6)
  if (T.late) return `${T.late} min late`;
  if (rel !== 'today') return `${durationWords(T.leave - T.day.wake)} after waking`;
  if (now >= T.leave) return 'Out for the day';
  return `In ${durationWords(Math.max(1, Math.ceil(T.leave - now)))}`;
};

/**
 * The endpoint (spec §4.4): the schedule's last row, `Leave for work` with its countdown and the stamp on the right. It sticks
 * to the bottom of the page scroller (`position: sticky; bottom: 0`) inside the schedule group, so it is always on screen
 * while the group reaches the viewport's bottom; a short list leaves it in its natural place. Late, its sub says by how much
 * in `--warn` (no glow). It tells the toast host how much room it takes (`--toast-lift` on the pushed page), so a toast on
 * This morning sits above it. A tap opens the routine editor on its leave field.
 */
export const LeaveRow = forwardRef<HTMLLIElement, { T: MorningTimeline; rel: 'past' | 'today' | 'future'; now: number; moved?: boolean; onPress?: () => void }>(function LeaveRow({ T, rel, now, moved, onPress }, fwd): React.JSX.Element {
  const ref = useRef<HTMLLIElement | null>(null);
  const sub = subOf(T, rel, now);
  const gone = rel === 'past' || (rel === 'today' && now >= T.leave);
  // the stamp rolls (§4.5, §0.2): a new time fades in over the old one in the same box, 120 ms (the alarm stamp's two
  // stacked labels), so a Skip or a routine change reads as the Leave time changing, not as a cut
  const text = short(T.leave);
  const [labels, setLabels] = useState({ cur: text, prev: null as string | null, n: 0 });
  if (labels.cur !== text) setLabels({ cur: text, prev: labels.cur, n: labels.n + 1 });

  // --toast-lift: from the scroller's bottom up to where this row rests (a FLIP still running is left out), kept current on
  // every render, scroll and resize, so a toast raised after a change sits above the row's new place
  const put = () => {
    const li = ref.current;
    const sc = li?.closest<HTMLElement>('.pushed');
    if (!li || !sc) return;
    const flip = drawnY(li);
    const lift = `${Math.max(0, Math.round(sc.getBoundingClientRect().bottom - (li.getBoundingClientRect().top - flip)))}px`;
    // a custom property set on the page invalidates the style of everything under it: only when it changed
    if (sc.style.getPropertyValue('--toast-lift') !== lift) sc.style.setProperty('--toast-lift', lift);
  };
  const putRef = useRef(put);
  putRef.current = put;
  // measured on the frame after a render, never inside it: a synchronous read here forced the new page's first layout inside
  // the push's commit (WP1's N4). The first measure waits until the push has settled (an idle moment after its slide): read
  // in the first frames it forced the page's style and layout inside the slide (feel review 1 FL4). A toast is raised after
  // the morning has re-laid and painted (MorningView), so a later render's measure has run by then.
  const pending = useRef(0);
  const first = useRef(true);
  const settling = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      settling.current = whenSettled(() => {
        settling.current = null;
        putRef.current();
      });
      return;
    }
    if (!pending.current)
      pending.current = requestAnimationFrame(() => {
        pending.current = 0;
        putRef.current();
      });
  });
  useLayoutEffect(
    () => () => {
      cancelAnimationFrame(pending.current);
      settling.current?.();
    },
    [],
  );
  useLayoutEffect(() => {
    const li = ref.current;
    const sc = li?.closest<HTMLElement>('.pushed');
    if (!li || !sc) return;
    let raf = 0;
    const later = () => {
      // the observer's first call comes on the push's first frame: the settled measure covers it
      if (settling.current) return;
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          putRef.current();
        });
    };
    sc.addEventListener('scroll', later, { passive: true });
    const ro = new ResizeObserver(later);
    ro.observe(sc);
    ro.observe(li.parentElement ?? li);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      sc.removeEventListener('scroll', later);
      ro.disconnect();
      sc.style.removeProperty('--toast-lift');
    };
  }, []);

  const body = (
    <>
      <span className="sch-time-slot" aria-hidden="true" />
      <span className="sch-ico" aria-hidden="true">
        <Briefcase size={18} />
      </span>
      <span className="sch-main">
        {/* 320 (FL9): the row keeps the time column with the others, so the name says `Leave` (the stamp says when) */}
        <span className="sch-name">
          Leave<span className="sub-wide"> for work</span>
        </span>
        <span className={`sch-sub ${T.late ? 'is-late' : ''}`}>{/^(.+?)( after waking)$/.test(sub) ? <>{sub.replace(/ after waking$/, '')}<span className="sub-wide"> after waking</span></> : sub}</span>
      </span>
      <span className={`leave-stamp ${moved ? 'is-moved' : ''}`}>
        <span key={`c${labels.n}`} className={`ah-d ${labels.n ? 'is-in' : ''}`}>
          {labels.cur}
        </span>
        <span className="sch-flash" aria-hidden="true" data-t={labels.cur} />
        {labels.prev != null ? (
          <span key={`p${labels.n}`} className="ah-d is-out" aria-hidden="true" onAnimationEnd={() => setLabels((l) => (l.n === labels.n ? { ...l, prev: null } : l))}>
            {labels.prev}
          </span>
        ) : null}
      </span>
    </>
  );
  return (
    <li
      ref={(n) => {
        ref.current = n;
        if (typeof fwd === 'function') fwd(n);
        else if (fwd) fwd.current = n;
      }}
      className={`sch-row leave-row ${gone ? 'past' : ''} ${T.late ? 'late' : ''}`}
      data-row="leave"
    >
      {onPress ? (
        <Pressable as="div" className="sch-hit" press="surface" onPress={onPress} label={`Leave for work at ${clockOfDay(T.leave)}. ${sub}. Edit the routine`}>
          {body}
        </Pressable>
      ) : (
        <div className="sch-hit" aria-label={`Leave for work at ${clockOfDay(T.leave)}. ${sub}`}>
          {body}
        </div>
      )}
    </li>
  );
});

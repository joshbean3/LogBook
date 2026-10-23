import { shiftDays, today as todayISO } from '@logbook/shared';
import { useMotionValueEvent } from 'motion/react';
import type * as React from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Avatar } from '@/ui/Avatar';
import { DayPager, useDayPagerHandle } from '@/ui/DayPager';
import { capsWord, DateStrip, dayCaption, dayTitle, NavBar, TodayPill, type StripStatus } from '@/ui/NavBar';
import { Pressable } from '@/ui/Pressable';

/**
 * /dev/ui › Pager lab: a stub Today built only from the WP1 primitives, filling the gallery's own scroller (the `.pushed`
 * layer) the way a tab root fills its `.tab-scroll`: `NavBar` as the page element's first children (the sticky bar, the
 * large title, the DateStrip, the gap), then `DayPager` with stub pages of 600 / 1400 / 900 px (by date), each with a card
 * that has a tap and a hold menu, a field and an orb-like row marked `data-no-page`. The acceptance scripts drive it
 * (`window.__lab`, `window.__pager`); it is also the place to feel the pager by hand.
 */
const HEIGHTS = [600, 1400, 900];
const dayNum = (d: string) => Math.round(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000);
const heightOf = (d: string) => HEIGHTS[((dayNum(d) % 3) + 3) % 3]!;
const STATUS: StripStatus[] = ['done', 'floor', 'rest', 'missed', 'planned', 'planned', 'bonus'];

type LabWin = Window & {
  __lab?: { date: () => string; setDate: (d: string) => void; renders: number; taps: string[]; today: string; setWord: (w: string | null) => void; titlePresses: number };
  __pager?: ReturnType<typeof useDayPagerHandle>;
};
const w = window as LabWin;

const StubPage = ({ date, live, today, tools }: { date: string; live: boolean; today: string; tools: React.ReactNode }) => {
  const n = dayNum(date) - dayNum(today);
  const hue = (((n * 47) % 360) + 360) % 360;
  return (
    <div className="lab-page" data-stub-date={date} style={{ height: heightOf(date), background: `hsl(${hue} 45% 22%)` }}>
      <div className="lab-page-head">
        <span className="caps">{dayCaption(date)}</span>
        <span className="lab-page-n tnum">{heightOf(date)} px</span>
      </div>
      <Pressable
        as="div"
        className="lab-card"
        onPress={() => w.__lab?.taps.push(`tap ${date}`)}
        holdMenu={[
          { label: 'Done', onSelect: () => w.__lab?.taps.push(`menu-done ${date}`) },
          { label: 'Skip', onSelect: () => w.__lab?.taps.push(`menu-skip ${date}`) },
        ]}
        menuLabel="Stub card actions"
      >
        {live ? 'Tap or hold me' : 'neighbour'} · {dayTitle(date, today)}
      </Pressable>
      <div className="lab-orbs" data-no-page="">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className="lab-orb">
            {i + 1}
          </span>
        ))}
      </div>
      {tools}
      <input className="lab-input" placeholder="A field (never pages)" aria-label="Lab field" />
      {Array.from({ length: Math.floor((heightOf(date) - 300) / 120) }, (_, i) => (
        <div key={i} className="lab-row">
          Row {i + 1}
        </div>
      ))}
    </div>
  );
};

export const PagerLab = ({ onClose }: { onClose: () => void }) => {
  const today = todayISO();
  const handle = useDayPagerHandle();
  const [date, setDate] = useState(today);
  const [word, setWord] = useState<string | null>('STEADY');
  const [tgt, setTgt] = useState<string | null>(null);
  useMotionValueEvent(handle.target, 'change', setTgt);
  const stripRef = useRef<HTMLElement | null>(null);
  const titleRef = useRef<HTMLElement | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef(date);
  dateRef.current = date;
  const lab = (w.__lab ??= { date: () => '', setDate: () => {}, renders: 0, taps: [], today, setWord: () => {}, titlePresses: 0 });
  lab.renders++;
  lab.date = () => dateRef.current;
  lab.setDate = setDate;
  lab.setWord = setWord;
  lab.today = today;
  w.__pager = handle;

  useEffect(() => handle.attach([stripRef.current, titleRef.current]), [handle]);
  // the gallery's scroller plays the tab scroller: --scroller-h from a ResizeObserver, and the bar's hairline from --hdr
  useLayoutEffect(() => {
    const sc = pageRef.current?.closest<HTMLElement>('.pushed');
    if (!sc) return;
    const top = sc.scrollTop;
    sc.scrollTop = 0;
    const ro = new ResizeObserver(() => sc.style.setProperty('--scroller-h', `${sc.clientHeight}px`));
    ro.observe(sc);
    const onScroll = () => sc.querySelector('.nb-bar')?.classList.toggle('is-collapsed', sc.scrollTop / 44 >= 0.99);
    sc.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      ro.disconnect();
      sc.removeEventListener('scroll', onScroll);
      sc.style.removeProperty('--scroller-h');
      sc.scrollTop = top;
    };
  }, []);

  const prev = tgt && tgt < date ? tgt : shiftDays(date, -1);
  const next = tgt && tgt > date ? tgt : shiftDays(date, 1);
  const goHome = () => handle.goTo(today);
  const tools = (
      <div className="lab-tools">
          <button type="button" className="lab-go lab-go-p1" onClick={() => handle.goTo(shiftDays(date, 1))}>
            +1
          </button>
          <button type="button" className="lab-go lab-go-p5" onClick={() => handle.goTo(shiftDays(date, 5))}>
            +5
          </button>
          <button type="button" className="lab-go lab-go-p12" onClick={() => handle.goTo(shiftDays(date, 12))}>
            +12
          </button>
          <button type="button" className="lab-go lab-go-xf" onClick={() => handle.goTo(shiftDays(date, 1), { mode: 'crossfade' })}>
            +1 fade
          </button>
          <button type="button" className="lab-go lab-close" onClick={onClose}>
            Close lab
          </button>
        </div>
  );
  return (
    <div ref={pageRef} className="gal-lab" data-lab-date={date}>
      <NavBar
        word={capsWord(word)}
        caps={{ prev: dayCaption(prev, today), cur: dayCaption(date, today), next: dayCaption(next, today) }}
        title={{ prev: dayTitle(prev, today), cur: dayTitle(date, today), next: dayTitle(next, today) }}
        progress={handle.progress}
        trailing={date === today ? <Avatar key="avatar" /> : <TodayPill key="pill" onPress={goHome} />}
        onTitlePress={() => {
          lab.titlePresses++;
          if (dateRef.current !== today) goHome();
        }}
        titleMenu={[
          { label: 'Change the word', onSelect: () => setWord((v) => (v === 'RELENTLESSLY' ? 'STEADY' : 'RELENTLESSLY')) },
          { label: 'Clear the word', onSelect: () => setWord(null) },
          { label: 'Go to a day…', onSelect: () => handle.goTo(shiftDays(dateRef.current, 12)) },
        ]}
        titleLabel={`${dayTitle(date, today)}. Go to today`}
        titleRef={titleRef}
        gap={16}
      >
        <DateStrip shown={date} today={today} handle={handle} stripRef={stripRef} statusOf={(d) => STATUS[(dayNum(d) % 7 + 7) % 7] ?? null} onPick={(d) => handle.goTo(d)} />
      </NavBar>
      <DayPager date={date} step="day" handle={handle} onCommit={setDate} render={(d, live) => <StubPage date={d} live={live} today={today} tools={live ? tools : null} />} label="Day" prevLabel="Previous day" nextLabel="Next day" />
    </div>
  );
};

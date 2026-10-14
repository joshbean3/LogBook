import { shiftDays, today } from '@logbook/shared';
import { ArrowRightLeft, Check, Clock, Copy, Pencil, Share, Star, Trash2 } from 'lucide-react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { HAPTIC_EVENT, haptics, useHapticsEnabled, type HapticEvent } from '@/lib/haptics';
import { springs, type SpringName } from '@/lib/motion';
import { Avatar } from '@/ui/Avatar';
import { ContextMenu, useContextMenu, type ContextMenuItem } from '@/ui/ContextMenu';
import { DatePager } from '@/ui/DatePager';
import { dateLine, PushedHeader, TabHeader } from '@/ui/headers';
import { Pressable } from '@/ui/Pressable';
import { Button, ChipButton, EmptyState, Loading, Section, Segmented } from '@/ui/primitives';
import { shared, useSheet, useSheetDepth } from '@/ui/Sheet';
import { Skeleton, SkeletonGroup, SkeletonPage, SkeletonRows } from '@/ui/Skeleton';
import { SwipeRow } from '@/ui/SwipeRow';
import { Ticker } from '@/ui/Ticker';
import { useToast } from '@/ui/Toast';
import { resetSeenToday, useFirstToday } from '@/ui/useFirstToday';
import { WeekRing, type WeekDayStatus } from '@/ui/WeekRing';
import './gallery.css';

/**
 * /dev/ui: every foundation primitive in every state, on a phone-sized page, for page teams and reviewers. Not in the tab
 * bar. The pill at the bottom names the last haptic that fired, so haptics can be checked on a desktop or in Safari.
 */

const HAPTICS: HapticEvent[] = ['select', 'toggle', 'orb', 'lift', 'drop', 'threshold', 'success', 'celebrate', 'delete', 'warning', 'error'];

const HapticLog = () => {
  const [last, setLast] = useState<{ name: string; n: number } | null>(null);
  useEffect(() => {
    const on = (e: Event) => setLast((l) => ({ name: (e as CustomEvent<string>).detail, n: (l?.n ?? 0) + 1 }));
    window.addEventListener(HAPTIC_EVENT, on);
    return () => window.removeEventListener(HAPTIC_EVENT, on);
  }, []);
  return (
    <div className="gal-hlog t-cap" role="status" aria-live="polite" data-testid="haptic-log">
      {last ? (
        <>
          haptics.<b>{last.name}</b>() · {last.n}
        </>
      ) : (
        'No haptic yet'
      )}
    </div>
  );
};

const Demo = ({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) => (
  <div className="gal-demo">
    <div className="gal-demo-head">
      <span className="caps">{title}</span>
      {note ? <span className="t-cap muted">{note}</span> : null}
    </div>
    {children}
  </div>
);

const SpringBox = ({ name }: { name: SpringName }) => {
  const x = useMotionValue(0);
  const left = useTransform(x, (v) => `calc(${v * 100}% - ${v * 20}px)`);
  const reduce = useReducedMotion();
  const [out, setOut] = useState(false);
  return (
    <button
      type="button"
      className="gal-spring"
      onClick={() => {
        setOut(!out);
        void animate(x, out ? 0 : 1, reduce ? { duration: 0.15 } : springs[name]);
      }}
    >
      <span className="gal-spring-name">{name}</span>
      <span className="gal-spring-track">
        <motion.span className="gal-spring-dot" style={{ left }} />
      </span>
    </button>
  );
};

type Todo = { id: number; text: string; done: boolean; later: boolean };
const START_TODOS: Todo[] = [
  { id: 1, text: 'Buy trail shoes', done: false, later: false },
  { id: 2, text: 'Book the physio for Thursday', done: false, later: false },
  { id: 3, text: 'Renew the race entry before the price goes up on Friday', done: false, later: false },
  { id: 4, text: 'Stretch 10 min', done: false, later: false },
];

const SessionRow = ({ name, sub, id }: { name: string; sub: string; id: string }) => (
  <div className="gal-session" data-id={id}>
    <span className="gal-bar t-easy" />
    <span className="gal-session-main">
      <span className="stamp gal-session-name">{name}</span>
      <span className="t-sub muted">{sub}</span>
    </span>
    <Check size={18} className="muted" aria-hidden="true" />
  </div>
);

const SheetBody = ({ level }: { level: number }) => {
  const sheet = useSheet();
  const depth = useSheetDepth();
  return (
    <>
      <p className="ink2">Panel {depth} of the stack. Push another, or use the chevron (or Back below) to pop.</p>
      <div className="row wrap">
        <Button variant="soft" onClick={() => sheet.push({ title: level === 1 ? 'Edit' : 'Move', eyebrow: `Level ${level + 1}`, body: <SheetBody level={level + 1} /> })}>
          Push
        </Button>
        <Button variant="quiet" onClick={() => sheet.pop()}>
          Back
        </Button>
        <Button variant="quiet" onClick={() => sheet.update({ title: `Renamed ${depth}` })}>
          Rename
        </Button>
      </div>
      {level > 1
        ? Array.from({ length: 6 }, (_, i) => (
            <p key={i} className="fine">
              A longer panel, line {i + 1}, so the height change is visible.
            </p>
          ))
        : null}
    </>
  );
};

const AURA_STATES = ['done', 'floor', 'missed', 'upcoming', 'rest'] as const;

export default function UiGallery() {
  const sheet = useSheet();
  const toast = useToast();
  const menu = useContextMenu();
  const reduce = useReducedMotion();
  const [hOn, setHOn] = useHapticsEnabled();
  const [pressed, setPressed] = useState('Nothing yet');
  const [todos, setTodos] = useState(START_TODOS);
  const [n, setN] = useState(26.2);
  const [seg, setSeg] = useState<'week' | 'month'>('week');
  const [date, setDate] = useState(today());
  const [halo, setHalo] = useState<(typeof AURA_STATES)[number]>('done');
  const [ringKey, setRingKey] = useState(0);
  const firstToday = useFirstToday('gallery-demo');
  const t = today();

  const items = (name: string): ContextMenuItem[] => [
    { label: 'Edit', icon: <Pencil size={18} />, onSelect: () => toast(`Edit ${name}`) },
    { label: 'Move', icon: <ArrowRightLeft size={18} />, onSelect: () => toast(`Move ${name}`) },
    { label: 'Share', icon: <Share size={18} />, onSelect: () => toast(`Share ${name}`) },
    { label: 'Skip (disabled)', icon: <Clock size={18} />, onSelect: () => undefined, disabled: true },
    { label: 'Delete', icon: <Trash2 size={18} />, destructive: true, onSelect: () => (haptics.delete(), toast('Deleted', { label: 'Undo', fn: () => toast('Restored') })) },
  ];
  const week: WeekDayStatus[] = ['done', 'floor', 'rest', 'missed', 'done', 'open', 'future'];
  const todayIdx = (new Date().getDay() + 6) % 7;

  return (
    <div className="page gal">
      <PushedHeader title="UI" eyebrow="Foundation · dev only" right={<Avatar />} />
      <p className="ink2 gal-lead">Every primitive in every state. The pill at the bottom names each haptic as it fires.</p>

      <Section title="Haptics" meta={hOn ? 'On' : 'Off'}>
        <div className="sec-group">
          <label className="gal-switch">
            <input type="checkbox" checked={hOn} onChange={(e) => setHOn(e.target.checked)} /> Haptics (logbook.haptics)
          </label>
          <div className="gal-chips">
            {HAPTICS.map((h) => (
              <ChipButton key={h} onClick={() => haptics[h]()}>
                {h}
              </ChipButton>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Springs" meta={reduce ? 'Reduced motion: 150ms fades' : 'Tap a row'}>
        <div className="gal-springs">
          {(Object.keys(springs) as SpringName[]).map((k) => (
            <SpringBox key={k} name={k} />
          ))}
        </div>
      </Section>

      <Section title="Pressable" meta={pressed}>
        <div className="gal-chips">
          <Pressable className="gal-press" onPress={() => setPressed('Pressed')}>
            Press
          </Pressable>
          <Pressable className="gal-press" haptic="toggle" onPress={() => setPressed('Pressed with toggle')}>
            With haptic
          </Pressable>
          <Pressable className="gal-press" onPress={() => setPressed('Tapped')} onLongPress={(i) => setPressed(`Long-pressed (${i.source})`)}>
            Hold me
          </Pressable>
          <Pressable as="div" className="gal-press" onPress={() => setPressed('Div pressed')}>
            As a div
          </Pressable>
          <Pressable className="gal-press" disabled onPress={() => setPressed('never')}>
            Disabled
          </Pressable>
        </div>
      </Section>

      <Section title="Context menu" meta="Hold a row, or Shift+F10">
        <div className="sec-group">
          <ContextMenu items={items('Easy 6')} label="Easy 6">
            <button type="button" className="gal-card-btn" onClick={() => toast('Tapped Easy 6: the tap still works')}>
              <SessionRow name="Easy 6" sub="6.0 mi · 8:40/mi" id="a" />
            </button>
          </ContextMenu>
          <ContextMenu items={items('Long 12')} label="Long 12" preview={<SessionRow name="Long 12" sub="A bigger preview: route, splits, notes" id="p" />}>
            <button type="button" className="gal-card-btn" onClick={() => toast('Tapped Long 12')}>
              <SessionRow name="Long 12" sub="With a preview" id="b" />
            </button>
          </ContextMenu>
          <Button variant="quiet" onClick={(e) => menu.open({ items: items('imperative'), anchor: e.currentTarget, label: 'Imperative actions' })}>
            useContextMenu().open()
          </Button>
        </div>
      </Section>

      <Section title="Swipe rows" meta="→ Done · ← Later">
        <div className="list-edge" data-testid="swipe-list">
          {todos.map((td) => (
            <SwipeRow
              key={td.id}
              label={td.text}
              right={{
                label: td.done ? 'Undo' : 'Done',
                icon: <Check size={20} />,
                tone: 'ok',
                onCommit: () => (haptics.toggle(), setTodos((l) => l.map((x) => (x.id === td.id ? { ...x, done: !x.done } : x)))),
              }}
              left={
                td.id === 4
                  ? {
                      label: 'Delete',
                      icon: <Trash2 size={20} />,
                      tone: 'bad',
                      onCommit: () => (haptics.delete(), setTodos((l) => l.filter((x) => x.id !== td.id)), toast('Deleted', { label: 'Undo', fn: () => setTodos(START_TODOS) })),
                    }
                  : { label: 'Later', icon: <Clock size={20} />, tone: 'warn', onCommit: () => setTodos((l) => l.map((x) => (x.id === td.id ? { ...x, later: !x.later } : x))) }
              }
              menuItems={[{ label: 'Copy', icon: <Copy size={18} />, onSelect: () => toast('Copied') }]}
            >
              <div className="gal-todo">
                <span className={`gal-check ${td.done ? 'on' : ''}`}>{td.done ? <Check size={14} strokeWidth={3} /> : null}</span>
                <span className={`gal-todo-text ${td.done ? 'done' : ''}`}>{td.text}</span>
                {td.later ? <span className="t-cap muted">Later</span> : null}
              </div>
            </SwipeRow>
          ))}
        </div>
        <Button variant="quiet" size="sm" onClick={() => setTodos(START_TODOS)}>
          Reset rows
        </Button>
      </Section>

      <Section title="Ticker" meta="Springs on change, still on mount">
        <div className="sec-group">
          <div className="row">
            <span className="stamp gal-big">
              <Ticker value={n} format={(v) => v.toFixed(1)} />
              <small> mi</small>
            </span>
            <Button variant="soft" size="sm" onClick={() => setN((v) => Math.round((v + 3.1) * 10) / 10)}>
              +3.1
            </Button>
            <Button variant="quiet" size="sm" onClick={() => setN((v) => Math.max(0, Math.round((v - 5) * 10) / 10))}>
              −5
            </Button>
          </div>
          <div className="row">
            <span className="stamp gal-big" key={ringKey}>
              <Ticker value={42} from={0} onceADay="gallery-ticker" />
            </span>
            <span className="t-cap muted">counts up once a day (from 0)</span>
          </div>
          <div className="row">
            <span className="t-sub">first view today: {String(firstToday)}</span>
          </div>
          <Button variant="quiet" size="sm" onClick={() => (resetSeenToday(), setRingKey((k) => k + 1))}>
            Replay first views
          </Button>
        </div>
      </Section>

      <Section title="Week ring">
        <div className="row wrap" style={{ gap: 16 }} key={ringKey}>
          <WeekRing days={week} today={todayIdx} onceADay="gallery-ring-40" />
          <WeekRing days={week} size={64} today={todayIdx} onceADay="gallery-ring-64">
            3
          </WeekRing>
          <WeekRing days={['done', 'done', 'done', 'rest', 'done', 'floor', 'done']} size={64} onPress={() => toast('Week sheet would open')} onceADay={null}>
            <Check size={20} strokeWidth={3} />
          </WeekRing>
          <WeekRing days={['future', 'future', 'future', 'future', 'future', 'future', 'future']} onceADay={null} />
        </div>
      </Section>

      <Section title="Skeletons" meta="No shimmer, no spinner">
        <div className="sec-group">
          <SkeletonGroup label="Loading the hero">
            <Skeleton h={160} r="card" />
          </SkeletonGroup>
          <SkeletonRows rows={3} label="Loading to-dos" />
          <Demo title="Loading (v1, deprecated)" note="now a grey block">
            <Loading text="Loading to-dos…" />
          </Demo>
          <Demo title="SkeletonPage">
            <div className="gal-frame">
              <SkeletonPage />
            </div>
          </Demo>
        </div>
      </Section>

      <Section title="Empty states">
        <div className="sec-group">
          <Demo title="v1 (old props)">
            <div className="card">
              <EmptyState action={<Button variant="soft">Add</Button>}>Nothing planned. Add a session.</EmptyState>
            </div>
          </Demo>
          <Demo title="v2: ghost + verb + starters">
            <EmptyState
              ghost={
                <div className="row" style={{ gap: 10 }}>
                  {['S', 'R', 'P', 'N'].map((l) => (
                    <span key={l} className="gal-orb">
                      {l}
                    </span>
                  ))}
                </div>
              }
              starters={['Sleep 7 h', 'Stretch', 'Read', 'Protein', 'No phone in bed']}
              onStarter={(s) => new Promise((r) => setTimeout(() => r(toast(`Added ${s}`)), 250))}
              verb={{ label: 'Add a habit', onPress: () => toast('Add a habit') }}
            >
              Habits light up here as you do them.
            </EmptyState>
          </Demo>
        </div>
      </Section>

      <Section title="Tab header">
        <div className="gal-frame">
          <TabHeader
            title="Speed"
            onDatePress={() => toast('Calendar sheet')}
            onDateStep={(d) => toast(d > 0 ? 'Next day' : 'Previous day')}
            dateLabel="Wednesday. Pick a day"
            accessory={<ChipButton quiet>Today</ChipButton>}
          />
        </div>
        <div className="gal-frame">
          <TabHeader title="Progress, with a title long enough to wrap" />
        </div>
      </Section>

      <Section title="Pushed header" meta="This page uses one">
        <div className="gal-frame">
          <PushedHeader title="Morning" eyebrow={dateLine()} onBack={() => toast('Back')} right={<ChipButton quiet>Edit</ChipButton>} />
        </div>
      </Section>

      <Section title="Date pager" meta={dateLine(date)}>
        <DatePager
          date={date}
          onChange={setDate}
          max={shiftDays(t, 14)}
          render={(d) => (
            <div className="aura gal-pager-card">
              <div className="aura-glow" />
              <span className="caps">{d === t ? 'Today' : dateLine(d)}</span>
              <span className="display gal-pager-word">{['Easy', 'Speed', 'Rest', 'Long', 'Easy', 'Tempo', 'Lift'][new Date(`${d}T12:00:00`).getDay()]}</span>
              <span className="t-sub muted">Drag, fling, or focus and use the arrow keys.</span>
            </div>
          )}
        />
        {date !== t ? (
          <Button variant="quiet" size="sm" onClick={() => setDate(t)}>
            Back to today
          </Button>
        ) : null}
      </Section>

      <Section title="Sheets">
        <div className="sec-group">
          <div className="gal-chips">
            <Button variant="soft" onClick={() => sheet.open({ title: 'Easy 6', eyebrow: dateLine(), body: <SheetBody level={1} /> })}>
              Open + push
            </Button>
            <Button variant="soft" onClick={() => sheet.open({ title: 'Routine', detent: 'large', body: <p className="ink2">The large detent: the screen less a 32px peek.</p> })}>
              Large detent
            </Button>
            <Button variant="soft" onClick={() => sheet.open({ title: 'Draft', sticky: true, body: <p className="ink2">Sticky: a scrim tap does not close it. Close or Escape does.</p> })}>
              Sticky
            </Button>
          </div>
          <button
            type="button"
            className="gal-card-btn"
            onClick={() =>
              sheet.open({
                title: 'Tempo 5',
                layoutId: 'session-gallery',
                eyebrow: 'Shared element',
                body: <p className="ink2">The title travelled here from the row (data-shared session-gallery).</p>,
              })
            }
          >
            <div className="gal-session">
              <span className="gal-bar t-hard" />
              <span className="gal-session-main">
                <motion.span {...shared('session-gallery')} className="display gal-shared-title">
                  Tempo 5
                </motion.span>
                <span className="t-sub muted">Tap: the title travels into the sheet</span>
              </span>
            </div>
          </button>
        </div>
      </Section>

      <Section title="Toast">
        <div className="gal-chips">
          <Button variant="soft" onClick={() => toast('Saved')}>
            Short
          </Button>
          <Button variant="soft" onClick={() => toast('Deleted', { label: 'Undo', fn: () => toast('Restored') })}>
            With Undo
          </Button>
          <Button variant="soft" onClick={() => toast('Couldn’t reach Strava. Trying again when you’re online.')}>
            Long
          </Button>
        </div>
      </Section>

      <Section title="Type and rhythm" meta=".section-title">
        <p className="t-sub muted">This title is a primary section (48px above). The next is secondary (24px).</p>
        <Section title="A secondary section" level="secondary" meta="3">
          <Segmented
            label="Zoom"
            value={seg}
            onChange={setSeg}
            options={[
              ['week', 'Week'],
              ['month', 'Month'],
            ]}
          />
        </Section>
        <Section title="Edge-to-edge list" level="secondary">
          <div className="list-edge">
            {['Plan adherence', 'Long run', 'Easy pace'].map((r) => (
              <Pressable key={r} as="div" className="gal-edge-row" pressScale={1} onPress={() => toast(r)}>
                <span>{r}</span>
                <span className="stamp">84%</span>
              </Pressable>
            ))}
          </div>
        </Section>
        <Section title="Carousel" level="secondary">
          <div className="carousel">
            {AURA_STATES.map((s) => (
              <div key={s} className={`aura halo-${s} gal-halo-card`}>
                <div className="aura-glow" />
                <span className="caps">halo-{s}</span>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Halo crossfade" level="secondary" meta={halo}>
          <div className={`aura halo-${halo} gal-halo-big`}>
            <div className="aura-glow" />
            <span className="caps">State</span>
            <span className="display gal-pager-word">{halo}</span>
          </div>
          <div className="gal-chips" style={{ marginTop: 12 }}>
            {AURA_STATES.map((s) => (
              <ChipButton key={s} on={halo === s} onClick={() => setHalo(s)}>
                {s}
              </ChipButton>
            ))}
          </div>
        </Section>
      </Section>

      <Section title="Navigation">
        <div className="list-edge">
          {[
            ['/today', 'Today (tab)'],
            ['/plan', 'Plan (tab)'],
            ['/progress', 'Progress (tab)'],
            ['/trends', '/trends redirects to Progress'],
            ['/journal', 'Journal (tab)'],
            ['/morning', 'Morning (pushed, Today stays lit)'],
            ['/reads', 'Reads (pushed, Journal stays lit)'],
            ['/settings', 'Settings (pushed, avatar ring)'],
            ['/welcome', 'Welcome (first run, full screen)'],
          ].map(([to, label]) => (
            <Link key={to} to={to!} className="gal-edge-row">
              <span>{label}</span>
              <span className="t-cap muted">{to}</span>
            </Link>
          ))}
        </div>
      </Section>

      <HapticLog />
    </div>
  );
}

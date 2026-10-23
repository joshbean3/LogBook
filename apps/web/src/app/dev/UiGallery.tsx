import { shiftDays, today } from '@logbook/shared';
import { ArrowRightLeft, Check, Clock, Copy, GripVertical, Pencil, Share, Trash2 } from 'lucide-react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { HAPTIC_EVENT, haptics, useHapticsEnabled, type HapticEvent } from '@/lib/haptics';
import { springs, type SpringName } from '@/lib/motion';
import type { DragPoint } from '@/ui/useHold';
import { Avatar } from '@/ui/Avatar';
import { ContextMenu, useContextMenu, type ContextMenuItem } from '@/ui/ContextMenu';
import { DatePager } from '@/ui/DatePager';
import { dateLine, PushedHeader, TabHeader } from '@/ui/headers';
import { Pressable } from '@/ui/Pressable';
import { Button, ChipButton, EmptyState, Loading, Section, Segmented } from '@/ui/primitives';
import { useSheet, useSheetDepth } from '@/ui/Sheet';
import { Skeleton, SkeletonGroup, SkeletonPage, SkeletonRows } from '@/ui/Skeleton';
import { SwipeRow } from '@/ui/SwipeRow';
import { Ticker } from '@/ui/Ticker';
import { useToast } from '@/ui/Toast';
import { resetSeenToday, useFirstToday } from '@/ui/useFirstToday';
import { WeekRing, type WeekDayStatus } from '@/ui/WeekRing';
import { GhostBars, GhostRows } from '@/ui/Ghost';
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

/** Test hook: what the demos did, in order (window.__galLog). */
const galLog = (what: string) => {
  const w = window as Window & { __galLog?: string[] };
  (w.__galLog ??= []).push(what);
};

/** A hold → drag demo: three slots; a drag that crosses a slot ticks `select`, the drop is `drop` (the lift is the hold's). */
const SLOT_H = 56;
const DragSlots = () => {
  const [order, setOrder] = useState(['Warm up', 'Strides', 'Cool down']);
  const drag = useRef({ from: -1, at: -1 });
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [active, setActive] = useState(-1);
  const start = (i: number) => () => {
    drag.current = { from: i, at: i };
    setActive(i);
    galLog('drag-start');
  };
  const move = (p: DragPoint) => {
    x.set(p.dx);
    y.set(p.dy);
    const d = drag.current;
    const at = Math.max(0, Math.min(order.length - 1, d.from + Math.round(p.dy / SLOT_H)));
    if (at !== d.at) {
      d.at = at;
      haptics.select();
    }
  };
  const end = (_p: DragPoint, _e: PointerEvent, cancelled: boolean) => {
    const d = drag.current;
    if (!cancelled) {
      haptics.drop();
      if (d.at !== d.from)
        setOrder((o) => {
          const n = [...o];
          const [it] = n.splice(d.from, 1);
          n.splice(d.at, 0, it!);
          return n;
        });
    }
    x.set(0);
    y.set(0);
    setActive(-1);
    galLog(cancelled ? 'drag-cancel' : 'drag-drop');
  };
  return (
    <div className="gal-slots" data-testid="drag-slots">
      {order.map((name, i) => (
        <Pressable
          key={name}
          as="div"
          press="surface"
          className={`gal-slot gal-slot-${i}`}
          onPress={() => galLog(`slot-tap-${name}`)}
          holdMenu={[
            { label: 'Edit', onSelect: () => galLog('slot-edit') },
            { label: 'Remove', destructive: true, onSelect: () => galLog('slot-remove') },
          ]}
          menuLabel={`${name} actions`}
          onDragStart={start(i)}
          onDragMove={move}
          onDragEnd={end}
          style={active === i ? ({ x, y } as never) : undefined}
        >
          <GripVertical size={18} className="muted" aria-hidden="true" />
          <span>{name}</span>
        </Pressable>
      ))}
    </div>
  );
};

/** A sheet body whose first field takes focus when the sheet has risen (never on a timer). */
const FieldSheetBody = () => {
  const toast = useToast();
  return (
    <>
      <input className="field gal-field" placeholder="The first field" aria-label="The first field" />
      <Button variant="soft" className="gal-sheet-toast" onClick={() => toast('Deleted', { label: 'Undo', fn: () => galLog('undo') })}>
        Toast over the sheet
      </Button>
      {Array.from({ length: 40 }, (_, i) => (
        <p key={i} className="fine gal-sheet-line">
          Line {i + 1}: a long body so the sheet scrolls; a drag from here moves the sheet only at scrollTop 0, downward.
        </p>
      ))}
    </>
  );
};

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

  // ≤ 4 items, destructive last (§11.2)
  const items = (name: string): ContextMenuItem[] => [
    { label: 'Edit', icon: <Pencil size={18} />, onSelect: () => (galLog('menu-edit'), sheet.open({ title: `Edit ${name}`, body: <FieldSheetBody /> })) },
    { label: 'Move', icon: <ArrowRightLeft size={18} />, onSelect: () => galLog('menu-move') },
    { label: 'Share', icon: <Share size={18} />, onSelect: () => galLog('menu-share') },
    { label: 'Delete', icon: <Trash2 size={18} />, destructive: true, onSelect: () => (haptics.delete(), toast('Deleted', { label: 'Undo', fn: () => galLog('undo') })) },
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
          <Pressable className="gal-press gal-p-scale" onPress={() => (setPressed('scale'), galLog('scale'))}>
            Scale 0.97
          </Pressable>
          <Pressable className="gal-press gal-p-haptic" haptic="toggle" onPress={() => (setPressed('with haptic'), galLog('haptic'))}>
            With haptic
          </Pressable>
          <Pressable press="dim" className="gal-verb gal-p-dim" onPress={() => (setPressed('dim'), galLog('dim'))}>
            Dim verb
          </Pressable>
          <Pressable className="gal-press" disabled onPress={() => setPressed('never')}>
            Disabled
          </Pressable>
        </div>
        <div className="list-edge" style={{ marginTop: 12 }}>
          <Pressable as="div" press="surface" className="gal-edge-row gal-p-surface" onPress={() => (setPressed('surface'), galLog('surface'))}>
            <span>A row: surface-2 while pressed</span>
            <span className="stamp">84%</span>
          </Pressable>
          <Pressable as="div" press="surface" className="gal-edge-row gal-p-ignore" ignore=".inner" onPress={() => (setPressed('outer'), galLog('ignore-outer'))}>
            <span>Ignores its inner button</span>
            <button type="button" className="chip-btn inner" onClick={() => (setPressed('inner'), galLog('inner'))}>
              Inner
            </button>
          </Pressable>
        </div>
      </Section>

      <Section title="Hold" meta="300 ms pre-grow · 450 ms lift + menu · move to drag">
        <div className="sec-group">
          <Pressable
            as="div"
            className="gal-card-btn gal-p-hold"
            onPress={() => (setPressed('hold card tapped'), galLog('hold-tap'))}
            holdMenu={() => items('Easy 6')}
            menuLabel="Easy 6 actions"
          >
            <SessionRow name="Easy 6" sub="Tap opens · hold for the menu" id="a" />
          </Pressable>
          <DragSlots />
          <ContextMenu items={items('Long 12')} label="Long 12">
            <button type="button" className="gal-card-btn gal-cm-wrap" onClick={() => galLog('cm-wrap-tap')}>
              <SessionRow name="Long 12" sub="ContextMenu wrapper (the same hold)" id="b" />
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
                onCommit: () => (galLog(`done-${td.id}`), setTodos((l) => l.map((x) => (x.id === td.id ? { ...x, done: !x.done } : x)))),
              }}
              left={
                td.id === 4
                  ? {
                      label: 'Delete',
                      icon: <Trash2 size={20} />,
                      tone: 'bad',
                      onCommit: () => (galLog(`delete-${td.id}`), setTodos((l) => l.filter((x) => x.id !== td.id)), toast('Deleted', { label: 'Undo', fn: () => setTodos(START_TODOS) })),
                    }
                  : { label: 'Later', icon: <Clock size={20} />, tone: 'warn', onCommit: () => (galLog(`later-${td.id}`), setTodos((l) => l.map((x) => (x.id === td.id ? { ...x, later: !x.later } : x)))) }
              }
              menuItems={[{ label: 'Copy', icon: <Copy size={18} />, onSelect: () => galLog('copy') }]}
              onReveal={(side) => galLog(`reveal-${side ?? 'none'}`)}
            >
              <div className={`gal-todo gal-todo-${td.id}`}>
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

      <Section title="Week ring" meta="A calendar of the week, never a spinner">
        <div className="row wrap gal-rings" style={{ gap: 16 }} key={ringKey}>
          <WeekRing days={week} today={todayIdx} onceADay="gallery-ring-40" />
          <WeekRing days={week} size={64} today={todayIdx} onceADay="gallery-ring-64" />
          <WeekRing days={['done', 'done', 'skipped', 'rest', 'done', 'floor', 'done']} size={64} onPress={() => toast('Week sheet would open')} onceADay={null}>
            <Check size={20} strokeWidth={3} />
          </WeekRing>
          <WeekRing days={['future', 'rest', 'future', 'rest', 'future', 'rest', 'future']} onceADay={null} />
          <WeekRing days={['missed', 'rest', 'missed', 'rest', 'done', 'rest', 'open']} today={6} onceADay={null} />
        </div>
        <p className="t-cap muted" style={{ marginTop: 8 }}>
          Track always there; an arc only on a day with a session: done blue, floor amber, missed a red outline, skipped grey, to come faint. Rest is the bare track. The middle is the days kept.
        </p>
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
          <Demo title="v2: ghost + verb + starters" note="ghosts are shapes, never content">
            <EmptyState
              ghost={
                <div className="row" style={{ gap: 10 }}>
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className="gal-orb" />
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
          <Demo title="GhostBars" note="Progress: bars only, no axis, no numbers">
            <EmptyState ghost={<GhostBars />} verb={{ label: 'Log a run', onPress: () => toast('Log a run') }}>
              Each run you log lands here.
            </EmptyState>
          </Demo>
          <Demo title="GhostRows" note="Journal, Library: two grey bars a row, no dates, no words">
            <EmptyState ghost={<GhostRows rows={3} lead="dot" />} verb={{ label: 'Write the first one', onPress: () => toast('Write') }}>
              Two sentences a day add up.
            </EmptyState>
          </Demo>
          <Demo title="GhostLines (shorthand ghost=&quot;lines&quot;)" note="a quote, a paragraph">
            <EmptyState ghost="lines" verb={{ label: 'Add a quote', onPress: () => toast('Add a quote') }}>
              Lines you want to keep live here.
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
              <Pressable as="div" className="gal-press gal-p-pager" holdMenu={() => items('Pager card')} menuLabel="Pager card actions" onPress={() => galLog('pager-tap')}>
                Hold, then swipe: the menu goes, the page pages
              </Pressable>
            </div>
          )}
        />
        {date !== t ? (
          <Button variant="quiet" size="sm" onClick={() => setDate(t)}>
            Back to today
          </Button>
        ) : null}
      </Section>

      <Section title="Sheets" meta="sheetY owns it; the tab recedes to 0.92">
        <div className="sec-group">
          <div className="gal-chips">
            <Button variant="soft" className="gal-sheet-auto" onClick={() => sheet.open({ title: 'Easy 6', eyebrow: 'Auto · scrolls', body: <FieldSheetBody /> })}>
              Auto + field
            </Button>
            <Button variant="soft" className="gal-sheet-stack" onClick={() => sheet.open({ title: 'Easy 6', eyebrow: dateLine(), body: <SheetBody level={1} /> })}>
              Open + push
            </Button>
            <Button variant="soft" className="gal-sheet-detents" onClick={() => sheet.open({ title: 'Routine', detent: 'medium', detents: ['medium', 'large'], body: <SheetBody level={2} /> })}>
              Medium ⇄ large
            </Button>
            <Button variant="soft" className="gal-sheet-large" onClick={() => sheet.open({ title: 'Builder', detent: 'large', header: <div className="gal-ghost">The fixed header slot (the builder&rsquo;s ghost)</div>, body: <SheetBody level={2} /> })}>
              Large + header
            </Button>
            <Button variant="soft" className="gal-sheet-sticky" onClick={() => sheet.open({ title: 'Draft', sticky: true, body: <p className="ink2">Sticky: a scrim tap does not close it. Close, Escape, Back or a flick does.</p> })}>
              Sticky
            </Button>
          </div>
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
              <Pressable key={r} as="div" className="gal-edge-row" press="surface" onPress={() => galLog(r)}>
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
            ['/morning', 'Morning (a tab)'],
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

import { buildMorning, clock, clockOfDay, durationWords, fmtDate, mondayOf, monthOf, MORNING_DEFAULTS, morningDayFor, num, pad, parsePace, shiftDays, tone, TYPES, type MorningSettings, type MorningTimeline, type TimelineBlock } from '@logbook/shared';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMorningMutations } from '@/api/queries';
import { Button, DateNav, DayStrip, EmptyState, Field, Group, Loading, Note, PageHeader, Row, SectionHead, Segmented, Stat, StatStrip, Stepper } from '@/ui/primitives';
import { useLog } from '../log/useLog';
import './morning.css';

type L = ReturnType<typeof useLog>;

const fmtMiles = (v: number) => num(v);
const parseMiles = (s: string) => {
  const v = Number(s);
  return Number.isFinite(v) && v > 0 ? Math.round(v * 2) / 2 : null;
};
const fmtInt = (v: number) => String(v);
const parseInt10 = (s: string) => {
  const v = Math.round(Number(s));
  return Number.isFinite(v) ? v : null;
};
/** "7:15", "715" or "7": a morning hour, with or without minutes. */
const parseWake = (raw: string) => {
  const s = raw.trim().toLowerCase().replace(/\s*(am|a)$/, '');
  const x = /^(\d{1,2})(?::?(\d{2}))?$/.exec(s);
  if (!x) return null;
  const h = Number(x[1]);
  const m = Number(x[2] ?? 0);
  return h <= 23 && m <= 59 ? h * 60 + m : null;
};
/** "7:20 AM" split so the number can be big and the meridiem small. */
const timeParts = (m: number) => {
  const [v = '', u = ''] = clockOfDay(m).split(' ');
  return { v, u };
};
/** "7:20" without the meridiem, for tight spots. */
const short = (m: number) => timeParts(m).v;

/** Minutes since midnight, refreshed every half minute. */
const useNowMinutes = () => {
  const read = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  };
  const [m, setM] = useState(read);
  useEffect(() => {
    const iv = setInterval(() => setM(read()), 30_000);
    return () => clearInterval(iv);
  }, []);
  return m;
};

// ---------- 7-day strip: the week around the viewed day, one tone dot per planned session ----------
const WeekStrip = ({ date, today, log, go }: { date: string; today: string; log: L; go: (d: string) => void }) => {
  const mon = mondayOf(date);
  const days = Array.from({ length: 7 }, (_, i) => shiftDays(mon, i));
  return (
    <DayStrip
      days={days}
      selected={date}
      today={today}
      onPick={go}
      labelOf={(d) => fmtDate('short', d)}
      extra={(d) => {
        const s = log.snap.sessionsOn(d).find((x) => x.kind !== 'rest');
        return s ? <i className={`dcell-dot t-${tone(s)}`} /> : <i className="dcell-dot none" />;
      }}
    />
  );
};

// ---------- controls: mode, type, wake and distance, all in one group ----------
const Controls = ({ date, T }: { date: string; T: MorningTimeline }) => {
  const { setDay } = useMorningMutations();
  const day = T.day;
  const types = day.mode === 'run' ? TYPES.run.filter((x) => x !== 'Run') : TYPES.lift;
  const set = (patch: Partial<typeof day>) => setDay.mutate({ date, day: { mode: day.mode, type: day.type, miles: day.miles, minutes: day.minutes, wake: day.wake, ...patch } });
  return (
    <Group>
      <div className="lrow">
        <Segmented className="grow" label="Running or workout" options={[['run', 'Running'], ['gym', 'Workout']]} value={day.mode} onChange={(k) => set({ mode: k, type: k === day.plan.mode ? day.plan.type : k === 'run' ? 'Easy' : 'Strength' })} />
      </div>
      <Row
        title={<span className="m-lbl">Type</span>}
        right={
          <select className="m-select" aria-label={day.mode === 'run' ? 'Type of run' : 'Type of workout'} value={day.type} onChange={(e) => set({ type: e.target.value })}>
            {(types.includes(day.type) ? types : [day.type, ...types]).map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        }
      />
      <div className="m-steppers">
        <div className="field">
          <span className="t-label muted">Wake up</span>
          <Stepper value={day.wake} onChange={(v) => set({ wake: v })} step={5} min={240} max={720} format={short} parse={parseWake} label="Wake-up time" inputProps={{ inputMode: 'numeric', autoComplete: 'off' }} />
        </div>
        {day.mode === 'run' ? (
          <div className="field">
            <span className="t-label muted">Miles</span>
            <Stepper value={day.miles} onChange={(v) => set({ miles: v })} step={0.5} min={0.5} max={30} format={fmtMiles} parse={parseMiles} label="Miles" inputProps={{ inputMode: 'decimal' }} />
          </div>
        ) : (
          <div className="field">
            <span className="t-label muted">Minutes</span>
            <Stepper value={day.minutes} onChange={(v) => set({ minutes: v })} step={5} min={5} max={240} format={fmtInt} parse={parseInt10} label="Workout minutes" inputProps={{ inputMode: 'numeric' }} />
          </div>
        )}
      </div>
      {day.plan.label || day.own ? (
        <div className="lrow m-plan">
          <span className="t-cap muted grow">
            {day.plan.label ? (
              <>
                Training plan: <b>{day.plan.label}</b>
              </>
            ) : (
              'Your own morning'
            )}
          </span>
          {day.own ? (
            <button type="button" className="link sm" onClick={() => setDay.mutate({ date, day: null })}>
              Reset
            </button>
          ) : null}
        </div>
      ) : null}
    </Group>
  );
};

// ---------- timeline: a 48px axis, blocks at 1.6px a minute ----------
const PX = 1.6;
const GAP = 4;
const MIN_H = 32;
const LEAVE_H = 32;
interface Laid {
  b: TimelineBlock;
  top: number;
  h: number;
}
const layoutBlocks = (blocks: TimelineBlock[]) => {
  const items: Laid[] = [];
  let y = 0;
  for (const b of blocks) {
    const h = Math.max(MIN_H, Math.round(b.mins * PX));
    items.push({ b, top: y, h });
    y += h + GAP;
  }
  return { items, end: y };
};

const Timeline = ({ T, isToday }: { T: MorningTimeline; isToday: boolean }) => {
  const now = useNowMinutes();
  const { items, end } = useMemo(() => layoutBlocks(T.blocks), [T.blocks]);
  const total = end + LEAVE_H;
  const yOf = (t: number) => {
    const first = items[0];
    if (!first || t <= first.b.start) return 0;
    for (const it of items) if (t >= it.b.start && t <= it.b.end) return it.top + (it.b.mins ? ((t - it.b.start) / it.b.mins) * it.h : 0);
    return end;
  };
  const ticks: Array<{ t: number; y: number }> = [];
  for (let t = Math.ceil(T.day.wake / 30) * 30; t <= T.leave; t += 30) {
    const y = yOf(t);
    const prev = ticks[ticks.length - 1];
    if (prev && y - prev.y < 20) continue;
    if (total - y < 24) continue;
    ticks.push({ t, y });
  }
  const showNow = isToday && now >= T.day.wake && now <= T.leave;
  const nowY = showNow ? yOf(now) : 0;
  const tickLabel = (t: number) => `${Math.floor(t / 60) % 12 || 12}:${pad(t % 60)}`;
  return (
    <div className="tl" style={{ height: total }}>
      <div className="tl-axis" aria-hidden="true">
        {ticks.map(({ t, y }) => (
          <span key={t} className="tl-tick t-cap" style={{ top: y - 8 }}>
            {tickLabel(t)}
          </span>
        ))}
      </div>
      <ol className="tl-blocks">
        {items.map(({ b, top, h }, i) => {
          const past = isToday && b.end <= now;
          const range = `${short(b.start)}–${short(b.end)}`;
          if (b.key === 'free')
            return (
              <li key={i} className="tl-free" style={{ top, height: h }}>
                <span className="t-sub muted">Free · {durationWords(b.mins)}</span>
                <span className="t-cap muted">{range}</span>
              </li>
            );
          return (
            <li key={i} className={`tl-block k-${b.key} ${b.tone ? `t-${b.tone}` : ''} ${past ? 'past' : ''} ${h >= 48 ? 'tall' : ''}`} style={{ top, height: h }}>
              <div className="tl-main">
                <span className="tl-label">{b.label}</span>
                {h >= 60 ? <span className="t-cap muted">{[durationWords(b.mins), b.sub].filter(Boolean).join(' · ')}</span> : null}
              </div>
              <span className="tl-range t-cap">{range}</span>
            </li>
          );
        })}
        <li className="tl-leave" style={{ top: end, height: LEAVE_H }}>
          <span className="tl-label">Leave for work</span>
          <span className="tl-range t-cap">{short(T.leave)}</span>
        </li>
      </ol>
      {showNow ? (
        <div className="tl-now" style={{ top: nowY - 1 }} aria-label={`Now, ${clockOfDay(now)}`}>
          <i />
        </div>
      ) : null}
    </div>
  );
};

// ---------- word and quote ----------
const Focus = ({ st }: { st: MorningSettings }) => {
  const { settings } = useMorningMutations();
  const [edit, setEdit] = useState(false);
  const [word, setWord] = useState(st.focus.word);
  const [quote, setQuote] = useState(st.focus.quote);
  const [by, setBy] = useState(st.focus.by);
  const has = st.focus.word || st.focus.quote;
  const open = () => {
    setWord(st.focus.word);
    setQuote(st.focus.quote);
    setBy(st.focus.by);
    setEdit(true);
  };
  return (
    <>
      <SectionHead
        title="Word & quote"
        meta={has && !edit ? 'Stays until you change it' : undefined}
        action={
          has && !edit ? (
            <button type="button" className="link" onClick={open}>
              Change
            </button>
          ) : undefined
        }
      />
      <Group>
        {edit ? (
          <div className="group-pad m-editor">
            <Field label="Word of the day">
              <input className="in" value={word} onChange={(e) => setWord(e.target.value)} maxLength={40} placeholder="One word, e.g. Steady" autoFocus />
            </Field>
            <Field label="Quote of the day">
              <textarea className="in" rows={3} value={quote} onChange={(e) => setQuote(e.target.value)} maxLength={400} placeholder="A line to carry through the day" />
            </Field>
            <Field label="By">
              <input className="in" value={by} onChange={(e) => setBy(e.target.value)} maxLength={80} placeholder="Who said it (optional)" />
            </Field>
            <div className="row">
              <Button
                variant="primary"
                onClick={() => {
                  settings.mutate({ focus: { word: word.trim(), quote: quote.trim(), by: by.trim() } });
                  setEdit(false);
                }}
              >
                Save
              </Button>
              <Button variant="ghost" onClick={() => setEdit(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : !has ? (
          <EmptyState
            action={
              <Button size="sm" variant="soft" onClick={open}>
                Add
              </Button>
            }
          >
            Pick a word and a line to start the day with. They stay here every morning until you change them.
          </EmptyState>
        ) : (
          <div className="group-pad m-focus">
            {st.focus.word ? <div className="t-title m-word">{st.focus.word}</div> : null}
            {st.focus.quote ? <blockquote className="serif t-body m-quote">“{st.focus.quote}”</blockquote> : null}
            {st.focus.quote && st.focus.by ? <div className="t-cap muted">{st.focus.by}</div> : null}
          </div>
        )}
      </Group>
    </>
  );
};

// ---------- settings tab: grouped lists, label left, input right ----------
const Unit = ({ children, unit }: { children: ReactNode; unit: string }) => (
  <span className="m-unit">
    {children}
    <span className="t-cap muted">{unit}</span>
  </span>
);

const SettingsPane = ({ st }: { st: MorningSettings }) => {
  const { settings } = useMorningMutations();
  const minutes = (grp: 'run' | 'gym' | 'after', key: string, label: string, sub?: string, max = 180) => {
    const value = (st[grp] as unknown as Record<string, number>)[key] ?? 0;
    return (
      <Row
        key={key}
        title={<span className="m-lbl">{label}</span>}
        sub={sub}
        right={
          <Unit unit="min">
            <input
              key={value}
              className="in m-num"
              type="number"
              inputMode="numeric"
              aria-label={label}
              min={0}
              max={max}
              step={1}
              defaultValue={value}
              onBlur={(e) => {
                const v = Math.round(Number(e.target.value));
                if (e.target.value !== '' && v >= 0 && v <= max && v !== value) settings.mutate({ [grp]: { [key]: v } });
                else e.target.value = String(value);
              }}
            />
          </Unit>
        }
      />
    );
  };
  return (
    <div className="m-set">
      <SectionHead title="Running" />
      <Group>
        <Row
          title={<span className="m-lbl">Pace</span>}
          sub="Sets how long the run takes"
          right={
            <Unit unit="/mi">
              <input
                key={st.run.pace}
                className="in m-num"
                inputMode="numeric"
                aria-label="Pace per mile"
                defaultValue={clock(st.run.pace)}
                placeholder="9:00"
                onBlur={(e) => {
                  const v = parsePace(e.target.value);
                  if (v && v !== st.run.pace) settings.mutate({ run: { pace: v } });
                  else e.target.value = clock(st.run.pace);
                }}
              />
            </Unit>
          }
        />
        {minutes('run', 'wakeup', 'Wake-up routine', 'From alarm to dressed')}
        {minutes('run', 'buffer', 'Buffer', 'Out the door, then cool down')}
      </Group>

      <SectionHead title="Workout" />
      <Group>
        {minutes('gym', 'length', 'Usual length', 'Change it day by day on the Plan tab', 240)}
        {minutes('gym', 'wakeup', 'Wake-up routine', 'From alarm to dressed')}
        {minutes('gym', 'walk', 'Walk to the gym', 'Counted both ways')}
      </Group>

      <SectionHead title="After" />
      <Group>
        <div className="lrow">
          <Segmented className="grow" label="When the shower starts" options={[['fixed', 'Set time'], ['after', 'After']]} value={st.after.showerMode} onChange={(k) => settings.mutate({ after: { showerMode: k } })} />
        </div>
        {st.after.showerMode === 'fixed' ? (
          <Row
            title={<span className="m-lbl">Shower starts</span>}
            sub="Get back late and the plan shows what to change."
            right={
              <Unit unit="AM">
                <input
                  key={st.after.showerAt}
                  className="in m-num"
                  inputMode="numeric"
                  autoComplete="off"
                  aria-label="Shower start time"
                  defaultValue={short(st.after.showerAt)}
                  placeholder="8:40"
                  onBlur={(e) => {
                    const v = parseWake(e.target.value);
                    if (v != null && v >= 240 && v <= 720 && v !== st.after.showerAt) settings.mutate({ after: { showerAt: v } });
                    else e.target.value = short(st.after.showerAt);
                  }}
                />
              </Unit>
            }
          />
        ) : (
          <div className="lrow">
            <span className="t-sub muted">Leaving time moves with the run or workout.</span>
          </div>
        )}
        {minutes('after', 'shower', 'Shower')}
        {minutes('after', 'ready', 'Get ready')}
        {minutes('after', 'smoothie', 'Blend smoothie', '0 to skip')}
        {minutes('after', 'prep', 'Final prep')}
      </Group>

      <Button className="m-set-reset" variant="ghost" block onClick={() => settings.mutate({ run: MORNING_DEFAULTS.run, gym: MORNING_DEFAULTS.gym, after: MORNING_DEFAULTS.after })}>
        Reset
      </Button>
    </div>
  );
};

// ---------- the view ----------
export default function MorningView() {
  const params = useParams();
  const nav = useNavigate();
  const [tab, setTab] = useState<'plan' | 'settings'>('plan');
  const base = useLog([]);
  const t = base.today;
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : t;
  const months = useMemo(() => [monthOf(mondayOf(date)), monthOf(shiftDays(mondayOf(date), 6))], [date]);
  const log = useLog(months);
  const go = (d: string) => nav(d === t ? '/morning' : `/morning/${d}`);
  const st = log.boot?.morningSettings ?? MORNING_DEFAULTS;
  const T = useMemo(() => buildMorning(morningDayFor(log.snap.sessionsOn(date), log.snap.morningOverride(date), st), st), [log.snap, date, st]);
  const out = T.day.mode === 'run' ? T.blocks.find((b) => b.key === 'buffer') : T.blocks.find((b) => b.key === 'gym');
  const alarm = timeParts(T.day.wake);
  const door = out ? timeParts(out.start) : null;
  const leave = timeParts(T.leave);
  return (
    <div className="page">
      <PageHeader
        title="Morning"
        sub={
          date === t ? (
            `Today · ${fmtDate('md', date)}`
          ) : (
            <span className="ph-sub-row">
              {`${date === shiftDays(t, 1) ? 'Tomorrow · ' : ''}${fmtDate('md', date)}`}
              <button type="button" className="link sm" onClick={() => go(t)}>
                Today
              </button>
            </span>
          )
        }
        actions={tab === 'plan' ? <DateNav onPrev={() => go(shiftDays(date, -7))} onNext={() => go(shiftDays(date, 7))} prevLabel="Previous week" nextLabel="Next week" /> : undefined}
      >
        <Segmented className="m-tabs" label="Morning tabs" options={[['plan', 'Plan'], ['settings', 'Settings']]} value={tab} onChange={setTab} />
      </PageHeader>
      {!log.boot ? (
        <Loading text="Loading your morning…" />
      ) : tab === 'settings' ? (
        <SettingsPane st={st} />
      ) : (
        <>
          <div className="section" style={{ marginTop: 16 }}>
            <WeekStrip date={date} today={t} log={log} go={go} />
            <StatStrip>
              <Stat label="Wake" value={alarm.v} unit={alarm.u} />
              <Stat label={T.day.mode === 'run' ? 'Door' : 'Gym'} value={door ? door.v : '—'} unit={door?.u} />
              <Stat label="Leave" value={leave.v} unit={leave.u} tone={T.late ? 'bad' : ''} />
            </StatStrip>
          </div>

          <SectionHead title="Plan" />
          <Controls date={date} T={T} />

          <SectionHead title="Timeline" meta={durationWords(T.leave - T.day.wake)} />
          {T.late ? (
            <Note kind="warn">
              Back at {clockOfDay(T.back)}, {T.late} min past your {clockOfDay(T.settings.after.showerAt)} shower, so you leave at {clockOfDay(T.leave)} instead of {clockOfDay(T.onTime ?? T.leave)}. To stay on time: wake by {clockOfDay(T.fix!.latestWake)}
              {T.fix?.maxMiles != null ? `, or ${T.fix.maxMiles > 0 ? `run ${num(T.fix.maxMiles)} mi` : 'skip the run'}` : ''}.
            </Note>
          ) : null}
          <Timeline T={T} isToday={date === t} />

          <Focus st={st} />
        </>
      )}
    </div>
  );
}

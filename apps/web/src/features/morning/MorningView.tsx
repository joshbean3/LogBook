import { buildMorning, clock, clockOfDay, durationWords, fmtDate, minutesFromTimeInput, minutesToTimeInput, monthOf, MORNING_DEFAULTS, morningDayFor, num, parsePace, shiftDays, TYPES, type MorningSettings, type MorningTimeline } from '@logbook/shared';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMorningMutations } from '@/api/queries';
import { itemVariants, listVariants } from '@/lib/motion';
import { Button, Card, CardHead, DateNav, Empty, Field, Kpi, Loading, Note, PageHeader, Segmented, Stepper } from '@/ui/primitives';
import { useLog } from '../log/useLog';
import './morning.css';

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
const parseWake = (s: string) => minutesFromTimeInput(s);

const Controls = ({ date, T, log }: { date: string; T: MorningTimeline; log: ReturnType<typeof useLog> }) => {
  const { setDay } = useMorningMutations();
  const day = T.day;
  const types = day.mode === 'run' ? TYPES.run.filter((x) => x !== 'Run') : TYPES.lift;
  const set = (patch: Partial<typeof day>) => setDay.mutate({ date, day: { mode: day.mode, type: day.type, miles: day.miles, minutes: day.minutes, wake: day.wake, ...patch } });
  return (
    <Card>
      <div className="row wrap">
        <Segmented className="m-mode" label="Running or workout" options={[['run', 'Running'], ['gym', 'Workout']]} value={day.mode} onChange={(k) => set({ mode: k, type: k === day.plan.mode ? day.plan.type : k === 'run' ? 'Easy' : 'Strength' })} />
        <select className="in m-type" aria-label={day.mode === 'run' ? 'Type of run' : 'Type of workout'} value={day.type} onChange={(e) => set({ type: e.target.value })}>
          {(types.includes(day.type) ? types : [day.type, ...types]).map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      </div>
      <div className="m-bigs">
        <div className="field">
          <span className="field-label">Wake up</span>
          <Stepper value={day.wake} onChange={(v) => set({ wake: v })} step={5} min={240} max={720} format={minutesToTimeInput} parse={parseWake} label="Wake-up time" inputProps={{ type: 'time', step: 300 }} />
        </div>
        {day.mode === 'run' ? (
          <div className="field">
            <span className="field-label">Miles</span>
            <Stepper value={day.miles} onChange={(v) => set({ miles: v })} step={0.5} min={0.5} max={30} format={fmtMiles} parse={parseMiles} label="Miles" inputProps={{ inputMode: 'decimal' }} />
          </div>
        ) : (
          <div className="field">
            <span className="field-label">Workout minutes</span>
            <Stepper value={day.minutes} onChange={(v) => set({ minutes: v })} step={5} min={5} max={240} format={fmtInt} parse={parseInt10} label="Workout minutes" inputProps={{ inputMode: 'numeric' }} />
          </div>
        )}
      </div>
      {day.plan.label || day.own ? (
        <div className="m-plan">
          {day.plan.label ? (
            <span>
              Training plan: <b>{day.plan.label}</b>
            </span>
          ) : null}
          {day.own ? (
            <button type="button" className="link sm" onClick={() => setDay.mutate({ date, day: null })}>
              Reset to plan
            </button>
          ) : null}
        </div>
      ) : null}
      {log.habits.length === 0 && !log.snap.sessionsOn(date).length ? null : null}
    </Card>
  );
};

const Timeline = ({ T }: { T: MorningTimeline }) => {
  const PX = 2.3;
  return (
    <Card>
      <CardHead title="Your morning" meta={`${durationWords(T.leave - T.day.wake)} from alarm to door`} />
      {T.late ? (
        <Note kind="warn">
          Back at {clockOfDay(T.back)}, {T.late} min past your {clockOfDay(T.settings.after.showerAt)} shower, so you leave at {clockOfDay(T.leave)} instead of {clockOfDay(T.onTime ?? T.leave)}. To stay on time: wake by {clockOfDay(T.fix!.latestWake)}
          {T.fix?.maxMiles != null ? `, or ${T.fix.maxMiles > 0 ? `run ${num(T.fix.maxMiles)} mi` : 'skip the run'}` : ''}.
        </Note>
      ) : null}
      <motion.ol className="tl" variants={listVariants} initial="hidden" animate="show">
        {T.blocks.map((b, i) => (
          <motion.li key={i} variants={itemVariants} className={`tl-row k-${b.key} ${b.tone ? `tn-${b.tone}` : ''}`} style={{ minHeight: Math.max(36, Math.round(b.mins * PX)) }}>
            <span className="tl-time">{clockOfDay(b.start)}</span>
            <div className="tl-block">
              <span className="tl-label">{b.label}</span>
              <span className="tl-dur">{[durationWords(b.mins), b.sub].filter(Boolean).join(' · ')}</span>
            </div>
          </motion.li>
        ))}
        <motion.li variants={itemVariants} className="tl-row k-leave">
          <span className="tl-time">{clockOfDay(T.leave)}</span>
          <div className="tl-block">
            <span className="tl-label">Leave for work</span>
          </div>
        </motion.li>
      </motion.ol>
    </Card>
  );
};

const Focus = ({ st }: { st: MorningSettings }) => {
  const { settings } = useMorningMutations();
  const [edit, setEdit] = useState(false);
  const [word, setWord] = useState(st.focus.word);
  const [quote, setQuote] = useState(st.focus.quote);
  const [by, setBy] = useState(st.focus.by);
  const has = st.focus.word || st.focus.quote;
  if (edit)
    return (
      <Card className="m-focus">
        <CardHead title="Word and quote" meta="Stays until you change it" />
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
      </Card>
    );
  return (
    <Card className="m-focus">
      <CardHead title="Word and quote">
        <button type="button" className="link" onClick={() => setEdit(true)}>
          {has ? 'Change' : 'Add'}
        </button>
      </CardHead>
      {!has ? <Empty>Pick a word and a line to start the day with. They stay here every morning until you change them.</Empty> : null}
      {st.focus.word ? <div className="m-word">{st.focus.word}</div> : null}
      {st.focus.quote ? <blockquote className="m-quote">“{st.focus.quote}”</blockquote> : null}
      {st.focus.quote && st.focus.by ? <div className="m-by">{st.focus.by}</div> : null}
    </Card>
  );
};

const SettingsPane = ({ st }: { st: MorningSettings }) => {
  const { settings } = useMorningMutations();
  const minutes = (grp: 'run' | 'gym' | 'after', key: string, label: string, hint?: string, max = 180) => {
    const value = (st[grp] as unknown as Record<string, number>)[key] ?? 0;
    return (
      <Field key={key} label={label} hint={hint}>
        <div className="unit-in">
          <input
            className="in"
            type="number"
            inputMode="numeric"
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
          <span>min</span>
        </div>
      </Field>
    );
  };
  return (
    <div className="stack" style={{ gap: 16, maxWidth: 780 }}>
      <Card>
        <CardHead title="Running" />
        <div className="grid2">
          <Field label="Pace" hint="Sets how long the run takes">
            <div className="unit-in">
              <input
                className="in"
                inputMode="numeric"
                defaultValue={clock(st.run.pace)}
                placeholder="9:00"
                onBlur={(e) => {
                  const v = parsePace(e.target.value);
                  if (v && v !== st.run.pace) settings.mutate({ run: { pace: v } });
                  else e.target.value = clock(st.run.pace);
                }}
              />
              <span>/mi</span>
            </div>
          </Field>
          {minutes('run', 'wakeup', 'Wake-up routine', 'From alarm to dressed')}
          {minutes('run', 'buffer', 'Buffer before and after', 'Out the door, then cool down')}
        </div>
      </Card>
      <Card>
        <CardHead title="Workout" />
        <div className="grid2">
          {minutes('gym', 'length', 'Usual workout length', 'Where each day starts; change it day by day on the Plan tab', 240)}
          {minutes('gym', 'wakeup', 'Wake-up routine', 'From alarm to dressed')}
          {minutes('gym', 'walk', 'Walk to the gym', 'Counted both ways')}
        </div>
      </Card>
      <Card>
        <CardHead title="After" />
        <div className="field">
          <span className="field-label">Shower starts</span>
          <Segmented className="m-shower-mode" label="When the shower starts" options={[['fixed', 'At a set time'], ['after', 'As soon as I’m back']]} value={st.after.showerMode} onChange={(k) => settings.mutate({ after: { showerMode: k } })} />
          {st.after.showerMode === 'fixed' ? (
            <input
              className="in"
              type="time"
              step={300}
              style={{ maxWidth: 170 }}
              defaultValue={minutesToTimeInput(st.after.showerAt)}
              onBlur={(e) => {
                const v = minutesFromTimeInput(e.target.value);
                if (v != null && v !== st.after.showerAt) settings.mutate({ after: { showerAt: v } });
              }}
            />
          ) : null}
          <span className="field-hint">{st.after.showerMode === 'fixed' ? 'Gives you a fixed time to leave. If you get back late, you’ll see what to change.' : 'Leaving time moves with the run or workout.'}</span>
        </div>
        <div className="grid2">
          {minutes('after', 'shower', 'Shower')}
          {minutes('after', 'ready', 'Get ready')}
          {minutes('after', 'smoothie', 'Blend smoothie', '0 to skip')}
          {minutes('after', 'prep', 'Final prep')}
        </div>
      </Card>
      <p className="fine">
        Starting numbers come from the Morning Plans tab of the 2026 Workout Plan sheet.{' '}
        <button type="button" className="link sm" onClick={() => settings.mutate({ run: MORNING_DEFAULTS.run, gym: MORNING_DEFAULTS.gym, after: MORNING_DEFAULTS.after })}>
          Reset all to those
        </button>
      </p>
    </div>
  );
};

export default function MorningView() {
  const params = useParams();
  const nav = useNavigate();
  const [tab, setTab] = useState<'plan' | 'settings'>('plan');
  const base = useLog([]);
  const t = base.today;
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : t;
  const log = useLog(useMemo(() => [monthOf(date)], [date]));
  const go = (d: string) => nav(d === t ? '/morning' : `/morning/${d}`);
  const st = log.boot?.morningSettings ?? MORNING_DEFAULTS;
  const T = useMemo(() => buildMorning(morningDayFor(log.snap.sessionsOn(date), log.snap.morningOverride(date), st), st), [log.snap, date, st]);
  const out = T.blocks.find((b) => b.key === 'run' || b.key === 'gym');
  return (
    <div className="page">
      <PageHeader
        eyebrow="Alarm to door"
        title="Morning"
        sub={`${date === t ? 'Today · ' : date === shiftDays(t, 1) ? 'Tomorrow · ' : ''}${fmtDate('long', date)}`}
        actions={
          <>
            <DateNav onPrev={() => go(shiftDays(date, -1))} onNext={() => go(shiftDays(date, 1))} prevLabel="Previous day" nextLabel="Next day" />
            <Button size="sm" variant="ghost" onClick={() => go(date !== t ? t : shiftDays(t, 1))}>
              {date !== t ? 'Today' : 'Tomorrow'}
            </Button>
          </>
        }
      >
        <Segmented className="m-tabs" label="Morning tabs" options={[['plan', 'Plan'], ['settings', 'Settings']]} value={tab} onChange={setTab} />
      </PageHeader>
      {!log.boot ? (
        <Loading text="Loading your morning…" />
      ) : tab === 'settings' ? (
        <SettingsPane st={st} />
      ) : (
        <div className="m-grid">
          <div className="stack" style={{ gap: 16 }}>
            <Focus st={st} />
            <Controls date={date} T={T} log={log} />
          </div>
          <div className="stack" style={{ gap: 16 }}>
            <div className="kpis">
              <Kpi label="Alarm" value={clockOfDay(T.day.wake)} />
              <Kpi label={T.day.mode === 'run' ? 'Run starts' : 'Workout starts'} value={out ? clockOfDay(out.start) : '—'} />
              <Kpi label="Back" value={clockOfDay(T.back)} />
              <Kpi label="Leave for work" value={clockOfDay(T.leave)} tone={T.late ? 'missed' : ''} />
            </div>
            <Timeline T={T} />
          </div>
        </div>
      )}
    </div>
  );
}

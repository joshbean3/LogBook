import { fmtDate, GOAL_SPECS, label, mondayOf, num, shiftDays, tone, type Goal, type Template, type TemplateInput, type Weekday } from '@logbook/shared';
import { ChevronRight, FileText, SlidersHorizontal } from 'lucide-react';
import { useMemo } from 'react';
import { Button, Group, Row, Section } from '@/ui/primitives';
import { useSheet, type SheetApi } from '@/ui/Sheet';
import type { Log } from '../log/useLog';
import { PlanDetail, planName, planWeeks, stateOf } from './Blocks';
import { build, builderSpec, startOf, templateCaps, useApplyTemplate, useReplaceCount } from './Builder';
import { builderVerb } from './builderModel';
import { PlanBuilder } from './PlanBuilder';
import './plan.css';

/**
 * The plan library (docs/system.md §2, Plan): a large sheet of named presets built from `buildTemplate`, each a row
 * ("Half marathon · 4 days · 12 weeks · from 22 mi"); "Build my own" opens the builder, "From a file or description" the
 * Claude builder. Picking a preset previews its first two weeks and offers one verb, `Use this plan`, with the replace
 * count and the same Undo as the builder.
 */
export interface Preset {
  id: string;
  goal: Goal;
  days: number;
}
export const PRESETS: Preset[] = [
  { id: 'base-3', goal: 'base', days: 3 },
  { id: 'base-4', goal: 'base', days: 4 },
  { id: 'base-5', goal: 'base', days: 5 },
  { id: '5k-4', goal: '5k', days: 4 },
  { id: '10k-4', goal: '10k', days: 4 },
  { id: '10k-5', goal: '10k', days: 5 },
  { id: 'half-4', goal: 'half', days: 4 },
  { id: 'half-5', goal: 'half', days: 5 },
  { id: 'marathon-4', goal: 'marathon', days: 4 },
  { id: 'marathon-5', goal: 'marathon', days: 5 },
];
const DAYS: Record<number, Weekday[]> = { 3: ['tue', 'thu', 'sat'], 4: ['tue', 'thu', 'sat', 'sun'], 5: ['mon', 'tue', 'thu', 'sat', 'sun'] };
const LONG: Record<number, Weekday> = { 3: 'sat', 4: 'sun', 5: 'sun' };

/** A preset's template input: its goal and days, the account's weekly miles, next Monday, a race on the last Sunday. */
export const presetInput = (log: Log, p: Preset): TemplateInput => {
  const s = startOf(log);
  const weeks = GOAL_SPECS[p.goal].defaultWeeks;
  const startDate = shiftDays(mondayOf(log.today), 7);
  return { goal: p.goal, weeks, startDate, runDays: DAYS[p.days]!, longRunDay: LONG[p.days]!, weeklyMiles: s.weeklyMiles, raceDate: p.goal === 'base' ? null : shiftDays(startDate, weeks * 7 - 1) };
};

const LibraryBody = ({ log }: { log: Log }) => {
  const sheet = useSheet();
  const presets = useMemo(() => PRESETS.map((p) => ({ p, input: presetInput(log, p), tpl: build(presetInput(log, p)).tpl })), [log]);
  const blocks = [...(log.boot?.blocks ?? [])].sort((a, b) => (a.start < b.start ? 1 : -1));
  const t = log.today;
  return (
    <div className="pl-lib">
      <Group>
        {presets.map(({ p, input, tpl }) => (
          <Row
            key={p.id}
            title={GOAL_SPECS[p.goal].name}
            sub={`${p.days} days · ${input.weeks} weeks · from ${input.weeklyMiles} mi`}
            right={<ChevronRight size={18} className="lrow-chev" aria-hidden="true" />}
            onClick={() => tpl && sheet.push({ title: tpl.name, eyebrow: templateCaps(tpl), detent: 'large', body: <PresetPreview tpl={tpl} input={input} log={log} /> })}
            label={`${GOAL_SPECS[p.goal].name}, ${p.days} days a week, ${input.weeks} weeks, from ${input.weeklyMiles} miles. Preview`}
          />
        ))}
      </Group>
      <Section title="Or" level="secondary">
        <Group>
          <Row left={<SlidersHorizontal size={18} className="pl-lib-ic" aria-hidden="true" />} title="Build my own" sub="Pick the goal, days, weeks and miles" right={<ChevronRight size={18} className="lrow-chev" aria-hidden="true" />} onClick={() => sheet.push(builderSpec(log))} />
          {log.features.claude ? (
            <Row left={<FileText size={18} className="pl-lib-ic" aria-hidden="true" />} title="From a file or description" sub="A PDF, a photo, pasted text or a sentence" right={<ChevronRight size={18} className="lrow-chev" aria-hidden="true" />} onClick={() => sheet.push({ title: 'From a file', eyebrow: 'Plan', detent: 'large', body: <PlanBuilder log={log} /> })} />
          ) : null}
        </Group>
      </Section>
      {blocks.length ? (
        <Section title="Your plans" level="secondary">
          <Group>
            {blocks.map((b) => {
              const st = stateOf(b, t);
              const name = planName(b, blocks, t);
              const n = planWeeks(b);
              return (
                <Row
                  key={b.id}
                  title={name}
                  sub={`${fmtDate('md', b.start)} – ${fmtDate('md', b.end)} · ${n} ${n === 1 ? 'week' : 'weeks'}`}
                  right={<span className={`pl-plan-st ${st === 'Active' ? 'on' : ''}`}>{st}</span>}
                  onClick={() => sheet.push({ eyebrow: `${st} · ${fmtDate('md', b.start)} – ${fmtDate('md', b.end)}`, title: name, body: <PlanDetail b={b} log={log} /> })}
                  label={`${name}. ${st}. ${fmtDate('md', b.start)} to ${fmtDate('md', b.end)}, ${n} ${n === 1 ? 'week' : 'weeks'}`}
                />
              );
            })}
          </Group>
        </Section>
      ) : null}
    </div>
  );
};

/** The first two weeks of a preset as quiet rows, then the one verb. */
const PresetPreview = ({ tpl, input, log }: { tpl: Template; input: TemplateInput; log: Log }) => {
  const { apply, pending } = useApplyTemplate();
  const { existing, from, counting } = useReplaceCount(log, tpl);
  const weeks = tpl.weeks.filter((w) => w.week >= 1).slice(0, 2);
  return (
    <div className="pl-lib">
      {weeks.map((w) => {
        const mon = mondayOf(w.start);
        const mine = tpl.sessions.filter((s) => s.week === w.week);
        return (
          <Section key={w.week} title={`Week ${w.week}`} meta={`${num(Math.round(w.miles * 10) / 10)} mi · ${mine.length} runs`} level={w.week === 1 ? 'none' : 'secondary'}>
            <Group className="pl-ghost">
              {mine.map((s) => (
                <Row key={s.date} left={<span className={`pl-tone t-${tone(s)}`} aria-hidden="true" />} title={label(s)} sub={fmtDate('dowLong', s.date)} right={<span className="lrow-stat tnum">{num(s.miles)} mi</span>} />
              ))}
            </Group>
            {w.week === 1 && mon !== w.start ? <p className="fine">Week 1 starts {fmtDate('md', mon)}.</p> : null}
          </Section>
        );
      })}
      <p className="fine">{tpl.summary}</p>
      <div className="sheet-foot tp-foot">
        <p className="tp-note">{existing ? 'Anything you’ve done stays, and Undo puts it all back.' : `Starts ${fmtDate('short', tpl.start)}. Nothing is saved until you use it.`}</p>
        <Button variant="primary" block className="tp-verb" disabled={counting || pending} onClick={() => apply(input, existing > 0)}>
          {pending ? 'Writing it' : counting ? 'Checking your calendar…' : builderVerb(existing, from)}
        </Button>
      </div>
    </div>
  );
};

/** Open the library over the page (large), or push it inside the sheet that is up. */
export const openLibrary = (sheet: SheetApi, log: Log, push = false) => {
  const spec = { title: 'Plan library', eyebrow: 'Plans', detent: 'large' as const, body: <LibraryBody log={log} /> };
  if (push) sheet.push(spec);
  else sheet.open(spec);
};

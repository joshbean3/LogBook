import { fmtDate, monthOf, tone, type Session } from '@logbook/shared';
import { CalendarDays, Check, ChevronRight, ListChecks, Moon, Plus } from 'lucide-react';
import type * as React from 'react';
import { useMemo } from 'react';
import { useToday } from '@/lib/useToday';
import type { ContextMenuItem } from '@/ui/ContextMenu';
import { SectionHeader } from '@/ui/layout';
import { Pressable } from '@/ui/Pressable';
import { useSheet } from '@/ui/Sheet';
import { Skeleton } from '@/ui/Skeleton';
import { useLog, type Log } from '../log/useLog';
import { useSessionActions } from '../sessions/actions';
import { useOpenSession, useOpenUnplanned } from '../sessions/SessionCard';
import { sessionIcon } from '../sessions/sessionIcon';
import { openPlanDetail, openPlans, openTemplate, type PlanBlockProps } from './Blocks';
import { fromEndingBlock } from './builderModel';
import { MorningCard } from './MorningCard';
import { LoadFail, useMonthsFailed } from './LoadFail';
import { dayOrder } from './moveRule';
import { planCardWords } from './topWords';
import { rowFace } from './Week';
import './plantop.css';

/**
 * The plan across the top of Plan, one full-width card: a caps eyebrow, the plan's name in the serif, one line on where it
 * stands (`Week 3 of 12 · Build`, `Starts Tuesday · 12 weeks`), a slim bar of how far through the block today is, and the
 * chevron. A tap opens the plan's sheet (its summary: what it is, where it came from, its numbers, with New plan and All
 * plans in its foot); a hold offers the same three. An ended plan's card says so and opens the builder for the next one.
 * With no plan it opens the builder.
 */
export const PlanCard = ({ block }: { block: PlanBlockProps }): React.JSX.Element => {
  const sheet = useSheet();
  const d = block.data;
  if (!d.boot) return <div className="pt-plan-wrap is-wait" aria-hidden="true" />;
  const plan = planCardWords(d);
  const menu = (): ContextMenuItem[] => [
    ...(d.b ? [{ label: 'Open the plan', icon: <CalendarDays size={18} />, onSelect: () => openPlanDetail(sheet, d.b!, block.getLog()) }] : []),
    { label: 'New plan', icon: <Plus size={18} />, onSelect: () => openTemplate(sheet, block.getLog()) },
    { label: 'All plans', icon: <ListChecks size={18} />, onSelect: () => openPlans(sheet) },
  ];
  if (!plan || !d.b)
    return (
      <div className="pt-plan-wrap">
        <Pressable className="pt-plan is-empty" press="surface" onPress={() => openTemplate(sheet, block.getLog())} holdMenu={menu} menuLabel="Plan actions" label="Your plan. No plan. Build one in a minute">
          <span className="pt-plan-ic" aria-hidden="true">
            <Plus size={20} />
          </span>
          <span className="pt-plan-main">
            <span className="caps pt-eyebrow">Your plan</span>
            <span className="pt-plan-name">No plan</span>
            <span className="pt-plan-state is-act">Build one in a minute</span>
          </span>
          <ChevronRight size={20} className="pt-chev" aria-hidden="true" />
        </Pressable>
      </div>
    );
  const pct = Math.round(plan.progress * 100);
  // an ended plan's card is the door to the next one: the builder, starting the day after, with the same answers
  const next = () => {
    const log = block.getLog();
    const prof = log.boot?.user.trainingProfile ?? null;
    openTemplate(sheet, log, false, prof ? fromEndingBlock(d.b!, prof) : undefined);
  };
  return (
    <div className="pt-plan-wrap">
      <Pressable
        className={`pt-plan ${plan.ended ? 'is-ended' : ''}`.trim()}
        press="surface"
        onPress={plan.ended ? next : () => openPlanDetail(sheet, d.b!, block.getLog())}
        holdMenu={menu}
        menuLabel="Plan actions"
        label={plan.ended ? `Your plan. ${plan.title}. ${plan.state}` : `Your plan. ${plan.title}. ${plan.state}. ${pct}% through. Open the plan summary; hold for more`}
      >
        <span className="pt-plan-main">
          <span className="caps pt-eyebrow">Your plan</span>
          <span className="pt-plan-name">{plan.title}</span>
          <span className={`pt-plan-state ${plan.ended ? 'is-act' : ''}`.trim()}>{plan.state}</span>
          {plan.ended ? null : (
            <span className="pt-bar" aria-hidden="true">
              <i style={{ transform: `scaleX(${plan.progress})` }} />
            </span>
          )}
        </span>
        <ChevronRight size={20} className="pt-chev" aria-hidden="true" />
      </Pressable>
    </div>
  );
};


const KIND_WORD: Record<Session['kind'], string> = { run: 'Run', lift: 'Strength', cross: 'Cross', rest: 'Rest' };

/** The status of today's session as a pill: done a check, today the accent pill, missed or skipped a grey word. */
const StatusPill = ({ k, word }: { k: string; word: string }) =>
  k === 'done' || k === 'bonus' ? (
    <span className="pt-st is-done">
      <Check size={13} strokeWidth={3} aria-hidden="true" />
      {word}
    </span>
  ) : (
    <span className={`pt-st k-${k}`}>{word}</span>
  );

/** One of today's sessions as a large card: its kind, its name, what it asks, its status. Tap opens the session sheet. */
const TodaySession = ({ log, s }: { log: Log; s: Session }) => {
  const open = useOpenSession(log);
  const f = rowFace(log, log.today, s);
  const Icon = sessionIcon(s);
  return (
    <Pressable className={`pt-run t-${tone(s)} k-${f.k}`} press="surface" onPress={() => open(log.today, s)} label={`${KIND_WORD[s.kind]}. ${f.word}. ${f.name}${f.sub ? `. ${f.sub}` : ''}. Open today’s session`}>
      <span className="pt-run-ic" aria-hidden="true">
        <Icon size={22} strokeWidth={2.1} />
      </span>
      <span className="pt-run-main">
        <span className="pt-run-top">
          <span className="caps pt-run-kind">{KIND_WORD[s.kind]}</span>
          <StatusPill k={f.k} word={f.word} />
        </span>
        <span className="pt-run-name">{f.name}</span>
        {f.sub ? <span className="pt-run-sub">{f.sub}</span> : null}
      </span>
    </Pressable>
  );
};

/** Today's sessions, or the run that happened with nothing planned, or a rest day, or an open day to add to. */
const TodaySessions = () => {
  const today = useToday();
  const months = useMemo(() => [monthOf(today)], [today]);
  const log = useLog(months);
  const act = useSessionActions(log);
  const openUnplanned = useOpenUnplanned();
  const fail = useMonthsFailed(months);
  if (!log.loaded(today) && fail.failed) return <LoadFail what="Couldn’t load today." onRetry={fail.retry} />;
  if (!log.loaded(today))
    return (
      <div className="pt-run is-wait" aria-busy="true" aria-label="Loading today's session">
        <Skeleton w={48} h={48} r={14} />
        <Skeleton w="50%" h={22} r="line" />
      </div>
    );
  const all = log.snap.sessionsOn(today);
  const sessions = dayOrder(all.filter((s) => s.kind !== 'rest'));
  const runs = log.snap.runsOn(today);
  const bonus = !sessions.some((s) => s.kind === 'run') && runs.length > 0;
  const rest = all.some((s) => s.kind === 'rest');
  return (
    <>
      {sessions.map((s) => (
        <TodaySession key={s.id} log={log} s={s} />
      ))}
      {bonus ? (
        <Pressable className="pt-run t-easy k-bonus" press="surface" onPress={() => openUnplanned(today, runs, log)} label={`Run. Done. ${runs.length === 1 ? runs[0]!.name : `${runs.length} runs`}. Off the plan. Open today’s run`}>
          <span className="pt-run-ic" aria-hidden="true">
            {(() => {
              const I = sessionIcon(null);
              return <I size={22} strokeWidth={2.1} />;
            })()}
          </span>
          <span className="pt-run-main">
            <span className="pt-run-top">
              <span className="caps pt-run-kind">Run</span>
              <StatusPill k="done" word="Done" />
            </span>
            <span className="pt-run-name">{runs.length === 1 ? runs[0]!.name : `${runs.length} runs`}</span>
            <span className="pt-run-sub">Off the plan</span>
          </span>
        </Pressable>
      ) : null}
      {!sessions.length && !bonus ? (
        <Pressable className={`pt-run ${rest ? 't-rest is-rest' : 'is-open'}`} press="surface" onPress={() => act.add(today)} label={rest ? 'Rest day. Tap to add a session' : 'Nothing planned. Tap to add a run or a lift'}>
          <span className={`pt-run-ic ${rest ? '' : 'is-add'}`.trim()} aria-hidden="true">
            {rest ? <Moon size={22} strokeWidth={2.1} /> : <Plus size={22} strokeWidth={2.2} />}
          </span>
          <span className="pt-run-main">
            <span className="pt-run-name">{rest ? 'Rest day' : 'Nothing planned'}</span>
            <span className="pt-run-sub">{rest ? 'Tap to add a session' : 'Tap to add a run or a lift'}</span>
          </span>
        </Pressable>
      ) : null}
    </>
  );
};

/** Today on Plan: the morning plan (wake, run, back, leave) and today's session, above the week's days. */
export const TodaySection = (): React.JSX.Element => {
  const today = useToday();
  return (
    <section className="pt-today" aria-label="Today">
      <div className="pt-gut">
        <SectionHeader title="Today" meta={`${fmtDate('dow', today)}, ${fmtDate('md', today)}`} />
      </div>
      <MorningCard />
      <div className="pt-gut pt-runs">
        <TodaySessions />
      </div>
    </section>
  );
};

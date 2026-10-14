import { fmtDate, today } from '@logbook/shared';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { useBootstrap, useMorningMutations, useRebuildPlan, useSetName, useUndoRebuild } from '@/api/queries';
import type { TemplateApplied } from '@/api/types';
import { DayLetters, Dial, GoalChips, MilesDial, RaceStrip } from '@/features/onboarding/controls';
import { defaultRaceDay, fixLongRun, MILES_MAX, MILES_MIN, nextMondayAfter, paceText, safeTemplate, sameProfile, type TrainingProfile } from '@/features/onboarding/model';
import { haptics } from '@/lib/haptics';
import { fadeIn, springs } from '@/lib/motion';
import { PushedHeader } from '@/ui/headers';
import { Section } from '@/ui/primitives';
import { Skeleton, SkeletonGroup } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';
import { Avatar } from '@/ui/Avatar';
import { initialOf, SRow } from './parts';
import { useTrainingProfile } from './useProfile';

/** A page's own copy of the answers: edits stay here until "Rebuild my plan from next week". */
const useDraftProfile = () => {
  const tp = useTrainingProfile();
  const [draft, setDraft] = useState<TrainingProfile | null>(null);
  const p = draft ?? tp.profile;
  return { ...tp, p, dirty: !!draft && !sameProfile(draft, tp.profile), edit: (next: Partial<TrainingProfile>) => setDraft({ ...p, ...next }), reset: () => setDraft(null) };
};

/**
 * The offer that follows any change to the plan's answers: a card pinned above the tab bar with what the new block will be,
 * Rebuild (POST /plans/template with replace, from next Monday; done runs and the past stay), and Undo changes.
 */
const RebuildBar = ({ show, profile, before, onDone, onReset, save }: { show: boolean; profile: TrainingProfile; before: TrainingProfile; onDone: (p: TrainingProfile) => void; onReset: () => void; save: (p: TrainingProfile) => void }) => {
  const reduce = useReducedMotion();
  const toast = useToast();
  const rebuild = useRebuildPlan();
  const undo = useUndoRebuild();
  /** Undo (contract 1): the new block goes, the replaced sessions and the old block come back, and so do the answers. */
  const takeBack = (r: TemplateApplied) =>
    undo.mutate(r, {
      onSuccess: () => {
        haptics.delete();
        save(before);
        toast('Plan restored.');
      },
      onError: () => {
        haptics.error();
        toast('Couldn’t undo. The new plan stays.');
      },
    });
  const [err, setErr] = useState<string | null>(null);
  const start = nextMondayAfter(today());
  const tpl = useMemo(() => (show ? safeTemplate(profile, start) : null), [show, profile, start]);
  const go = () => {
    setErr(null);
    const p = { ...profile, longRunDay: fixLongRun(profile.runDays, profile.longRunDay), raceDate: profile.goal === 'base' ? null : profile.raceDate };
    rebuild.mutate(
      { goal: p.goal, raceDate: p.raceDate, runDays: p.runDays, longRunDay: p.longRunDay, weeklyMiles: p.weeklyMiles, startDate: start },
      {
        onSuccess: (r) => {
          haptics.success();
          onDone(p);
          toast(r.block.sessionCount ? `${r.block.name}: ${r.block.sessionCount} runs from ${fmtDate('short', start)}.` : `${r.block.name}, from ${fmtDate('short', start)}.`, { label: 'Undo', fn: () => takeBack(r) });
        },
        onError: (e) => {
          haptics.error();
          setErr(e instanceof ApiError && e.status === 422 ? 'That race day doesn’t fit a plan starting next week. Pick a later one.' : 'Couldn’t rebuild the plan. Check your connection and try again.');
        },
      },
    );
  };
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key="rebuild"
          className="s-rebuild halo halo-upcoming"
          role="region"
          aria-label="Rebuild my plan"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 40 }}
          transition={reduce ? fadeIn : springs.sheet}
        >
          <p className="s-rebuild-title">Rebuild my plan from next week</p>
          <p className="s-rebuild-sub">{err ?? (tpl ? `${tpl.name}. ${tpl.summary} Runs you’ve done stay.` : 'Starts Monday. Runs you’ve done stay.')}</p>
          <div className="s-rebuild-actions">
            <button type="button" className="btn quiet" onClick={onReset} disabled={rebuild.isPending}>
              Undo changes
            </button>
            <button type="button" className="btn primary s-rebuild-go" onClick={go} disabled={rebuild.isPending}>
              {rebuild.isPending ? 'Rebuilding…' : 'Rebuild'}
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

const Shape = () => (
  <SkeletonGroup label="Loading your training">
    <Skeleton h={56} r="pill" />
    <div style={{ height: 24 }} />
    <Skeleton h={56} r="pill" />
    <div style={{ height: 48 }} />
    <Skeleton h={96} r="card" />
  </SkeletonGroup>
);

/**
 * The name (contract 6), typed in place: it saves on Return or when the field lets go (PATCH /me), and the avatar's
 * initial follows it everywhere. Cleared, the email's initial comes back.
 */
const NameRow = () => {
  const boot = useBootstrap();
  const setName = useSetName();
  const toast = useToast();
  const saved = boot.data?.user.name ?? '';
  const [v, setV] = useState(saved);
  useEffect(() => setV(saved), [saved]);
  const commit = () => {
    const next = v.trim().slice(0, 60);
    if (next === saved) return;
    setName.mutate(next, {
      onSuccess: () => haptics.toggle(),
      onError: () => {
        haptics.error();
        toast('Couldn’t save your name. Try again.');
      },
    });
  };
  return (
    <label className="s-row">
      <span className="s-row-main">
        <span className="s-row-title">Name</span>
      </span>
      <input
        className="s-name-in"
        name="name"
        autoComplete="name"
        autoCapitalize="words"
        enterKeyHint="done"
        maxLength={60}
        placeholder="Add your name"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
        }}
      />
    </label>
  );
};

/** /settings/you: the account (name, email), what you are training for, units. */
export const YouPage = () => {
  const boot = useBootstrap();
  const d = useDraftProfile();
  const start = nextMondayAfter(today());
  return (
    <div className="page s-set s-sub">
      <PushedHeader title="You" backLabel="Back to Settings" right={<Avatar initial={initialOf(boot.data?.user)} />} />
      <div className="list-edge s-list">
        <NameRow />
        <SRow title="Email" value={<span className="s-email">{boot.data?.user.email}</span>} />
        <SRow title="Units" sub="Kilometres are on the way." value="Miles" />
      </div>
      <Section title="Training for" level="primary">
        {!d.loaded ? (
          <Shape />
        ) : (
          <>
            <GoalChips id="s-goal" value={d.p.goal} onChange={(g) => d.edit({ goal: g, raceDate: g === 'base' ? null : d.p.raceDate && d.p.goal !== 'base' ? d.p.raceDate : defaultRaceDay(g, start) })} />
            {d.p.goal !== 'base' ? (
              <div className="s-race">
                <p className="s-label">
                  Race day <span className="s-label-value">{d.p.raceDate ? fmtDate('short', d.p.raceDate) : 'Not set'}</span>
                </p>
                <RaceStrip start={start} value={d.p.raceDate} onChange={(r) => d.edit({ raceDate: r })} />
              </div>
            ) : null}
          </>
        )}
      </Section>
      <RebuildBar show={d.dirty} profile={d.p} before={d.profile} save={(p) => d.save(p)} onDone={(p) => (d.save(p), d.reset())} onReset={d.reset} />
    </div>
  );
};

/** /settings/training: weekly miles, run days and the long run, easy pace. */
export const TrainingPage = () => {
  const boot = useBootstrap();
  const d = useDraftProfile();
  const morning = useMorningMutations();
  const toast = useToast();
  const savedPace = boot.data?.morningSettings.run.pace ?? 540;
  const [pace, setPace] = useState(savedPace);
  useEffect(() => setPace(savedPace), [savedPace]);
  // pace is the Morning page's number, not the plan's: it saves on its own, a beat after the last step
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const changePace = (v: number) => {
    setPace(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => morning.settings.mutate({ run: { pace: v } }, { onError: () => toast('Couldn’t save the pace. Try again.') }), 600);
  };
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  return (
    <div className="page s-set s-sub">
      <PushedHeader title="Training" backLabel="Back to Settings" />
      {!d.loaded ? (
        <div className="sec-secondary">
          <Shape />
        </div>
      ) : (
        <>
          <Section title="Weekly miles" level="secondary">
            <MilesDial value={d.p.weeklyMiles} min={MILES_MIN} max={MILES_MAX} onChange={(v) => d.edit({ weeklyMiles: v })} />
            <p className="s-note">
              {d.source === 'block'
                ? 'This week of your current block. Change it and Logbook rebuilds from next week, building about 10% a week.'
                : d.source === 'none'
                  ? 'Where a new plan starts. It builds about 10% a week, with a lighter week every fourth.'
                  : 'Where your plan started. Change it and Logbook rebuilds from next week, building about 10% a week.'}
            </p>
          </Section>
          <Section title="Run days" level="primary">
            <DayLetters runDays={d.p.runDays} longRunDay={fixLongRun(d.p.runDays, d.p.longRunDay)} onChange={(runDays, longRunDay) => d.edit({ runDays, longRunDay })} />
          </Section>
        </>
      )}
      <Section title="Easy pace" level="primary">
        <Dial value={pace} onChange={changePace} min={240} max={1200} step={5} format={paceText} unit="per mile" valueText={(v) => `${Math.floor(v / 60)} minutes ${v % 60} seconds per mile`} label="Easy pace" scrubPx={8} />
        <p className="s-note">Morning times each run at this pace. It saves as you change it.</p>
      </Section>
      <RebuildBar show={d.dirty} profile={d.p} before={d.profile} save={(p) => d.save(p)} onDone={(p) => (d.save(p), d.reset())} onReset={d.reset} />
    </div>
  );
};

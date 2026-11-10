import { fmtDate, today } from '@logbook/shared';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { useBootstrap, useMorningMutations, useRebuildPlan, useSetName, useUndoRebuild } from '@/api/queries';
import type { TemplateApplied } from '@/api/types';
import { DayLetters, Dial, GoalChips, MilesDial, RaceStrip } from '@/features/onboarding/controls';
import { defaultRaceDay, fixLongRun, MILES_MAX, MILES_MIN, nextMondayAfter, paceText, safeTemplate, sameProfile, type TrainingProfile } from '@/features/onboarding/model';
import { haptics } from '@/lib/haptics';
import { fadeIn, springs } from '@/lib/motion';
import { Skeleton, SkeletonGroup } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';
import { PushedBar, Row } from '@/ui';
import { SectionHeader } from '@/ui/layout';
import { TriangleAlert } from 'lucide-react';
import { SCard, SGroup } from './parts';
import { jumpWords, LAST_RUN_DAY, milesJump } from './trainingModel';
import { useTrainingProfile } from './useProfile';

/**
 * The pages' copy of the answers: edits stay here until "Rebuild my plan from next week" or "Undo changes". It outlives
 * the page (review 2 feel N7): a back tap with a change pending keeps it, so coming back to You or Training shows the
 * change and its Rebuild card again instead of throwing it away without a word. Both pages share it (one plan, one offer).
 */
let keptDraft: { uid: string; base: TrainingProfile; p: TrainingProfile } | null = null;
const useDraftProfile = () => {
  const tp = useTrainingProfile();
  const uid = useBootstrap().data?.user.id ?? '';
  // one account's pending change never shows for another signed in on this device
  const [draft, setDraftRaw] = useState<{ base: TrainingProfile; p: TrainingProfile } | null>(() => (keptDraft && keptDraft.uid === uid ? keptDraft : null));
  const setDraft = (d: { base: TrainingProfile; p: TrainingProfile } | null) => {
    keptDraft = d ? { uid, ...d } : null;
    setDraftRaw(d);
  };
  // a draft holds only over the answers it was made from (review 3 code N5): once the plan changed under it (rebuilt in
  // Plan, or on another device), it is dropped, never shown as a change that would undo the new plan
  const live = !!draft && tp.loaded && sameProfile(draft.base, tp.profile);
  useEffect(() => {
    if (draft && tp.loaded && !live) {
      if (keptDraft && keptDraft.p === draft.p) keptDraft = null;
      setDraftRaw(null);
    }
  }, [draft, tp.loaded, live]);
  const p = live && draft ? draft.p : tp.profile;
  return { ...tp, p, dirty: live && !!draft && !sameProfile(draft.p, tp.profile), edit: (next: Partial<TrainingProfile>) => setDraft({ base: tp.profile, p: { ...p, ...next } }), reset: () => setDraft(null) };
};

/**
 * The offer that follows any change to the plan's answers: a card held above the ask bar and the tab bar (sticky, the
 * page's last block) with what the new plan will be, Rebuild (POST /plans/template with replace, from next Monday; done
 * runs and the past stay), and Undo changes. `nowMiles` is what the person runs a week now (null with no plan): a change
 * that raises it by more than 30% is warned about on the card before Rebuild.
 */
const RebuildBar = ({ show, profile, before, nowMiles, onDone, onReset, save }: { show: boolean; profile: TrainingProfile; before: TrainingProfile; nowMiles: number | null; onDone: (p: TrainingProfile) => void; onReset: () => void; save: (p: TrainingProfile) => void }) => {
  const reduce = useReducedMotion();
  const toast = useToast();
  const rebuild = useRebuildPlan();
  const undo = useUndoRebuild();
  /** Undo (contract 1): the new block goes, the replaced sessions and the old block come back, and so do the answers. */
  const takeBack = (r: TemplateApplied) =>
    undo.mutate(r, {
      onSuccess: () => {
        // the bar's answer is the plan itself: the old block is back on Plan, the answers with it
        save(before);
      },
      onError: () => {
        haptics.error();
        toast('Couldn’t undo. The new plan stays.');
      },
    });
  const [err, setErr] = useState<string | null>(null);
  const start = nextMondayAfter(today());
  // leaving, the card keeps the words it had (the answers under it are already the undone ones)
  const shownP = useRef(profile);
  if (show) shownP.current = profile;
  const shownProfile = shownP.current;

  const go = () => {
    setErr(null);
    const p = { ...profile, longRunDay: fixLongRun(profile.runDays, profile.longRunDay), raceDate: profile.goal === 'base' ? null : profile.raceDate };
    rebuild.mutate(
      { goal: p.goal, raceDate: p.raceDate, runDays: p.runDays, longRunDay: p.longRunDay, weeklyMiles: p.weeklyMiles, startDate: start },
      {
        onSuccess: (r) => {
          onDone(p);
          toast(r.block.sessionCount ? `${r.block.name}: ${r.block.sessionCount} runs from ${fmtDate('short', start)}.` : `${r.block.name}, from ${fmtDate('short', start)}.`, { label: 'Undo', fn: () => takeBack(r) });
        },
        onError: (e) => {
          haptics.error();
          // a refused template comes with its own sentence ("80 miles a week needs at least 7 run days."): shown as it is
          setErr(e instanceof ApiError && e.code === 'bad_template' && e.message ? e.message : e instanceof ApiError && e.status === 422 ? 'That race day doesn’t fit a plan starting next week. Pick a later one.' : 'Couldn’t rebuild the plan. Check your connection and try again.');
        },
      },
    );
  };
  // The card's footprint outlives it (review 3 code N1 / feel R3-1). Leaving, it fades in place; once the fade is done it
  // goes from the flow in the same commit as a blank spacer of the room the page still needs where it is scrolled, so the
  // scroller never clamps and nothing on screen moves. The spacer then gives that room back only as the finger scrolls up
  // (it never reaches into the screen), and goes for good with the page or when the card comes back.
  const [mounted, setMounted] = useState(show);
  const [room, setRoom] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<HTMLDivElement>(null);
  const jump = milesJump(nowMiles, shownProfile.weeklyMiles);
  // The card rests over the page's lower part. When it arrives over the control that was just changed (the race strip,
  // the run days), the page scrolls that control up to sit above it, so the next tap is not made under the card.
  const touched = useRef<Element | null>(null);
  useEffect(() => {
    const fn = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t && !t.closest?.('.s-rebuild')) touched.current = t;
    };
    document.addEventListener('pointerdown', fn, true);
    return () => document.removeEventListener('pointerdown', fn, true);
  }, []);
  useEffect(() => {
    if (!show) return;
    const id = requestAnimationFrame(() => {
      const card = cardRef.current;
      const sc = card?.closest<HTMLElement>('.pushed, .tab-scroll');
      const el = touched.current;
      if (!card || !sc || !el || !sc.contains(el) || card.contains(el)) return;
      // the whole section the control sits in (the goals with the race strip under them), when that fits
      const block = el.closest('.s-sec') ?? el;
      // where the card comes to rest: its sticky line above the chrome (the entrance still has it lower on this frame)
      const restTop = sc.getBoundingClientRect().bottom - (parseFloat(getComputedStyle(card).bottom) || 0) - card.offsetHeight;
      const over = Math.ceil(block.getBoundingClientRect().bottom + 12 - restTop);
      // never so far that the control just used leaves the top of the screen
      const room = Math.floor(el.getBoundingClientRect().top - sc.getBoundingClientRect().top - 72);
      const by = Math.min(over, room);
      if (by > 0) sc.scrollBy({ top: by, behavior: reduce ? 'auto' : 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [show, reduce]);
  if (show && !mounted) {
    setMounted(true);
    setRoom(0);
  }
  const tpl = useMemo(() => (show || mounted ? safeTemplate(shownProfile, start) : null), [show || mounted, shownProfile, start]); // eslint-disable-line react-hooks/exhaustive-deps
  const leftAt = useRef(0);
  const left = () => {
    const card = cardRef.current;
    const sc = card?.closest<HTMLElement>('.pushed, .tab-scroll');
    if (!card || !sc) return setMounted(false);
    const footprint = card.offsetHeight + parseFloat(getComputedStyle(card).marginTop || '0');
    // the room the page needs without the card, at this scrollTop: what would otherwise be clamped away in one frame
    const need = Math.max(0, Math.ceil(sc.scrollTop + sc.clientHeight - (sc.scrollHeight - footprint)));
    leftAt.current = sc.scrollTop;
    setRoom(Math.min(footprint, need));
    setMounted(false);
  };
  // the commit that takes the card out: the spacer is trued up to the exact room (margins around the card collapse
  // differently around a plain block) and the scroll position kept, before the frame paints
  useLayoutEffect(() => {
    const el = roomRef.current;
    const sc = el?.closest<HTMLElement>('.pushed, .tab-scroll');
    if (!el || !sc || room <= 0) return;
    const h = el.offsetHeight;
    const exact = Math.max(0, Math.ceil(leftAt.current + sc.clientHeight - (sc.scrollHeight - h)));
    if (exact !== h) el.style.height = `${exact}px`;
    if (sc.scrollTop !== leftAt.current) sc.scrollTop = leftAt.current;
  }, [room]);
  useEffect(() => {
    const el = roomRef.current;
    const sc = el?.closest<HTMLElement>('.pushed, .tab-scroll');
    if (!el || !sc || room <= 0) return;
    let h = el.offsetHeight;
    // shrink only by what is below the screen's bottom edge: scrollMax stays ≥ scrollTop, so the scroller never clamps
    const onScroll = () => {
      const next = Math.max(0, Math.min(h, Math.ceil(sc.scrollTop + sc.clientHeight - (sc.scrollHeight - h))));
      if (next === h) return;
      h = next;
      el.style.height = `${h}px`;
      if (h === 0) sc.removeEventListener('scroll', onScroll);
    };
    sc.addEventListener('scroll', onScroll, { passive: true });
    return () => sc.removeEventListener('scroll', onScroll);
  }, [room]);
  return (
    <>
      {mounted ? (
        <motion.div
          ref={cardRef}
          className="s-rebuild halo halo-upcoming"
          role="region"
          aria-label="Rebuild my plan"
          aria-hidden={show ? undefined : true}
          inert={!show}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40 }}
          animate={show ? { opacity: 1, y: 0 } : reduce ? { opacity: 0 } : { opacity: 0, y: 40 }}
          transition={reduce ? fadeIn : springs.sheet}
          onAnimationComplete={() => {
            if (!show) left();
          }}
        >
          <p className="s-rebuild-title">Rebuild my plan from next week</p>
          <p className="s-rebuild-sub">{err ?? (tpl ? `${tpl.name}. ${tpl.summary} Runs you’ve done stay.` : 'Starts Monday. Runs you’ve done stay.')}</p>
          {jump && !err ? (
            <p className="s-rebuild-warn" role="status">
              <TriangleAlert size={16} strokeWidth={2.2} aria-hidden="true" />
              <span>{jumpWords(jump)}</span>
            </p>
          ) : null}
          <div className="s-rebuild-actions">
            <button type="button" className="btn quiet" onClick={onReset} disabled={rebuild.isPending}>
              Undo changes
            </button>
            <button type="button" className="btn primary s-rebuild-go" onClick={go} disabled={rebuild.isPending}>
              {rebuild.isPending ? 'Rebuilding…' : jump ? 'Rebuild anyway' : 'Rebuild'}
            </button>
          </div>
        </motion.div>
      ) : room > 0 ? (
        <div ref={roomRef} key="room" className="s-rebuild-room" aria-hidden="true" style={{ height: room }} />
      ) : null}
    </>
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
      onError: () => {
        haptics.error();
        toast('Couldn’t save your name. Try again.');
      },
    });
  };
  return (
    <label className="lrow s-name-row">
      <span className="lrow-main">
        <span className="lrow-title">Name</span>
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

/** /settings/you: the account (name, email) and what you are training for. */
export const YouPage = () => {
  const boot = useBootstrap();
  const d = useDraftProfile();
  const start = nextMondayAfter(today());
  // The race strip reports the day under its scroll position. When the day changes from outside it (a new goal brings its
  // default day, Undo changes puts the old one back), the strip glides there and reports every day it passes, which made
  // a change of its own: a race day nobody picked, or the Rebuild card coming back after Undo. So a day that did not come
  // from the strip remounts it at that day, with no glide and nothing reported.
  const stripDay = useRef(d.p.raceDate);
  const [stripKey, setStripKey] = useState(0);
  if (d.p.raceDate !== stripDay.current) {
    stripDay.current = d.p.raceDate;
    setStripKey((k) => k + 1);
  }
  return (
    <div className="page s-set s-sub">
      <PushedBar title="You" />
      <SGroup title="Account">
        <NameRow />
        <Row title="Email" right={<span className="s-value s-email">{boot.data?.user.email}</span>} />
      </SGroup>
      <section className="lb-sec s-sec" aria-labelledby="s-goal-h">
        <SectionHeader size="sm" id="s-goal-h" title="Training for" />
        {!d.loaded ? (
          <Shape />
        ) : (
          <>
            <GoalChips id="s-goal" value={d.p.goal} onChange={(g) => d.edit({ goal: g, raceDate: g === 'base' ? null : d.p.raceDate && d.p.goal !== 'base' ? d.p.raceDate : defaultRaceDay(g, start) })} />
            {d.p.goal !== 'base' ? (
              <div className="card s-card s-race">
                <p className="s-label">
                  Race day <span className="s-label-value">{d.p.raceDate ? fmtDate('short', d.p.raceDate) : 'Not set'}</span>
                </p>
                <RaceStrip
                  key={stripKey}
                  start={start}
                  value={d.p.raceDate}
                  onChange={(r) => {
                    stripDay.current = r;
                    d.edit({ raceDate: r });
                  }}
                />
              </div>
            ) : null}
          </>
        )}
      </section>
      <RebuildBar show={d.dirty} profile={d.p} before={d.profile} nowMiles={d.source === 'none' ? null : d.profile.weeklyMiles} save={(p) => d.save(p)} onDone={(p) => (d.save(p), d.reset())} onReset={d.reset} />
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
  // the day letters refuse to drop the last run day (a shake); here the reason is put in words under them
  const [lastDay, setLastDay] = useState(false);
  const runDayCount = d.p.runDays.length;
  useEffect(() => {
    if (runDayCount > 1) setLastDay(false);
  }, [runDayCount]);
  return (
    <div className="page s-set s-sub">
      <PushedBar title="Training" />
      {!d.loaded ? (
        <div className="s-sec">
          <Shape />
        </div>
      ) : (
        <>
          <SCard
            title="Weekly miles"
            foot={
              d.source === 'block'
                ? 'This week of your current block. Change it and Logbook rebuilds from next week, building about 10% a week.'
                : d.source === 'none'
                  ? 'Where a new plan starts. It builds about 10% a week, with a lighter week every fourth.'
                  : 'Where your plan started. Change it and Logbook rebuilds from next week, building about 10% a week.'
            }
          >
            <MilesDial value={d.p.weeklyMiles} min={MILES_MIN} max={MILES_MAX} onChange={(v) => d.edit({ weeklyMiles: v })} />
          </SCard>
          <SCard title="Run days">
            <div
              className="s-days"
              onClickCapture={(e) => {
                if (runDayCount === 1 && (e.target as Element).closest?.('[aria-pressed="true"]')) setLastDay(true);
              }}
            >
              <DayLetters runDays={d.p.runDays} longRunDay={fixLongRun(d.p.runDays, d.p.longRunDay)} onChange={(runDays, longRunDay) => d.edit({ runDays, longRunDay })} />
            </div>
            {lastDay ? (
              <p className="s-days-note" role="status">
                {LAST_RUN_DAY}
              </p>
            ) : null}
          </SCard>
        </>
      )}
      <SCard title="Easy pace" foot="Morning times each run at this pace. It saves as you change it.">
        <Dial value={pace} onChange={changePace} min={240} max={1200} step={5} format={paceText} unit="per mile" valueText={(v) => `${Math.floor(v / 60)} minutes ${v % 60} seconds per mile`} label="Easy pace" scrubPx={8} />
      </SCard>
      <RebuildBar show={d.dirty} profile={d.p} before={d.profile} nowMiles={d.source === 'none' ? null : d.profile.weeklyMiles} save={(p) => d.save(p)} onDone={(p) => (d.save(p), d.reset())} onReset={d.reset} />
    </div>
  );
};

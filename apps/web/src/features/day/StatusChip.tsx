import { TRAINING_STATUS_INFO, TRAINING_STATUS_KINDS, fmtDate, mondayOf, shiftDays, STATUS_LENGTHS, statusOn, untilFor, type TrainingStatus, type TrainingStatusKind, type ISODate, type PlanBlock } from '@logbook/shared';
import { Check } from 'lucide-react';
import type * as React from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import { useNav } from '@/app/NavController';
import { useBootstrap, useSetStatus } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { Button, StatusPill } from '@/ui/primitives';
import { Pressable } from '@/ui/Pressable';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';

/** "until Tue", "until Nov 20", or nothing for an open end. */
const untilWords = (until: ISODate | null, today: ISODate) => {
  if (!until) return '';
  if (until === today) return 'today';
  if (until === shiftDays(today, 1)) return 'until tomorrow';
  return until <= shiftDays(today, 6) ? `until ${fmtDate('dow', until)}` : `until ${fmtDate('md', until)}`;
};

/** Which quick length matches a stored end (null when none does). */
const lengthOf = (s: TrainingStatus | null, today: ISODate) => {
  if (!s) return '3d';
  if (s.until === null) return 'open';
  const days = Math.round((Date.parse(`${s.until}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
  return STATUS_LENGTHS.find((l) => l.days === days)?.id ?? null;
};

/**
 * The status sheet: how you are training, then for how long, then Save (grey until something changes). Choosing Training
 * clears any status. Plan and the assistant read what is saved here.
 */
const StatusSheet = ({ current, today }: { current: TrainingStatus | null; today: ISODate }) => {
  const sheet = useSheet();
  const toast = useToast();
  const save = useSetStatus();
  const curKind = statusOn(current, today);
  const [kind, setKind] = useState<TrainingStatusKind>(curKind);
  const [len, setLen] = useState<string | null>(lengthOf(current, today));
  const days = STATUS_LENGTHS.find((l) => l.id === len)?.days;
  const until = kind === 'training' || days === undefined ? null : untilFor(today, days);
  const changed = kind !== curKind || (kind !== 'training' && (len === null || until !== (current?.until ?? null)));
  const ready = changed && (kind === 'training' || len !== null);
  const onSave = () => {
    haptics.success();
    save.mutate({ kind, until, today }, { onError: () => toast('Couldn’t save that. Try again.') });
    sheet.close();
  };
  return (
    <div className="st-sheet">
      <div className="st-kinds" role="radiogroup" aria-label="How you are training">
        {TRAINING_STATUS_KINDS.map((k) => (
          <Pressable key={k} className={`st-kind ${kind === k ? 'is-on' : ''}`} press="surface" role="radio" aria-checked={kind === k} onPress={() => setKind(k)} label={`${TRAINING_STATUS_INFO[k].label}. ${TRAINING_STATUS_INFO[k].line}`}>
            <span className={`st-dot st-${k}`} aria-hidden="true" />
            <span className="st-kind-main">
              <span className="st-kind-name">{TRAINING_STATUS_INFO[k].label}</span>
              <span className="st-kind-line">{TRAINING_STATUS_INFO[k].line}</span>
            </span>
            {kind === k ? <Check size={18} className="st-check" aria-hidden="true" /> : null}
          </Pressable>
        ))}
      </div>
      {kind !== 'training' ? (
        <div className="st-lengths">
          <span className="caps">For how long</span>
          <div className="st-chips" role="radiogroup" aria-label="For how long">
            {STATUS_LENGTHS.map((l) => (
              <button key={l.id} type="button" role="radio" aria-checked={len === l.id} className={`st-len ${len === l.id ? 'is-on' : ''}`} onClick={() => setLen(l.id)}>
                {l.label}
              </button>
            ))}
          </div>
          {until ? <p className="st-foot">Through {fmtDate('long', until)}. Then back to Training.</p> : len === 'open' ? <p className="st-foot">Until you set it back to Training.</p> : null}
        </div>
      ) : null}
      <Button variant="primary" block className="st-save" disabled={!ready} onClick={onSave}>
        {kind === 'training' ? 'Back to Training' : `Set ${TRAINING_STATUS_INFO[kind].label}`}
      </Button>
    </div>
  );
};

/** A plan's name without the length the template appends ("Half marathon · 12 weeks" is "Half marathon"): the goal. */
export const goalName = (name: string) => name.replace(/\s*·\s*\d+\s*weeks?$/i, '').trim() || name;

/**
 * Plan's own week count (features/plan/topWords.ts): weeks run Monday to Sunday from the first Monday on or after the start;
 * the days before it are the warm-up week. So a 12 week plan that starts on a Tuesday reads "Warm-up week", then "Week 1 of
 * 12", the same as its name and as Plan (today-top-09).
 */
const DAY = 86_400_000;
const days = (a: ISODate, b: ISODate) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DAY);
export const firstMonday = (b: Pick<PlanBlock, 'start'>) => (mondayOf(b.start) === b.start ? b.start : shiftDays(mondayOf(b.start), 7));
export const planWeekCount = (b: Pick<PlanBlock, 'start' | 'end'>) => {
  const m = firstMonday(b);
  return b.end < m ? 1 : Math.floor(days(m, b.end) / 7) + 1;
};

/** The plan a day belongs to: its goal and which week, or the next one and when it starts. Null with no plan now or ahead. */
export const blockWords = (blocks: PlanBlock[], date: ISODate) => {
  const live = blocks.filter((b) => b.end >= date).sort((a, b) => (a.start < b.start ? -1 : 1));
  const b = live.find((x) => x.start <= date) ?? live[0];
  if (!b) return null;
  const title = goalName(b.name);
  if (b.start > date) return { title, sub: `Starts ${b.start <= shiftDays(date, 6) ? fmtDate('dowLong', b.start) : fmtDate('md', b.start)}` };
  const m = firstMonday(b);
  if (date < m) return { title, sub: 'Warm-up week' };
  const total = planWeekCount(b);
  return { title, sub: `Week ${Math.min(total, Math.floor(days(m, date) / 7) + 1)} of ${total}` };
};

/** Pill 1's words (layout plan 2.1 T1): the kind, and its end after a dot ("Sick · until Tue"); training says how. */
export const statusWords = (kind: TrainingStatusKind, until: ISODate | null | undefined, today: ISODate, planned: boolean): { head: string; end: string; dot: 'sky' | 'pencil' } => {
  if (kind === 'training') return { head: planned ? 'On the plan' : 'Day by day', end: '', dot: 'sky' };
  const u = until ? untilWords(until, today) : '';
  return { head: TRAINING_STATUS_INFO[kind].label, end: u === 'today' ? 'today only' : u, dot: kind === 'taper' ? 'sky' : 'pencil' };
};

/**
 * Fit by measure (layout plan 2.1 T1): the row never wraps and never cuts a word. When a label would be cut, pill 1 drops its
 * end and shows the kind alone ("Injured"); the end stays in its VoiceOver label and in the status sheet. Measured on mount,
 * whenever the row resizes, and when the words change.
 */
const useFit = (key: string) => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const row = ref.current;
    if (!row) return;
    const fit = () => {
      delete row.dataset.short;
      const cut = [...row.querySelectorAll<HTMLElement>('.status-pill-label')].some((l) => l.scrollWidth > l.clientWidth + 0.5);
      if (cut) row.dataset.short = '';
    };
    fit();
    const ro = new ResizeObserver(() => fit());
    ro.observe(row);
    // Inter may arrive after the first paint (web): measure again once it has
    let gone = false;
    void document.fonts?.ready.then(() => !gone && fit());
    return () => {
      gone = true;
      ro.disconnect();
    };
  }, [key]);
  return ref;
};

/**
 * The status row under Today's title (layout plan 2.1 T1, guide 6.13): two glass pills on the ground, 12 apart. Pill 1 is how
 * you are training and until when (a tap opens the status sheet); pill 2 is the plan's phase alone (a tap opens Plan; the
 * plan's name is in its VoiceOver label and on Plan). With no plan now or ahead, pill 2 offers to make one.
 */
export const StatusChip = ({ date, today, onPlan }: { date: ISODate; today: ISODate; onPlan?: () => void }): React.JSX.Element => {
  const boot = useBootstrap();
  const sheet = useSheet();
  const nav = useNav();
  const s = boot.data?.user.status ?? null;
  const kind = statusOn(s, date);
  const blk = blockWords(boot.data?.blocks ?? [], date);
  const w = statusWords(kind, s?.until, today, !!blk);
  const said = kind === 'training' ? w.head : `${TRAINING_STATUS_INFO[kind].label}, ${w.end || 'until changed'}`;
  const ref = useFit(`${w.head}|${w.end}|${blk?.sub ?? ''}|${onPlan ? 1 : 0}`);
  return (
    <div className="status-row" ref={ref}>
      <StatusPill
        className={`st-pill st-pill-${kind}`}
        dot={w.dot}
        chevron="down"
        label={
          <>
            {w.head}
            {w.end ? <span className="st-end"> · {w.end}</span> : null}
          </>
        }
        voiceLabel={`Status: ${said}. Change`}
        onPress={() => sheet.open({ eyebrow: 'Status', title: 'How are you training?', body: <StatusSheet current={s} today={today} /> })}
      />
      {blk ? (
        <StatusPill className="st-pill st-phase" label={blk.sub} voiceLabel={`${blk.title}, ${blk.sub}. Open Plan`} onPress={() => nav.go('/plan')} />
      ) : onPlan ? (
        // no plan now or ahead: the pill offers one and opens the plan builder (today-top-12)
        <StatusPill className="st-pill st-phase st-noplan" label="Make a plan" chevron="right" voiceLabel="No plan yet. Make a plan" onPress={onPlan} />
      ) : null}
    </div>
  );
};

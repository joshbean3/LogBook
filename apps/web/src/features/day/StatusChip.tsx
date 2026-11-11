import { TRAINING_STATUS_INFO, TRAINING_STATUS_KINDS, fmtDate, mondayOf, shiftDays, STATUS_LENGTHS, statusOn, untilFor, type TrainingStatus, type TrainingStatusKind, type ISODate, type PlanBlock } from '@logbook/shared';
import { Check } from 'lucide-react';
import type * as React from 'react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
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

/**
 * Opens the status sheet. Two ways in: the status pill, which shows only while a status is on, and Today's title menu
 * (hold the title or the date: `Change training status…`), which is where a status starts in ordinary training.
 */
export const useOpenStatusSheet = (today: ISODate): (() => void) => {
  const sheet = useSheet();
  const current = useBootstrap().data?.user.status ?? null;
  return useCallback(() => sheet.open({ eyebrow: 'Status', title: 'How are you training?', body: <StatusSheet current={current} today={today} /> }), [sheet, current, today]);
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

/**
 * The status pill's words (guide 6.13): the kind, and its end after a dot ("Sick · until Tue"). Null in ordinary training:
 * a day that runs as planned has no status pill, since the plan pill and the hero already say what the day is.
 */
export const statusWords = (kind: TrainingStatusKind, until: ISODate | null | undefined, today: ISODate): { head: string; end: string; dot: 'sky' | 'pencil' } | null => {
  if (kind === 'training') return null;
  const u = until ? untilWords(until, today) : '';
  return { head: TRAINING_STATUS_INFO[kind].label, end: u === 'today' ? 'today only' : u, dot: kind === 'taper' ? 'sky' : 'pencil' };
};

/**
 * Fit by measure (guide 6.13): the row never wraps and never cuts a word. It gives up words in this order until every
 * label fits: the plan pill drops the plan's name and keeps its phase ("Week 3 of 12"); then the status pill drops its end
 * and shows the kind alone ("Injured"). What is dropped stays in the pill's VoiceOver label, on Plan and in the status
 * sheet. When even that is cut (large text on a small phone), the pills stack, as they do at 200 percent, and each gets
 * back what fits. Measured on mount, whenever the row resizes, and when the words change.
 */
const SHORT = ['', 'plan', 'both'] as const;
const useFit = (key: string) => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const row = ref.current;
    if (!row) return;
    const cut = () => [...row.querySelectorAll<HTMLElement>('.status-pill-label')].some((l) => l.scrollWidth > l.clientWidth + 0.5);
    const fit = () => {
      for (const stack of [false, true]) {
        for (const short of SHORT) {
          if (stack) row.dataset.stack = '';
          else delete row.dataset.stack;
          if (short) row.dataset.short = short;
          else delete row.dataset.short;
          if (!cut()) return;
        }
      }
    };
    fit();
    const ro = new ResizeObserver(() => fit());
    ro.observe(row);
    // the pills are a fixed 32 tall: a text size change resizes their labels, not always the row
    row.querySelectorAll('.status-pill-label').forEach((l) => ro.observe(l));
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

/** What the row shows, as data: the status pill while a status is on, the plan pill, or the offer to make a plan. */
export interface StatusRow {
  /** While a status is on: its kind, its words and what VoiceOver says. Null in ordinary training. */
  status: { kind: TrainingStatusKind; head: string; end: string; dot: 'sky' | 'pencil'; said: string } | null;
  /** The plan the day belongs to (now or next): its name, where the day is in it, and what VoiceOver says. */
  plan: { name: string; phase: string; said: string } | null;
  /** No plan now or ahead, and the page can open the builder: the pill offers one. */
  make: boolean;
}
export const statusRow = (status: TrainingStatus | null | undefined, blocks: PlanBlock[], date: ISODate, today: ISODate, canPlan: boolean): StatusRow => {
  const kind = statusOn(status, date);
  const w = statusWords(kind, status?.until, today);
  const blk = blockWords(blocks, date);
  return {
    status: w ? { kind, ...w, said: `Status: ${TRAINING_STATUS_INFO[kind].label}, ${w.end || 'until changed'}. Change` } : null,
    plan: blk ? { name: blk.title, phase: blk.sub, said: `${blk.title}, ${blk.sub}. Open Plan` } : null,
    make: !blk && canPlan,
  };
};

/**
 * The row under Today's week strip (guide 6.13, layout standard 2.3): glass pills on the ground, 12 apart, from the left.
 *
 * - The plan pill is always there: the plan's name and where the day is in it ("Half marathon · Week 3 of 12"), and a tap
 *   opens Plan. With no plan now or ahead it offers one ("Make a plan") and opens the builder.
 * - The status pill comes first, and only while a status is on (Taper, Rest, Sick, Injured, Travel): what it is and until
 *   when. A tap opens the status sheet. In ordinary training there is no status pill: "On the plan" and "Day by day" said
 *   nothing the plan pill and the hero do not, and the sheet is in Today's title menu (`useOpenStatusSheet`).
 *
 * So the row holds one pill on most days and two while a status is on. With nothing to show it is not rendered, and the
 * hero starts 16 under the strip.
 */
export const StatusChip = ({ date, today, onPlan }: { date: ISODate; today: ISODate; onPlan?: () => void }): React.JSX.Element | null => {
  const boot = useBootstrap();
  const nav = useNav();
  const openStatus = useOpenStatusSheet(today);
  const row = statusRow(boot.data?.user.status, boot.data?.blocks ?? [], date, today, !!onPlan);
  const { status, plan } = row;
  const ref = useFit(`${status?.head ?? ''}|${status?.end ?? ''}|${plan?.name ?? ''}|${plan?.phase ?? ''}|${row.make ? 1 : 0}`);
  if (!status && !plan && !row.make) return null;
  return (
    <div className="status-row" ref={ref}>
      {status ? (
        <StatusPill
          className={`st-pill st-status st-pill-${status.kind}`}
          dot={status.dot}
          chevron="down"
          label={
            <>
              {status.head}
              {status.end ? <span className="st-end"> · {status.end}</span> : null}
            </>
          }
          voiceLabel={status.said}
          onPress={openStatus}
        />
      ) : null}
      {plan ? (
        <StatusPill
          className="st-pill st-phase"
          chevron="right"
          label={
            <>
              <span className="st-name">{plan.name} · </span>
              {plan.phase}
            </>
          }
          voiceLabel={plan.said}
          onPress={() => nav.go('/plan')}
        />
      ) : row.make ? (
        // no plan now or ahead: the pill offers one and opens the plan builder (today-top-12)
        <StatusPill className="st-pill st-phase st-noplan" label="Make a plan" chevron="right" voiceLabel="No plan yet. Make a plan" onPress={onPlan} />
      ) : null}
    </div>
  );
};

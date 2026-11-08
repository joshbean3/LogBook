import { TRAINING_STATUS_INFO, TRAINING_STATUS_KINDS, fmtDate, mondayOf, shiftDays, STATUS_LENGTHS, statusOn, untilFor, type TrainingStatus, type TrainingStatusKind, type ISODate, type PlanBlock } from '@logbook/shared';
import { Bandage, CalendarDays, Check, ChevronDown, Footprints, Moon, Plane, Thermometer, TrendingDown } from 'lucide-react';
import type * as React from 'react';
import { useState } from 'react';
import { useNav } from '@/app/NavController';
import { useBootstrap, useSetStatus } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { Button } from '@/ui/primitives';
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
              <button key={l.id} type="button" role="radio" aria-checked={len === l.id} className={`st-chip ${len === l.id ? 'is-on' : ''}`} onClick={() => setLen(l.id)}>
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

const KIND_ICON: Record<TrainingStatusKind, typeof Footprints> = { training: Footprints, taper: TrendingDown, rest: Moon, sick: Thermometer, injured: Bandage, travel: Plane };

/** The block a day belongs to: its name and which week, or the next one and when it starts. */
const blockWords = (blocks: PlanBlock[], date: ISODate) => {
  const live = blocks.filter((b) => b.end >= date).sort((a, b) => (a.start < b.start ? -1 : 1));
  const b = live.find((x) => x.start <= date) ?? live[0];
  if (!b) return null;
  const weeks = Math.max(1, Math.round((Date.parse(`${b.end}T12:00:00Z`) - Date.parse(`${mondayOf(b.start)}T12:00:00Z`)) / (7 * 86_400_000)));
  if (b.start > date) return { title: b.name, sub: `Starts ${b.start <= shiftDays(date, 6) ? fmtDate('dowLong', b.start) : fmtDate('md', b.start)}` };
  const wk = Math.floor((Date.parse(`${mondayOf(date)}T12:00:00Z`) - Date.parse(`${mondayOf(b.start)}T12:00:00Z`)) / (7 * 86_400_000)) + 1;
  return { title: b.name, sub: `Week ${wk} of ${weeks}` };
};

/**
 * The context row under Today's title (docs/shape-system.md §3, context chips): how you are training and until when (a tap
 * opens the status sheet), and the block this day belongs to (a tap opens Plan).
 */
export const StatusChip = ({ date, today }: { date: ISODate; today: ISODate }): React.JSX.Element => {
  const boot = useBootstrap();
  const sheet = useSheet();
  const nav = useNav();
  const s = boot.data?.user.status ?? null;
  const kind = statusOn(s, date);
  const sub = kind === 'training' ? 'On the plan' : s?.until ? untilWords(s.until, today).replace(/^until /, 'Until ').replace(/^today$/, 'Today only') : 'Until changed';
  const Icon = KIND_ICON[kind];
  const blk = blockWords(boot.data?.blocks ?? [], date);
  return (
    <div className="ctx-row st-row">
      <Pressable className={`ctx-chip st-chip st-chip-${kind}`} press="scale" onPress={() => sheet.open({ eyebrow: 'Status', title: 'How are you training?', body: <StatusSheet current={s} today={today} /> })} label={`Status: ${TRAINING_STATUS_INFO[kind].label}, ${sub}. Change`}>
        <span className="ctx-ic" aria-hidden="true">
          <Icon size={17} />
        </span>
        <span className="ctx-text">
          <span className="ctx-title">{TRAINING_STATUS_INFO[kind].label}</span>
          <span className="ctx-sub">{sub}</span>
        </span>
        <ChevronDown size={15} aria-hidden="true" />
      </Pressable>
      {blk ? (
        <Pressable className="ctx-chip st-block" press="scale" onPress={() => nav.go('/plan')} label={`${blk.title}, ${blk.sub}. Open Plan`}>
          <span className="ctx-ic" aria-hidden="true">
            <CalendarDays size={17} />
          </span>
          <span className="ctx-text">
            <span className="ctx-title">{blk.title}</span>
            <span className="ctx-sub">{blk.sub}</span>
          </span>
        </Pressable>
      ) : null}
    </div>
  );
};

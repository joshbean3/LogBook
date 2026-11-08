import { TRAINING_STATUS_INFO, TRAINING_STATUS_KINDS, fmtDate, shiftDays, STATUS_LENGTHS, statusOn, untilFor, type TrainingStatus, type TrainingStatusKind, type ISODate } from '@logbook/shared';
import { Check, ChevronDown } from 'lucide-react';
import type * as React from 'react';
import { useState } from 'react';
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

/**
 * The status chip under Today's title (docs/inspiration.md §6, Today 1): how you are training on this day, and until when.
 * A tap opens the sheet to change it.
 */
export const StatusChip = ({ date, today }: { date: ISODate; today: ISODate }): React.JSX.Element => {
  const boot = useBootstrap();
  const sheet = useSheet();
  const s = boot.data?.user.status ?? null;
  const kind = statusOn(s, date);
  const when = kind !== 'training' && s ? untilWords(s.until, today) : '';
  const words = `${TRAINING_STATUS_INFO[kind].label}${when ? ` · ${when}` : ''}`;
  return (
    <div className="st-row">
      <Pressable className={`st-pill st-pill-${kind}`} press="scale" onPress={() => sheet.open({ eyebrow: 'Status', title: 'How are you training?', body: <StatusSheet current={s} today={today} /> })} label={`Status: ${words}. Change`}>
        <span className={`st-dot st-${kind}`} aria-hidden="true" />
        <span>{words}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </Pressable>
    </div>
  );
};

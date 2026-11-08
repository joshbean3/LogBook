import { DAY_TAG_LABEL_MAX, DAY_TAG_MAX, dayTagEffectWords, dayTagId, type DayTagStat } from '@logbook/shared';
import { ChevronRight, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { haptics } from '@/lib/haptics';
import { revealField } from '@/lib/keyboard';
import { useSheet } from '@/ui/Sheet';
import { SkeletonRows } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';
import { useDayTagMutations, useDayTags, useDayTagStats } from './tags';
import './daytags.css';

/**
 * The day's tags, under its memory on the day page: each tag a row with Yes and No (a second tap on the lit one clears it),
 * a row to add a tag of your own, and the way to what they do. Days to come have none.
 */
export const DayTags = ({ date, today }: { date: string; today: string }) => {
  const q = useDayTags(date, date <= today);
  const { mark, add } = useDayTagMutations();
  const sheet = useSheet();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  if (date > today) return null;
  const d = q.data;
  const tags = d?.tags ?? [];
  const set = (tag: string, value: boolean) => {
    const next = d?.values[tag] === value ? null : value;
    haptics.select();
    mark.mutate({ date, tag, value: next }, { onError: () => toast('Couldn’t save that. Try again.') });
  };
  const addOne = () => {
    const label = draft.trim().slice(0, DAY_TAG_LABEL_MAX);
    setDraft('');
    setAdding(false);
    if (!label) return;
    const id = dayTagId(label);
    if (!id) return toast('Use a letter or a number in the name.');
    if (tags.some((t) => t.id === id)) return;
    add.mutate({ id, label }, { onError: () => toast('Couldn’t add that tag. Try again.') });
  };
  const marked = tags.filter((t) => d?.values[t.id] !== undefined).length;
  return (
    <section className="dt" aria-label="The day’s tags">
      <div className="dt-head">
        <span className="caps">The day</span>
        <span className="dt-count tnum">{tags.length ? `${marked} of ${tags.length} marked` : ''}</span>
      </div>
      <ul className="dt-rows">
        {tags.map((t) => {
          const v = d?.values[t.id];
          return (
            <li key={t.id} className="dt-row">
              <span className="dt-label">{t.label}</span>
              <span className="dt-pair" role="group" aria-label={t.label}>
                <button type="button" className={`dt-btn ${v === true ? 'is-yes' : ''}`} aria-pressed={v === true} onClick={() => set(t.id, true)}>
                  Yes
                </button>
                <button type="button" className={`dt-btn ${v === false ? 'is-no' : ''}`} aria-pressed={v === false} onClick={() => set(t.id, false)}>
                  No
                </button>
              </span>
            </li>
          );
        })}
        {tags.length < DAY_TAG_MAX ? (
          <li className="dt-row dt-add">
            {adding ? (
              <input
                className="dt-input"
                autoFocus
                maxLength={DAY_TAG_LABEL_MAX}
                placeholder="Coffee after 2 pm"
                aria-label="New tag"
                enterKeyHint="done"
                value={draft}
                onFocus={(e) => revealField(e.currentTarget)}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={addOne}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addOne();
                  } else if (e.key === 'Escape') setAdding(false);
                }}
              />
            ) : (
              <button type="button" className="dt-addbtn" onClick={() => setAdding(true)}>
                <Plus size={15} strokeWidth={2.4} aria-hidden="true" /> Add a tag
              </button>
            )}
          </li>
        ) : null}
      </ul>
      <button type="button" className="dt-link" onClick={() => sheet.open({ eyebrow: 'Journal', title: 'Day tags', detent: 'large', detents: ['large'], body: <TagStats /> })}>
        What they do <ChevronRight size={14} aria-hidden="true" />
      </button>
    </section>
  );
};

/** A count filling toward the minimum: `4 of 5`, a bar that is full at five. */
const Toward = ({ label, n, min }: { label: string; n: number; min: number }) => (
  <span className={`dt-toward ${n >= min ? 'is-full' : ''}`}>
    <span className="dt-toward-top">
      <span>{label}</span>
      <span className="tnum">{n >= min ? n : `${n} of ${min}`}</span>
    </span>
    <span className="dt-bar" aria-hidden="true">
      <i style={{ transform: `scaleX(${Math.min(1, n / min)})` }} />
    </span>
  </span>
);

/** One tag's counts, and its effect once there are enough of each; never a number before. */
const TagStat = ({ t, effort, min, onRemove }: { t: DayTagStat; effort: boolean; min: number; onRemove: () => void }) => {
  const enoughDays = t.yes >= min && t.no >= min;
  // with ratings in the data, the counts that matter are the days followed by a rated run
  const yes = effort ? t.ratedYes : t.yes;
  const no = effort ? t.ratedNo : t.no;
  const effect = t.effect ? dayTagEffectWords(t.effect) : effort ? 'Effect shows once there is enough.' : enoughDays ? 'Effect shows once runs carry an effort rating.' : 'Effect shows once there is enough.';
  return (
    <li className="dt-stat">
      <div className="dt-stat-head">
        <span className="dt-stat-name">{t.label}</span>
        <span className="dt-stat-sum tnum">
          {t.yes} yes · {t.no} no
        </span>
        <button type="button" className="dt-x" aria-label={`Remove ${t.label}`} onClick={onRemove}>
          <X size={15} aria-hidden="true" />
        </button>
      </div>
      <div className="dt-towards">
        <Toward label={effort ? 'Yes, then a rated run' : 'Yes days'} n={yes} min={min} />
        <Toward label={effort ? 'No, then a rated run' : 'No days'} n={no} min={min} />
      </div>
      <p className={`dt-effect ${t.effect ? 'has' : ''}`}>{effect}</p>
    </li>
  );
};

/** What the tags do: every tag's counts, filling toward five and five, then the effect on the next day's run. */
const TagStats = () => {
  const q = useDayTagStats();
  const { remove, add } = useDayTagMutations();
  const toast = useToast();
  if (!q.data) return <SkeletonRows rows={4} label="Loading the tags" />;
  const { tags, effort, min } = q.data;
  return (
    <div className="dt-sheet">
      <p className="dt-intro">
        Each yes or no is matched with how hard the next day’s run felt, its effort from 1 to 10. A tag shows its effect once it has {min} yes days and {min} no days with a rated run after them.
      </p>
      {tags.length ? (
        <ul className="dt-stats">
          {tags.map((t) => (
            <TagStat
              key={t.id}
              t={t}
              effort={effort}
              min={min}
              onRemove={() => {
                haptics.delete();
                remove.mutate(t.id);
                toast(`${t.label} removed. Its days are kept`, { label: 'Undo', fn: () => add.mutate({ id: t.id, label: t.label }) });
              }}
            />
          ))}
        </ul>
      ) : (
        <p className="dt-intro">No tags. Add one from a day’s page.</p>
      )}
      {!effort ? <p className="dt-foot">No run has an effort rating yet, so the effect waits. Keep marking the days.</p> : null}
    </div>
  );
};

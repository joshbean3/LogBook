import type * as React from 'react';
import { fmtDate, type Learning } from '@logbook/shared';
import { Pressable } from '@/ui/Pressable';
import { KSection } from '../goals/Kit';
import { useLearningEchoes } from './queries';

/** `Nov 10, 2025`: the year only when it is not this one. */
const dateWords = (d: string, today: string) => (d.slice(0, 4) === today.slice(0, 4) ? fmtDate('md', d) : `${fmtDate('md', d)}, ${d.slice(0, 4)}`);

/**
 * "From your archive" (under today's card on the Learned tab): up to three rows of one inset group, a year ago, a month ago
 * and one at random, each a tap from its sheet (layout plan 2.3 L3). The words are the archive's voice, Fraunces italic at
 * the row size in Dusk, two lines at most, so they read under the hero and never against it; when they come from is the
 * row's subtitle. Only the slots with a learning show, and the section only once one has. `action` sits in the header.
 */
export const Echoes = ({ today, onOpen, action }: { today: string; onOpen: (l: Learning) => void; action?: React.ReactNode }) => {
  const q = useLearningEchoes();
  const e = q.data;
  const slots = [
    { key: 'year', when: 'A year ago', item: e?.yearAgo },
    { key: 'month', when: 'A month ago', item: e?.monthAgo },
    { key: 'random', when: 'From any day', item: e?.random },
  ].filter((x): x is { key: string; when: string; item: Learning } => !!x.item);
  if (!slots.length) return null;
  return (
    <KSection title="From your archive" action={action} className="ln-echoes">
      <div className="k-rows ln-echo-rows">
        {slots.map((s) => (
          <Pressable key={s.key} as="button" className="k-row two ln-echo" press="surface" onPress={() => onOpen(s.item)} label={`${s.when}, ${dateWords(s.item.date, today)}: ${s.item.text}. Edit`}>
            <span className="k-row-main" aria-hidden="true">
              <span className="ln-echo-text">{s.item.text}</span>
              <span className="k-row-sub">
                {s.when} · {dateWords(s.item.date, today)}
              </span>
            </span>
          </Pressable>
        ))}
      </div>
    </KSection>
  );
};

import { eachDay, fmtDate, heldOn, monthOf, shiftDays, TRAINING_STATUS_INFO, type ISODate, type Session, type TrainingStatus, type TrainingStatusKind } from '@logbook/shared';
import { Bandage, ChevronRight, Footprints, Moon, Plane, Thermometer, TrendingDown, type LucideIcon } from 'lucide-react';
import type * as React from 'react';
import { useMemo } from 'react';
import { useBootstrap, useSetStatus } from '@/api/queries';
import { useOpenAssistant } from '@/features/assistant/openAssistant';
import { useLog, type Log } from '@/features/log/useLog';
import { useToday } from '@/lib/useToday';
import { Pressable } from '@/ui/Pressable';

/** The words a held status uses in a sentence: "while you're sick". */
const WHILE: Record<TrainingStatusKind, string> = { training: '', taper: '', travel: '', sick: 'while you’re sick', injured: 'while you’re injured', rest: 'while you rest' };

const HELD_ICON: Record<TrainingStatusKind, LucideIcon> = { training: Footprints, taper: TrendingDown, rest: Moon, sick: Thermometer, injured: Bandage, travel: Plane };

/** The last day a status holds sessions, for counting and asking: its end, or a fortnight out when it has none. */
const lastHeldDay = (s: TrainingStatus, today: ISODate) => s.until ?? shiftDays(today, 13);

/** A planned session the status holds: not a rest, not yet marked. */
export const isHeld = (s: Session) => s.kind !== 'rest' && !s.mark;

/** The sessions a status holds from today through its last held day. */
const heldSessions = (log: Log, s: TrainingStatus, today: ISODate) =>
  eachDay(today, lastHeldDay(s, today)).flatMap((d) => (heldOn(s, d) ? log.snap.sessionsOn(d).filter(isHeld) : []));

/** What to ask the assistant: the reason, the window, and how to move them. It is pre-filled, so you see it before it is sent. */
const askFor = (s: TrainingStatus, kind: TrainingStatusKind, today: ISODate) =>
  s.until
    ? `I'm ${TRAINING_STATUS_INFO[kind].label.toLowerCase()} through ${fmtDate('long', s.until)}. Move the sessions I'll miss to after I'm back, easing back in and keeping the week's shape.`
    : `I'm ${TRAINING_STATUS_INFO[kind].label.toLowerCase()} from ${fmtDate('long', today)} with no end date yet. Hold the next two weeks of sessions and suggest how to ease back in.`;

/**
 * The held banner, at the top of Plan while a status holds sessions (docs/inspiration.md §5): the status and its end, how
 * many sessions are waiting, and two ways out: ask the assistant to move them (you review and apply, as always), or say
 * you're back.
 */
export const HeldBanner = (): React.JSX.Element | null => {
  const today = useToday();
  const s = useBootstrap().data?.user.status ?? null;
  const kind = heldOn(s, today);
  const months = useMemo(() => (s ? [...new Set([monthOf(today), monthOf(lastHeldDay(s, today))])] : []), [s, today]);
  const log = useLog(months);
  const open = useOpenAssistant();
  const back = useSetStatus();
  if (!s || !kind) return null;
  const n = heldSessions(log, s, today).length;
  const end = s.until ? (s.until === today ? 'Today only' : `Through ${fmtDate(s.until <= shiftDays(today, 6) ? 'dowLong' : 'md', s.until)}`) : 'Until you’re back';
  const Icon = HELD_ICON[kind];
  return (
    <section className={`held held-${kind}`} aria-label="Sessions on hold">
      <span className="held-glow" aria-hidden="true" />
      <span className="held-top">
        <span className="held-ic" aria-hidden="true">
          <Icon size={17} />
        </span>
        <span className="held-words">
          <span className="held-title">{TRAINING_STATUS_INFO[kind].label}</span>
          <span className="held-sub">{end}</span>
        </span>
      </span>
      <p className="held-line">{n ? `${n} ${n === 1 ? 'session waits' : 'sessions wait'} ${WHILE[kind]}.` : `Nothing planned is waiting ${WHILE[kind]}.`}</p>
      <div className="held-actions">
        {n ? (
          <button type="button" className="btn primary sm" onClick={() => open(today, askFor(s, kind, today))}>
            Move them
          </button>
        ) : null}
        <button type="button" className="btn soft sm" onClick={() => back.mutate({ kind: 'training', until: null, today })}>
          I’m back
        </button>
      </div>
    </section>
  );
};

/**
 * On Today, above the hero, while today's planned session is held: one line that says so, and a tap to ask the assistant to
 * move it.
 */
export const HeldNote = ({ date, log }: { date: ISODate; log: Log }): React.JSX.Element | null => {
  const s = log.boot?.user.status ?? null;
  const kind = heldOn(s, date);
  const open = useOpenAssistant();
  if (!s || !kind || date !== log.today) return null;
  const held = log.snap.sessionsOn(date).filter(isHeld);
  if (!held.length) return null;
  const what = held.length === 1 ? (held[0]!.title || held[0]!.type || (held[0]!.kind === 'lift' ? 'lift' : 'run')) : `${held.length} sessions`;
  return (
    <Pressable className={`held-note held-${kind}`} press="surface" onPress={() => open(date, askFor(s, kind, date))} label={`Today’s ${what} ${held.length === 1 ? 'is' : 'are'} on hold ${WHILE[kind]}. Move`}>
      <span className="held-dot" aria-hidden="true" />
      <span className="held-note-text">
        Today’s {what} {held.length === 1 ? 'is' : 'are'} on hold {WHILE[kind]}.
      </span>
      <span className="held-note-go">
        Move <ChevronRight size={14} aria-hidden="true" />
      </span>
    </Pressable>
  );
};

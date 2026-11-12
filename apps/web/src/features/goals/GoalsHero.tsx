import { monthOf, type Aim, type ISODate } from '@logbook/shared';
import { Check, ChevronRight } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNav } from '@/app/NavController';
import { useBootstrap, useGoalMutations, useGoals, useMonth, useTodos } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { useFitness } from '@/lib/prefs';
import { PathCheck, Poster, PosterScene } from '@/ui/poster';
import { Pressable } from '@/ui/Pressable';
import { Button } from '@/ui/primitives';
import { useToast } from '@/ui/Toast';
import { cardsFor, focusOf } from '../dayplan/model';
import { clockOf, goalOf, STATUS_WORD } from './model';
import { useOpenGoal } from './GoalSheets';
import { useMarkDone } from './Steps';
import { Burst } from './game';
import { todayBand } from './GoalsHero.logic';
import { localGoalIdea, type GoalIdea } from './goalsIdea.local';
import './goalsPage.css';

/** A goal's words inside a longer label, without its own full stop. */
const bare = (t: string) => t.replace(/[.\s]+$/, '');

/**
 * Set the suggested goal in one tap: the idea becomes today's goal as written (yesterday's goal brings its why and its
 * steps as they stood), one light haptic, and a toast whose Undo takes it away again.
 */
const useSetIdea = (today: ISODate) => {
  const { set, clear } = useGoalMutations();
  const toast = useToast();
  const qc = useQueryClient();
  return (idea: GoalIdea) => {
    const from = idea.carry;
    haptics.drop();
    set.mutate({ level: 'day', period: today, text: from ? from.text : idea.text, why: from?.why ?? null, ...(from ? { steps: from.steps.map((s) => ({ ...s })) } : { chose: 'own' as const }) });
    toast(from ? 'Carried over to today' : 'Goal set', {
      label: 'Undo',
      fn: () => {
        // the goal may still carry its provisional id; whichever it has now is the one to take away
        const now = goalOf(qc.getQueryData<Aim[]>(['goals']), 'day', today);
        if (now) clear.mutate(now.id);
      },
    });
  };
};

/**
 * Today's goal as the Goals page's poster (ui/poster), in the state Today shows.
 *
 * Nothing set: the question as the title, "Today · 14 h left", and the band holds one idea from the person's own day with
 * where it came from. "Set this goal" sets it in one tap (a toast offers Undo); "Something else" opens the goal editor.
 *
 * Set: the goal is the title (a tap opens its sheet: why, steps, the review, edit, clear), the sun climbs with the day's
 * to-dos done, the band counts them and names the next one (a tap goes to Today), and under it the goal's own check:
 * "Not done yet" until it is marked done (the toast offers Undo; a second tap opens it again).
 */
export const GoalsHero = ({ today, now, hit }: { today: ISODate; now: number; hit: number }) => {
  const nav = useNav();
  const open = useOpenGoal();
  const goals = useGoals();
  const todos = useTodos();
  const boot = useBootstrap();
  const fitness = useFitness();
  const month = useMonth(monthOf(today));
  const { review } = useGoalMutations();
  const markDone = useMarkDone();
  const setIdea = useSetIdea(today);
  const goal = goalOf(goals.data, 'day', today);
  const clock = clockOf('day', today, now);

  // the day's to-dos as Today lists them: the open ones in the order they matter, then what got done
  const list = useMemo(() => focusOf(cardsFor(todos.data, null, today, today)).flatMap((c) => (c.kind === 'todo' ? [{ text: c.todo.text, done: c.done }] : [])), [todos.data, today]);
  const idea = useMemo(
    () =>
      goal
        ? null
        : localGoalIdea({
            goals: goals.data,
            today,
            todos: list.filter((t) => !t.done),
            sessions: fitness ? (month.data?.sessions ?? []).filter((s) => s.date === today && !(s as { deletedAt?: string | null }).deletedAt) : [],
            habits: (boot.data?.habits ?? []).filter((h) => !h.archivedOn),
            fitness,
          }),
    [goal, goals.data, today, list, fitness, month.data, boot.data],
  );

  // the goal arriving while the page is open (never one that loads set): its words rise into the title, once
  const had = useRef(!!goal);
  const [rose, setRose] = useState(false);
  useEffect(() => {
    if (goal && !had.current) setRose(true);
    if (!goal) setRose(false);
    had.current = !!goal;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!goal]);

  if (!goal)
    return (
      <Poster className="gx" label="Today’s goal, not set" title="What would make today count?" now="Today" meta={clock.words} band={idea ? { label: idea.caption, words: idea.text } : undefined}>
        <div className="po-actions">
          {idea ? (
            <>
              <Button variant="primary" onClick={() => setIdea(idea)}>
                <Check size={18} aria-hidden="true" /> Set this goal
              </Button>
              <Button variant="quiet" onClick={() => open('day', today)}>
                Something else
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => open('day', today)}>
              Set today’s goal
            </Button>
          )}
        </div>
      </Poster>
    );

  const isOpen = goal.status === 'open';
  const done = goal.status === 'done';
  const band = todayBand(list, goal.steps);
  const n = goal.steps.length;
  const k = goal.steps.filter((s) => s.done).length;
  const stepsWords = n ? `${k} of ${n} steps` : '';
  const status = isOpen ? 'Not done yet' : done ? 'Done today' : goal.status === 'partly' ? 'Partly done' : 'Missed';
  return (
    <Poster
      className={`gx is-${goal.status}`}
      label={`Today’s goal: ${bare(goal.text)}`}
      titleSize="goal"
      title={
        <Pressable className={`gx-title${rose ? ' is-new' : ''}`} press="dim" onPress={() => open('day', today)} label={`${bare(goal.text)}. ${stepsWords ? `${stepsWords} done. ` : ''}Open the goal`}>
          <span className="gx-title-in">{goal.text}</span>
        </Pressable>
      }
      now="Today’s goal"
      meta={isOpen ? clock.words : STATUS_WORD[goal.status]}
      // the goal hit puts the sun at its place; until then it climbs with the day's to-dos
      scene={<PosterScene lit total={band.total} done={band.done} progress={done ? 1 : undefined} />}
      band={{ label: band.label, words: band.words, onPress: () => nav.go('/today'), pressLabel: `${band.label}. ${band.words}. Open Today` }}
    >
      <div className="gx-status">
        <span className="gx-status-words">
          <span className="gx-status-main">{status}</span>
          {stepsWords ? <span className="gx-status-sub">{stepsWords}</span> : null}
        </span>
        {isOpen || done ? (
          <span className="gx-check">
            <PathCheck checked={done} label={done ? `${bare(goal.text)}, done. Open it again` : `${bare(goal.text)}, mark done`} onPress={() => (done ? review.mutate({ id: goal.id, status: 'open' }) : markDone(goal))} />
            <Burst go={hit} />
          </span>
        ) : (
          <Button variant="quiet" className="gx-status-open" onClick={() => open('day', today)}>
            Details
            <ChevronRight size={18} aria-hidden="true" />
          </Button>
        )}
      </div>
    </Poster>
  );
};

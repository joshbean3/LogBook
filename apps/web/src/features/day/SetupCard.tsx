import { Activity, CalendarDays, Check, ChevronRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useHabitMutations } from '@/api/queries';
import { EmptyState, Pressable, useSheet } from '@/ui';
import { HABIT_STARTERS } from '../habits/OrbRow';
import type { Log } from '../log/useLog';
import { openTemplate } from '../plan/Blocks';

const AddHabitsSheet = () => {
  const { add } = useHabitMutations();
  const sheet = useSheet();
  return <EmptyState starters={HABIT_STARTERS} onStarter={(name) => add.mutateAsync(name)} verb={{ label: 'Done', onPress: () => sheet.close() }} startersLabel="Starter habits">Tap the ones you want to do every day. They become lights on Today.</EmptyState>;
};

/**
 * The first day: one card instead of five grey sentences. Three starter actions, each ticking itself off when it is done:
 * Add habits (a sheet of starter chips), Plan a week (the Plan team's New block sheet: a template from your days and miles),
 * Connect Strava (Settings).
 */
export const SetupCard = ({ log, hasPlan }: { log: Log; hasPlan: boolean }) => {
  const nav = useNavigate();
  const sheet = useSheet();
  const steps = [
    { key: 'habits', icon: <Sparkles size={20} />, title: 'Add habits', sub: 'Sleep, stretch, read: the small daily lights.', done: log.habits.length > 0, go: () => sheet.open({ title: 'Add habits', body: <AddHabitsSheet /> }) },
    { key: 'plan', icon: <CalendarDays size={20} />, title: 'Plan a week', sub: 'Pick your run days; Logbook writes the week.', done: hasPlan, go: () => openTemplate(sheet, log) },
    ...(log.features.strava ? [{ key: 'strava', icon: <Activity size={20} />, title: 'Connect Strava', sub: 'Runs land here and mark themselves done.', done: !!log.strava?.connected, go: () => nav('/settings') }] : []),
  ];
  const left = steps.filter((s) => !s.done).length;
  return (
    <section className="aura setup halo-upcoming" aria-label="Set up your day">
      <span className="aura-glow" aria-hidden="true" />
      <span className="caps">{left === steps.length ? 'Welcome' : `${steps.length - left} of ${steps.length} done`}</span>
      <h2 className="setup-title display">Set up your day</h2>
      <div className="setup-steps">
        {steps.map((s) => (
          <Pressable key={s.key} className={`setup-step ${s.done ? 'is-done' : ''}`} pressScale={0.98} onPress={s.go} label={`${s.title}${s.done ? ', done' : ''}. ${s.sub}`}>
            <span className="setup-ic" aria-hidden="true">
              {s.done ? <Check size={20} strokeWidth={2.6} /> : s.icon}
            </span>
            <span className="setup-text">
              <span className="setup-step-title">{s.title}</span>
              <span className="setup-sub">{s.sub}</span>
            </span>
            <ChevronRight size={18} className="setup-chev" aria-hidden="true" />
          </Pressable>
        ))}
      </div>
    </section>
  );
};

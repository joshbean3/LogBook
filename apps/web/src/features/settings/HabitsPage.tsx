import { fmtDate, type Habit } from '@logbook/shared';
import { ArrowDown, ArrowUp, Archive, GripVertical, Pencil, Plus } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useBootstrap, useHabitMutations } from '@/api/queries';
import { STARTER_HABITS } from '@/features/onboarding/model';
import { haptics } from '@/lib/haptics';
import { liftFx, useHoldDrag } from '@/lib/useDrag';
import { springs } from '@/lib/motion';
import { useContextMenu, type ContextMenuItem } from '@/ui/ContextMenu';
import { PushedHeader } from '@/ui/headers';
import { Button, EmptyState, Section } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { LONG_PRESS_MS } from '@/ui/useLongPress';
import { useToast } from '@/ui/Toast';

const ROW_H = 60;

/** A habit's own sheet: rename it (saves as you leave the field), see since when, archive it with Undo. */
const HabitSheet = ({ habit, onArchive }: { habit: Habit; onArchive: () => void }) => {
  const hm = useHabitMutations();
  const sheet = useSheet();
  const [name, setName] = useState(habit.name);
  const save = () => {
    const n = name.trim().replace(/\s+/g, ' ');
    if (!n) return setName(habit.name);
    if (n !== habit.name) {
      hm.patch.mutate({ id: habit.id, name: n });
      sheet.update({ title: n });
    }
  };
  return (
    <div className="s-hsheet">
      <label className="s-label" htmlFor="s-hname">
        Name
      </label>
      <input
        id="s-hname"
        className="in s-hname"
        value={name}
        maxLength={80}
        enterKeyHint="done"
        onChange={(e) => setName(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') setName(habit.name);
        }}
      />
      <p className="s-note">On Today since {fmtDate('long', habit.createdOn)}. Its history stays if you archive it.</p>
      <Button
        variant="quiet"
        block
        className="s-archive"
        onClick={() => {
          sheet.close();
          onArchive();
        }}
      >
        <Archive size={18} aria-hidden="true" />
        Archive
      </Button>
    </div>
  );
};

/**
 * One habit in the list. Tap: its sheet (rename, archive). Hold: it lifts; drag it up or down to reorder (siblings spring
 * aside, a tick per slot, a drop on release); let go without moving and its menu opens (Rename, Move up, Move down,
 * Archive), which is also the keyboard and VoiceOver path (the hidden "actions" button, Shift+F10).
 */
const HabitRow = ({ habit, index, count, lifted, y, onLift, onMove, onDrop, onCancel, onOpen, menuItems }: {
  habit: Habit;
  index: number;
  count: number;
  lifted: boolean;
  y: number;
  onLift: () => void;
  onMove: (dy: number) => void;
  onDrop: () => void;
  onCancel: () => void;
  onOpen: () => void;
  menuItems: ContextMenuItem[];
}) => {
  const reduce = useReducedMotion();
  const menu = useContextMenu();
  const rowRef = useRef<HTMLDivElement | null>(null);
  const fx = liftFx(lifted, reduce);
  const openMenu = (el: HTMLElement) => menu.open({ items: menuItems, anchor: el, label: `${habit.name} actions`, haptic: false });
  const drag = useHoldDrag<HTMLDivElement>({
    holdMs: LONG_PRESS_MS,
    onArm: () => {
      haptics.lift();
      onLift();
    },
    onMove: (p) => onMove(p.dy),
    onDrop: () => onDrop(),
    onCancel: (_phase, reason) => {
      onCancel();
      if (reason === 'up' && rowRef.current) openMenu(rowRef.current);
    },
  });
  return (
    <motion.div
      ref={(el) => {
        rowRef.current = el;
        drag.ref.current = el;
      }}
      className={`s-hrow ${lifted ? 'is-lifted' : ''}`}
      layout={lifted || reduce ? false : 'position'}
      animate={{ y, scale: fx.scale }}
      transition={{ y: lifted || reduce ? { duration: 0 } : springs.settle, scale: fx.transition, layout: springs.settle }}
      style={{ zIndex: lifted ? 3 : undefined }}
      {...drag.bind}
    >
      <button
        type="button"
        className="s-hrow-main"
        onClick={() => {
          if (drag.consumeClick()) return;
          onOpen();
        }}
        onKeyDown={(e) => {
          if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') {
            e.preventDefault();
            if (rowRef.current) openMenu(rowRef.current);
          }
        }}
        aria-label={`${habit.name}, ${index + 1} of ${count}. Open`}
      >
        <span className="s-horb" aria-hidden="true">
          {habit.name.charAt(0).toUpperCase()}
        </span>
        <span className="s-hname-text">{habit.name}</span>
      </button>
      <button type="button" className="s-hgrip" aria-label={`${habit.name} actions`} onClick={(e) => openMenu(e.currentTarget.closest('.s-hrow') as HTMLElement)}>
        <GripVertical size={18} aria-hidden="true" />
      </button>
    </motion.div>
  );
};

export const HabitsPage = () => {
  const boot = useBootstrap();
  const hm = useHabitMutations();
  const sheet = useSheet();
  const toast = useToast();
  const [text, setText] = useState('');
  const all = boot.data?.habits ?? [];
  const live = all.filter((h) => !h.archivedOn).sort((a, b) => a.position - b.position);
  const archived = all.filter((h) => h.archivedOn);
  const byId = new Map(all.map((h) => [h.id, h]));

  // the drag: the order while it is under way, which row is up, where it started, how far the finger has gone
  const [order, setOrder] = useState<string[] | null>(null);
  const [lift, setLift] = useState<{ id: string; start: number; over: number; dy: number } | null>(null);
  const ids = order ?? live.map((h) => h.id);
  const liveKey = live.map((h) => h.id).join();
  useEffect(() => {
    if (!lift && order && order.join() === liveKey) setOrder(null);
  }, [lift, order, liveKey]);

  const archive = (h: Habit) => {
    hm.patch.mutate({ id: h.id, archived: true });
    haptics.delete();
    toast(`${h.name} archived`, { label: 'Undo', fn: () => hm.patch.mutate({ id: h.id, archived: false }) });
  };
  const moveTo = (id: string, to: number) => {
    const cur = live.map((h) => h.id);
    const from = cur.indexOf(id);
    if (from < 0 || to < 0 || to >= cur.length || to === from) return;
    cur.splice(from, 1);
    cur.splice(to, 0, id);
    haptics.drop();
    hm.reorder.mutate(cur);
  };
  const openSheet = (h: Habit) => sheet.open({ eyebrow: 'Habit', title: h.name, body: <HabitSheet habit={h} onArchive={() => archive(h)} /> });
  const itemsFor = (h: Habit, i: number): ContextMenuItem[] => [
    { label: 'Rename', icon: <Pencil size={18} />, onSelect: () => openSheet(h) },
    { label: 'Move up', icon: <ArrowUp size={18} />, disabled: i === 0, onSelect: () => moveTo(h.id, i - 1) },
    { label: 'Move down', icon: <ArrowDown size={18} />, disabled: i === live.length - 1, onSelect: () => moveTo(h.id, i + 1) },
    { label: 'Archive', icon: <Archive size={18} />, destructive: true, onSelect: () => archive(h) },
  ];

  const add = (name: string) => {
    const n = name.trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!n) return;
    const dupe = all.find((h) => h.name.toLowerCase() === n.toLowerCase());
    if (dupe && !dupe.archivedOn) return toast(`${dupe.name} is already on Today.`);
    haptics.toggle();
    if (dupe) hm.patch.mutate({ id: dupe.id, archived: false });
    else hm.add.mutate(n);
  };
  const starters = STARTER_HABITS.filter((s) => !live.some((h) => h.name.toLowerCase() === s.toLowerCase()));

  return (
    <div className="page s-set s-sub">
      <PushedHeader title="Habits" backLabel="Back to Settings" />
      {live.length ? (
        <>
          <p className="s-lede">Tap one to rename it. Hold and drag to change the order on Today.</p>
          <div className="s-hlist" style={{ height: ids.length * ROW_H }}>
            {ids.map((id, i) => {
              const h = byId.get(id);
              if (!h) return null;
              const up = lift?.id === id;
              return (
                <HabitRow
                  key={id}
                  habit={h}
                  index={i}
                  count={ids.length}
                  lifted={up}
                  y={up && lift ? lift.dy - (lift.over - lift.start) * ROW_H : 0}
                  menuItems={itemsFor(h, live.findIndex((x) => x.id === id))}
                  onOpen={() => openSheet(h)}
                  onLift={() => {
                    setOrder(live.map((x) => x.id));
                    setLift({ id, start: i, over: i, dy: 0 });
                  }}
                  onMove={(dy) =>
                    setLift((l) => {
                      if (!l) return l;
                      const over = Math.max(0, Math.min(live.length - 1, l.start + Math.round(dy / ROW_H)));
                      if (over !== l.over) {
                        haptics.select();
                        setOrder((o) => {
                          const next = [...(o ?? live.map((x) => x.id))].filter((x) => x !== id);
                          next.splice(over, 0, id);
                          return next;
                        });
                      }
                      return { ...l, over, dy };
                    })
                  }
                  onDrop={() => {
                    const next = order;
                    setLift(null);
                    haptics.drop();
                    // keep the dropped order on screen until the cache has it, so nothing jumps back for a frame
                    if (next && next.join() !== live.map((x) => x.id).join()) {
                      hm.reorder.mutate(next);
                      setTimeout(() => setOrder(null), 1500);
                    } else setOrder(null);
                  }}
                  onCancel={() => {
                    setLift(null);
                    setOrder(null);
                  }}
                />
              );
            })}
          </div>
        </>
      ) : (
        <div className="sec-secondary">
          <EmptyState
            ghost={
              <div className="s-ghost-orbs">
                {['S', 'S', 'R', 'P'].map((c, i) => (
                  <span key={i} className="s-horb big">
                    {c}
                  </span>
                ))}
              </div>
            }
            starters={[...STARTER_HABITS]}
            onStarter={(n) => hm.add.mutateAsync(n)}
          >
            Habits are the small lights on Today. Start with one.
          </EmptyState>
        </div>
      )}

      {live.length ? (
        <Section title="Add a habit" level="primary">
          <form
            className="s-add"
            onSubmit={(e) => {
              e.preventDefault();
              add(text);
              setText('');
            }}
          >
            <input className="in s-add-in" value={text} maxLength={80} placeholder="Floss, Walk the dog, Vitamins" aria-label="New habit" enterKeyHint="done" onChange={(e) => setText(e.target.value)} />
            <button type="submit" className="s-add-btn" aria-label="Add habit" disabled={!text.trim()}>
              <Plus size={20} aria-hidden="true" />
            </button>
          </form>
          {starters.length ? (
            <div className="s-starters" role="group" aria-label="Starters">
              {starters.map((s) => (
                <button key={s} type="button" className="s-starter" onClick={() => add(s)}>
                  <Plus size={14} aria-hidden="true" />
                  {s}
                </button>
              ))}
            </div>
          ) : null}
        </Section>
      ) : null}

      {archived.length ? (
        <Section title="Archived" meta={archived.length} level="primary">
          <div className="list-edge s-list">
            {archived.map((h) => (
              <div key={h.id} className="s-row">
                <span className="s-row-main">
                  <span className="s-row-title muted">{h.name}</span>
                  <span className="s-row-sub">Archived {fmtDate('md', h.archivedOn!)}</span>
                </span>
                <button
                  type="button"
                  className="btn soft sm s-restore"
                  onClick={() => {
                    haptics.toggle();
                    hm.patch.mutate({ id: h.id, archived: false });
                  }}
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
};

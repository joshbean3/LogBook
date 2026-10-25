import { fmtDate, type Habit } from '@logbook/shared';
import { ArrowDown, ArrowUp, Archive, GripVertical, Pencil, Plus } from 'lucide-react';
import { animate, motion, motionValue, useReducedMotion, type MotionValue } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useBootstrap, useHabitMutations } from '@/api/queries';
import { STARTER_HABITS } from '@/features/onboarding/model';
import { haptics } from '@/lib/haptics';
import { springs } from '@/lib/motion';
import { useContextMenu, type ContextMenuItem } from '@/ui/ContextMenu';
import { Button, EmptyState, Pressable, PushedBar, Row, Section, type DragPoint } from '@/ui';
import { useSheet } from '@/ui/Sheet';
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
 * One habit in the list. Tap: its sheet (rename, archive). Hold 450: it lifts with its menu (Rename, Move up, Move down,
 * Archive); move after the lift and the menu closes and the row follows the finger (siblings spring aside on `settle`, a
 * `select` per slot, a `drop` on release). The grip and Shift+F10 open the same menu (the keyboard and VoiceOver path).
 * Its offset is a motion value the page drives directly (no render per finger move).
 */
const HabitRow = ({ habit, index, count, lifted, y, onDragStart, onDragMove, onDragEnd, onOpen, menuItems }: {
  habit: Habit;
  index: number;
  count: number;
  lifted: boolean;
  y: MotionValue<number>;
  onDragStart: () => void;
  onDragMove: (p: DragPoint) => void;
  onDragEnd: (cancelled: boolean) => void;
  onOpen: () => void;
  menuItems: ContextMenuItem[];
}) => {
  const menu = useContextMenu();
  const rowRef = useRef<HTMLDivElement | null>(null);
  const openMenu = () => rowRef.current && menu.open({ items: menuItems, anchor: rowRef.current, label: `${habit.name} actions`, haptic: false });
  return (
    <motion.div
      ref={rowRef}
      className={`s-hrow ${lifted ? 'is-lifted' : ''}`}
      style={{ y, zIndex: lifted ? 3 : undefined }}
    >
      <Pressable
        className="s-hrow-main"
        press="surface"
        onPress={onOpen}
        holdMenu={menuItems}
        menuLabel={`${habit.name} actions`}
        onDragStart={() => onDragStart()}
        onDragMove={(p) => onDragMove(p)}
        onDragEnd={(_p, _e, cancelled) => onDragEnd(cancelled)}
        label={`${habit.name}, ${index + 1} of ${count}. Open. Hold to move`}
      >
        <span className="s-horb" aria-hidden="true">
          {habit.name.charAt(0).toUpperCase()}
        </span>
        <span className="s-hname-text">{habit.name}</span>
      </Pressable>
      <button type="button" className="s-hgrip" aria-label={`${habit.name} actions`} onClick={openMenu}>
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
  // the add field's own answer (a duplicate): in place, under the field, not a toast
  const [note, setNote] = useState<string | null>(null);
  const all = boot.data?.habits ?? [];
  const live = all.filter((h) => !h.archivedOn).sort((a, b) => a.position - b.position);
  const archived = all.filter((h) => h.archivedOn);
  const byId = new Map(all.map((h) => [h.id, h]));

  // The drag (review code F4, F5). While it is under way the DOM order never changes: the lifted row's offset is the
  // finger's (a motion value set on the pointer move itself, so it is on screen in the same frame) and the rows it passes
  // move aside by one row on `settle`. On the drop the new order commits once, and every row is re-based in that commit's
  // layout effect from where it is on screen to its new slot, so nothing jumps. The dropped order stays on screen until
  // the cache has it; the drag's own state lives in a ref, so a second drag right after a drop starts from what is shown.
  const [order, setOrder] = useState<string[] | null>(null);
  const [liftId, setLiftId] = useState<string | null>(null);
  const drag = useRef<{ id: string; base: string[]; start: number; over: number } | null>(null);
  const dropped = useRef<Map<string, number> | null>(null);
  const ys = useRef(new Map<string, MotionValue<number>>());
  const yOf = (id: string) => {
    let v = ys.current.get(id);
    if (!v) ys.current.set(id, (v = motionValue(0)));
    return v;
  };
  const reduce = useReducedMotion();
  const ids = order ?? live.map((h) => h.id);
  const liveKey = live.map((h) => h.id).join();
  useEffect(() => {
    if (!liftId && order && order.join() === liveKey) setOrder(null);
  }, [liftId, order, liveKey]);
  // the drop's commit: each row from where it is on screen (its old slot + its offset) to its new slot, on `settle`
  useLayoutEffect(() => {
    const was = dropped.current;
    if (!was) return;
    dropped.current = null;
    ids.forEach((id, i) => {
      const at = was.get(id);
      if (at == null) return;
      const y = yOf(id);
      y.jump(at - i * ROW_H);
      if (Math.abs(y.get()) >= 0.5 && !reduce) animate(y, 0, springs.settle);
      else y.jump(0);
    });
  });
  const startDrag = (id: string) => {
    const base = [...ids];
    const start = base.indexOf(id);
    if (start < 0) return;
    for (const k of base) yOf(k).jump(0);
    drag.current = { id, base, start, over: start };
    setLiftId(id);
  };
  const moveDrag = (dy: number) => {
    const g = drag.current;
    if (!g) return;
    yOf(g.id).set(dy);
    const over = Math.max(0, Math.min(g.base.length - 1, g.start + Math.round(dy / ROW_H)));
    if (over === g.over) return;
    g.over = over;
    haptics.select();
    // the rows between the start and the slot under the finger make room by one row; the others go home
    g.base.forEach((k, i) => {
      if (k === g.id) return;
      const to = i > g.start && i <= over ? -ROW_H : i < g.start && i >= over ? ROW_H : 0;
      const y = yOf(k);
      if (reduce) y.jump(to);
      else if (y.get() !== to) animate(y, to, springs.settle);
    });
  };
  const endDrag = (cancelled: boolean) => {
    const g = drag.current;
    drag.current = null;
    if (!g) return;
    const next = [...g.base];
    if (!cancelled) {
      next.splice(g.start, 1);
      next.splice(g.over, 0, g.id);
    }
    setLiftId(null);
    if (!cancelled) haptics.drop();
    if (cancelled || next.join() === g.base.join()) {
      // nothing moved: every row goes home from where it is, in the same order
      for (const k of g.base) {
        if (reduce) yOf(k).jump(0);
        else void animate(yOf(k), 0, springs.settle);
      }
      return;
    }
    // where every row is on screen now, in list coordinates (its slot in the shown order + its offset)
    dropped.current = new Map(g.base.map((k, i) => [k, i * ROW_H + yOf(k).get()]));
    setOrder(next);
    hm.reorder.mutate(next, { onError: () => setOrder(null) });
  };

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
    if (dupe && !dupe.archivedOn) return setNote(`${dupe.name} is already on Today.`);
    setNote(null);
    if (dupe) hm.patch.mutate({ id: dupe.id, archived: false });
    else hm.add.mutate(n);
  };
  const starters = STARTER_HABITS.filter((s) => !live.some((h) => h.name.toLowerCase() === s.toLowerCase()));

  return (
    <div className="page s-set s-sub">
      <PushedBar title="Habits" />
      {live.length ? (
        <>
          <p className="s-lede">Tap one to rename it. Hold and drag to change the order on Today.</p>
          <div className="s-hlist" style={{ height: ids.length * ROW_H }}>
            {ids.map((id, i) => {
              const h = byId.get(id);
              if (!h) return null;
              const up = liftId === id;
              return (
                <HabitRow
                  key={id}
                  habit={h}
                  index={i}
                  count={ids.length}
                  lifted={up}
                  y={yOf(id)}
                  menuItems={itemsFor(h, live.findIndex((x) => x.id === id))}
                  onOpen={() => openSheet(h)}
                  onDragStart={() => startDrag(id)}
                  onDragMove={({ dy }) => moveDrag(dy)}
                  onDragEnd={(cancelled) => endDrag(cancelled)}
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
            <input className="in s-add-in" value={text} maxLength={80} placeholder="Floss, Vitamins" aria-label="New habit" aria-describedby={note ? 's-add-note' : undefined} enterKeyHint="done" onChange={(e) => (setText(e.target.value), setNote(null))} />
            <button type="submit" className="s-add-btn" aria-label="Add habit" disabled={!text.trim()}>
              <Plus size={20} aria-hidden="true" />
            </button>
          </form>
          {note ? (
            <p id="s-add-note" className="s-note" role="status">
              {note}
            </p>
          ) : null}
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
          <div className="group s-group">
            {archived.map((h) => (
              <Row
                key={h.id}
                className="s-archived"
                title={h.name}
                sub={`Archived ${fmtDate('md', h.archivedOn!)}`}
                right={
                  <button type="button" className="btn soft sm s-restore" onClick={() => hm.patch.mutate({ id: h.id, archived: false })}>
                    Restore
                  </button>
                }
              />
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
};

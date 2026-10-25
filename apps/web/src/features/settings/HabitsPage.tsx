import { fmtDate, today, type Habit } from '@logbook/shared';
import { ArrowDown, ArrowUp, Archive, GripVertical, Pencil, Plus } from 'lucide-react';
import { animate, motion, motionValue, useReducedMotion, type MotionValue } from 'motion/react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { keys, useBootstrap, useHabitMutations } from '@/api/queries';
import type { Bootstrap } from '@/api/types';
import { below, carry } from '@/features/journal/feel';
import { STARTER_HABITS } from '@/features/onboarding/model';
import { haptics } from '@/lib/haptics';
import { springs } from '@/lib/motion';
import { useContextMenu, type ContextMenuItem } from '@/ui/ContextMenu';
import { Button, EmptyState, Pressable, PushedBar, Row, Section, type DragPoint } from '@/ui';
import { useSheet, useSheetMotion } from '@/ui/Sheet';
import { restoreFocus } from '@/ui/focus';
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
          // the answer starts on the tap (the haptic); the archive itself waits for the sheet to be gone (review 3 code N4)
          onArchive();
          sheet.close();
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
      data-hid={habit.id}
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
  const qc = useQueryClient();
  const sheet = useSheet();
  const toast = useToast();
  const [text, setText] = useState('');
  // the add field's own answer (a duplicate): in place, under the field, not a toast
  const [note, setNote] = useState<string | null>(null);
  // Archive, Undo and Restore are shown first and written after (review 3 code N4 / feel R3-5). The page's own overlay of
  // `archived` per habit changes what it draws in a commit of this page alone, so the rows close up (or open) at once on a
  // still main thread; the bootstrap write, whose commit re-renders every reader of it (Today under the stack included,
  // request 23), goes out once the rows are at rest, so its long frame never lands inside their spring. An entry is
  // dropped once the cache agrees with it (or the write failed and the server's answer is back).
  const [pend, setPend] = useState<Record<string, boolean>>({});
  const cached = boot.data?.habits ?? [];
  const all = Object.keys(pend).length ? cached.map((h) => (h.id in pend ? { ...h, archivedOn: pend[h.id] ? (h.archivedOn ?? today()) : null } : h)) : cached;
  const live = all.filter((h) => !h.archivedOn).sort((a, b) => a.position - b.position);
  const archived = all.filter((h) => h.archivedOn);
  const byId = new Map(all.map((h) => [h.id, h]));

  // The drag (review code F4, F5). While it is under way the DOM order never changes: the lifted row's offset is the
  // finger's (a motion value set on the pointer move itself, so it is on screen in the same frame) and the rows it passes
  // move aside by one row on `settle`. On the drop the new order commits once, and every row is re-based in that commit's
  // layout effect (the re-basing below) from where it is on screen to its new slot, so nothing jumps. The dropped order stays on screen until
  // the cache has it; the drag's own state lives in a ref, so a second drag right after a drop starts from what is shown.
  const [order, setOrder] = useState<string[] | null>(null);
  const [liftId, setLiftId] = useState<string | null>(null);
  const drag = useRef<{ id: string; base: string[]; start: number; over: number } | null>(null);
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

  // Every change to the order or to the set of rows (review 2 code N1, feel N2): a drag's drop, the menu's Move up / Move
  // down (the keyboard and VoiceOver path for the drag), Archive, Undo, Restore, a habit added, the server's order coming
  // back after a refused save. Rows have fixed 60 px slots, so where each row is on screen is its slot in the order shown
  // last plus its offset: read on the render that changes the order (no layout read), and in that commit's layout effect
  // each row that stays is put back there and springs to its new slot on `settle`. A row that arrives fades in (150 ms); a
  // row that leaves is drawn once more where it was, under the rows that close over it, and fades out; what is under the
  // list rides along on `settle`.
  const listRef = useRef<HTMLDivElement | null>(null);
  const moving = useRef(0);
  const sig = ids.join();
  const shown = useRef<{ sig: string; ids: string[] } | null>(null);
  const snap = useRef<{ sig: string; at: Map<string, number>; gone: Array<[HTMLElement, number]>; after: Array<[HTMLElement, number]> } | null>(null);
  if (shown.current && shown.current.sig !== sig && snap.current?.sig !== sig) {
    const at = new Map(shown.current.ids.map((k, i) => [k, i * ROW_H + yOf(k).get()]));
    const box = listRef.current;
    const keep = new Set(ids);
    const gone: Array<[HTMLElement, number]> = [];
    if (box && !reduce)
      for (const el of box.querySelectorAll<HTMLElement>(':scope > [data-hid]'))
        if (!keep.has(el.dataset.hid!)) gone.push([el.cloneNode(true) as HTMLElement, at.get(el.dataset.hid!) ?? 0]);
    const after: Array<[HTMLElement, number]> = box && !reduce ? below(box).map((n) => [n, n.getBoundingClientRect().top]) : [];
    snap.current = { sig, at, gone, after };
  }
  useLayoutEffect(() => {
    const was = snap.current;
    snap.current = null;
    shown.current = { sig, ids };
    if (!was || was.sig !== sig) return;
    const box = listRef.current;
    ids.forEach((id, i) => {
      const y = yOf(id);
      const from = was.at.get(id);
      if (from == null) {
        y.jump(0);
        if (!reduce) box?.querySelector<HTMLElement>(`:scope > [data-hid="${CSS.escape(id)}"]`)?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'cubic-bezier(.22,1,.36,1)' });
        return;
      }
      y.jump(from - i * ROW_H);
      if (Math.abs(y.get()) < 0.5 || reduce) return y.jump(0);
      // the spring's clock starts on the frame that paints the row where it was (a long commit frame is not elapsed time,
      // or at 4× the first painted frame would already be half way)
      const at = y.get();
      requestAnimationFrame(() => {
        if (y.get() !== at || y.isAnimating()) return;
        moving.current++;
        void animate(y, 0, springs.settle).then(() => void moving.current--);
      });
    });
    if (box)
      for (const [ghost, top] of was.gone) {
        ghost.classList.remove('is-lifted');
        ghost.setAttribute('aria-hidden', 'true');
        ghost.inert = true;
        Object.assign(ghost.style, { position: 'absolute', left: '0', right: '0', top: '0', transform: `translateY(${top}px)`, pointerEvents: 'none', zIndex: '-1' });
        box.appendChild(ghost);
        ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' }).onfinish = () => ghost.remove();
      }
    for (const [n, top] of was.after) if (n.isConnected) carry(n, top - n.getBoundingClientRect().top);
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  // after a change to the set of rows: the waiting writes go once the rows are at rest (the spring's 300 ms from the frame
  // that paints it, and a frame), and focus that fell with an archived row goes to its slot
  useEffect(() => {
    const slot = refocus.current;
    refocus.current = null;
    const raf = requestAnimationFrame(() => {
      if (Object.keys(pendRef.current).length) {
        if (flushT.current) clearTimeout(flushT.current);
        // the settle spring is about 0.5 s to its rest from the frame that paints it; the write waits for every row
        // (a spring stopped by a drag may never report its end: after 1.5 s the writes go anyway)
        let tries = 0;
        const later = (ms: number) => (flushT.current = setTimeout(() => (moving.current > 0 && ++tries < 10 ? later(100) : ((moving.current = 0), flushRef.current())), ms));
        later(520);
      }
      const a = document.activeElement;
      if (slot == null || (a && a !== document.body && a.isConnected && !a.closest('[inert]'))) return;
      const box = listRef.current;
      const rows = box ? [...box.querySelectorAll<HTMLElement>(':scope > [data-hid]:not([inert])')] : [];
      const to = rows[Math.min(slot, rows.length - 1)]?.querySelector<HTMLElement>('.s-hgrip') ?? document.querySelector<HTMLElement>('.pushed .s-add-in, .pushed .sec-secondary button');
      if (to) restoreFocus(to);
    });
    return () => cancelAnimationFrame(raf);
  }, [sig]);

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
    // the new order commits once; the re-basing effect above carries every row from where it is on screen
    setOrder(next);
    saveOrder(next);
  };
  // a refused save (review 2 code N2): WP2's `reorder` has already written the order into the bootstrap cache and has no
  // `onError` of its own (request 20), so the page asks for the server's order again (the rows slide back to it) and says so
  const saveOrder = (next: string[]) =>
    hm.reorder.mutate(next, {
      onError: () => {
        setOrder(null);
        void qc.invalidateQueries({ queryKey: keys.bootstrap });
        toast('Couldn’t save the order.');
      },
    });

  const pendRef = useRef(pend);
  pendRef.current = pend;
  const flushT = useRef<ReturnType<typeof setTimeout> | null>(null);
  // the re-basing springs still running (the waiting writes go once there are none)
  const flush = () => {
    if (flushT.current) clearTimeout(flushT.current);
    flushT.current = null;
    const now = qc.getQueryData<Bootstrap>(keys.bootstrap)?.habits ?? [];
    for (const [id, archived] of Object.entries(pendRef.current)) {
      const h = now.find((x) => x.id === id);
      if (!h || !!h.archivedOn === archived) continue;
      hm.patch.mutateAsync({ id, archived }).catch(() => {
        // the hook has asked for the server's list again; the rows go back to it on `settle`
        setPend(({ [id]: _, ...rest }) => rest);
        toast(archived ? `Couldn’t archive ${h.name}.` : `Couldn’t bring back ${h.name}.`);
      });
    }
  };
  // what the cache now agrees with needs no overlay (nothing changes on screen when it goes)
  useEffect(() => {
    const ids = Object.keys(pend);
    if (!ids.length) return;
    const agreed = ids.filter((id) => {
      const h = cached.find((x) => x.id === id);
      return !h || !!h.archivedOn === pend[id];
    });
    if (agreed.length) setPend((p) => Object.fromEntries(Object.entries(p).filter(([id]) => !agreed.includes(id))));
  }, [cached, pend]);
  // leaving the page sends what is still waiting
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => flushRef.current(), []);
  // focus (review 3 code N6): the archived row was where the menu or the sheet hands focus back; it goes to the row now in
  // its slot (or the one above, or the add field), never to <body>
  const refocus = useRef<number | null>(null);
  const setArchived = (h: Habit, archived: boolean) => {
    if (archived) refocus.current = live.findIndex((x) => x.id === h.id);
    setPend((p) => ({ ...p, [h.id]: archived }));
  };
  const archive = (h: Habit, haptic = true) => {
    setArchived(h, true);
    if (haptic) haptics.delete();
    toast(`${h.name} archived`, { label: 'Undo', fn: () => setArchived(h, false) });
  };
  // from the habit's sheet: once the sheet has closed (its spring never carries this page's commit)
  const sm = useSheetMotion();
  const afterSheet = useRef<Habit | null>(null);
  useEffect(() => {
    if (sm.open || !afterSheet.current) return;
    const h = afterSheet.current;
    afterSheet.current = null;
    archive(h, false);
  }, [sm.open]); // eslint-disable-line react-hooks/exhaustive-deps
  const moveTo = (id: string, to: number) => {
    const cur = live.map((h) => h.id);
    const from = cur.indexOf(id);
    if (from < 0 || to < 0 || to >= cur.length || to === from) return;
    cur.splice(from, 1);
    cur.splice(to, 0, id);
    haptics.drop();
    saveOrder(cur);
  };
  const openSheet = (h: Habit) =>
    sheet.open({
      eyebrow: 'Habit',
      title: h.name,
      body: (
        <HabitSheet
          habit={h}
          onArchive={() => {
            haptics.delete();
            afterSheet.current = h;
          }}
        />
      ),
    });
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
    if (dupe) setArchived(dupe, false);
    else hm.add.mutate(n);
  };
  const starters = STARTER_HABITS.filter((s) => !live.some((h) => h.name.toLowerCase() === s.toLowerCase()));

  return (
    <div className="page s-set s-sub">
      <PushedBar title="Habits" />
      {live.length ? (
        <>
          <p className="s-lede">Tap one to rename it. Hold and drag to change the order on Today.</p>
          <div className="s-hlist" ref={listRef} style={{ height: ids.length * ROW_H }}>
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
                  <button type="button" className="btn soft sm s-restore" onClick={() => setArchived(h, false)}>
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

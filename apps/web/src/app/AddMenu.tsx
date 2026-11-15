import { fmtDate, monthOf, shiftDays, type ISODate } from '@logbook/shared';
import { motion } from 'motion/react';
import type * as React from 'react';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useGoals } from '@/api/queries';
import { useOpenGoal } from '@/features/goals/GoalSheets';
import { useOpenAddHabit } from '@/features/habits/OrbRow';
import { journalIntent } from '@/features/journal/intent';
import { useLog } from '@/features/log/useLog';
import { defaultDay } from '@/features/sessions/addModel';
import { openAddSession } from '@/features/sessions/AddSessionSheet';
import { TodoListSheet } from '@/features/todos/TodoList';
import { haptics } from '@/lib/haptics';
import { useKeyboardOpen } from '@/lib/keyboard';
import { useReduced } from '@/lib/motion';
import { usePrefs } from '@/lib/prefs';
import { useLiveToday } from '@/lib/useToday';
import { restoreFocus } from '@/ui/focus';
import { NAV_EVENT, type NavEventDetail, type TabId } from '@/ui/nav';
import { useSheet } from '@/ui/Sheet';
import { usePress } from '@/ui/usePress';
import { addMotion, addOrder, addPlace, createAddMenu, keyStep, runAdd, type AddFlows, type Over } from './addRules';
import { AddButton, AddCard } from './AddParts';
import { useNav } from './NavController';
import './addMenu.css';

/** The card sits this far above the button (the context menu's own gap). */
const GAP = 8;
/** A finger that lets go this close to the button is still on it (`usePress`'s own slop). */
const BUTTON_SLOP = 12;

/** The app's own flows, as the menu calls them (`runAdd`). Each is the call its own screen already makes. */
const useAddFlows = (today: ISODate, existingHabits: string[]): AddFlows => {
  const sheet = useSheet();
  const nav = useNav();
  const openGoal = useOpenGoal();
  const addHabit = useOpenAddHabit();
  return {
    todo: (due) =>
      sheet.open({
        eyebrow: due ? fmtDate('short', due) : undefined,
        title: 'To-dos',
        detent: 'medium',
        detents: ['medium', 'large'],
        body: <TodoListSheet date={today} due={due ?? undefined} open={due ? 'later' : undefined} add />,
      }),
    goal: (level, period) => openGoal(level, period),
    session: (mon, date) => openAddSession(sheet, mon, date, today),
    habit: () => addHabit(existingHabits),
    // as Today's Journal row does: the tab, then the writer opened in place inside the same tap
    entry: () => {
      nav.go('/journal');
      journalIntent.set({ kind: 'entry' });
    },
  };
};

/**
 * The dock's Add button and its menu (guide 6.1; rules in `addRules.ts`). One round Paper button at the trailing end of
 * the ask bar's row, in the same place whether the dock is open or folded. A press opens a small card that grows out
 * of it, over a veil cut out around the button (the context menu's own cut-out, so the button needs no layer of its
 * own); each row opens the app's existing add flow for the day the screen shows. While it is open the page and the rest
 * of the dock cannot be reached (a touch on the veil only closes it; `inert` follows once the card has landed, so its
 * cost is not paid inside the opening), focus is in the menu, and Escape, Back or a touch on the veil closes it.
 */
export const AddMenu = ({ active, todayPath, planPath }: { active: TabId; todayPath: string; planPath: string }): React.JSX.Element => {
  const nav = useNav();
  const reduce = useReduced();
  const today = useLiveToday();
  const prefs = usePrefs();
  const goals = useGoals();
  const kb = useKeyboardOpen();
  const place = addPlace({ active, todayPath, planPath, today });
  // the shown week's days, for the day a session lands on (the months Fitness itself has already read)
  const months = useMemo(() => (place.week ? [...new Set([monthOf(place.week), monthOf(shiftDays(place.week, 6))])] : []), [place.week]);
  const log = useLog(months);
  const flows = useAddFlows(today, log.habits.map((h) => h.name));
  const rows = addOrder(active, { fitness: prefs.fitness, todos: prefs.today.day, habits: prefs.today.habits });
  const m = useMemo(() => addMotion(reduce), [reduce]);
  const menuId = useId();

  const btn = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  // what a choice runs, as of the last render
  const run = useRef<(index: number) => void>(() => undefined);
  run.current = (index) => {
    const kind = rows[index];
    if (kind) runAdd(kind, place, today, flows, { goals: goals.data, pickDay: (mon) => defaultDay(log.snap.sessionsOn, mon, today) });
  };
  /** Give the page back (see `hold` below); a no-op when it is not held. */
  const free = useRef<() => void>(() => undefined);
  const machine = useMemo(
    () =>
      createAddMenu({
        haptic: (e) => haptics[e](),
        choose: (index) => {
          // the page is the flow's now: Journal's writer takes its caret in the frame it opens
          free.current();
          // after the menu has let go of focus, so a sheet opened here takes the button as its opener
          requestAnimationFrame(() => run.current(index));
        },
      }),
    [],
  );
  // only open and closed are renders; the lit row is written to the DOM below
  const open = useSyncExternalStore(
    machine.subscribe,
    () => machine.get().open,
    () => false,
  );
  /** The layer is drawn: from the press that opens it until the close has played. */
  const [shown, setShown] = useState(false);
  // where the button stands, read as it opens: the card and the veil's cut-out are placed from it
  const [at, setAt] = useState<DOMRect | null>(null);
  const press = usePress();
  /** The click that follows a press on the button is that press's own: only a click with no pointer behind it toggles. */
  const pressed = useRef(false);
  const show = (el: HTMLElement) => {
    setAt(el.getBoundingClientRect());
    setShown(true);
  };

  // the row under the finger, lit: one attribute, moved without a render
  useEffect(
    () =>
      machine.subscribe(() => {
        const lit = machine.get().lit;
        for (const el of card.current?.querySelectorAll<HTMLElement>('.add-item') ?? []) el.toggleAttribute('data-lit', Number(el.dataset.i) === lit);
      }),
    [machine],
  );

  /** What is under a point: a row, the card, the button (with its slop) or anything else. */
  const over = (x: number, y: number): Over => {
    const el = document.elementFromPoint(x, y);
    const row = el?.closest<HTMLElement>('.add-item');
    if (row) return { on: 'row', index: Number(row.dataset.i) };
    if (el?.closest('.add-menu')) return { on: 'card' };
    const b = btn.current?.getBoundingClientRect();
    if (b && x >= b.left - BUTTON_SLOP && x <= b.right + BUTTON_SLOP && y >= b.top - BUTTON_SLOP && y <= b.bottom + BUTTON_SLOP) return { on: 'button' };
    return { on: 'outside' };
  };
  /** Follow one pointer from window listeners until it lifts: the rows it crosses light, and the row it lifts on is chosen. */
  const follow = (id: number) => {
    const opt = { capture: true } as const;
    const off = () => {
      window.removeEventListener('pointermove', move, opt);
      window.removeEventListener('pointerup', up, opt);
      window.removeEventListener('pointercancel', cancel, opt);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId === id) machine.move(over(e.clientX, e.clientY));
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      off();
      machine.release(over(e.clientX, e.clientY));
    };
    const cancel = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      off();
      machine.cancel();
    };
    window.addEventListener('pointermove', move, opt);
    window.addEventListener('pointerup', up, opt);
    window.addEventListener('pointercancel', cancel, opt);
  };

  /*
   * Once the card has landed, the page and the rest of the dock turn inert and Back closes the menu first (its one overlay
   * entry in history). Both wait for the landing, and are given back only after the close has played: each restyles or
   * re-renders the whole page, which neither the opening nor the closing should pay for. Until then a touch on the veil
   * is caught by the listener below, and Tab by the keys. A chosen row gives the page back at once: its flow needs it.
   */
  const hold = () => {
    if (held.current) return;
    held.current = true;
    const els = [...document.querySelectorAll<HTMLElement>('.tabs-host, .dock-ask, .dock-row')];
    for (const el of els) el.setAttribute('inert', '');
    let back = false;
    const release = nav.openOverlay(() => {
      back = true;
      machine.dismiss();
    });
    free.current = () => {
      free.current = () => undefined;
      held.current = false;
      for (const el of els) el.removeAttribute('inert');
      if (!back) release();
    };
  };
  const held = useRef(false);
  useEffect(() => () => free.current(), []);
  /** The close has played (or its rest never came: a hidden page runs no animation): the layer goes and the page comes back. */
  const gone = () => {
    if (machine.get().open) return;
    setShown(false);
    free.current();
  };
  useEffect(() => {
    if (open || !shown) return;
    const t = setTimeout(gone, 400);
    return () => clearTimeout(t);
  }, [open, shown]); // eslint-disable-line react-hooks/exhaustive-deps
  // a change of page under the menu closes it (once its entry is in history the controller does this itself)
  useEffect(() => {
    const away = (e: Event) => {
      if ((e as CustomEvent<NavEventDetail>).detail?.type !== 'overlay') machine.dismiss();
    };
    window.addEventListener(NAV_EVENT, away);
    return () => window.removeEventListener(NAV_EVENT, away);
  }, [machine]);

  // focus goes into the menu (the row by the button), and back to the button when it closes
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      const raf = requestAnimationFrame(() => card.current?.querySelector<HTMLElement>('.add-item[data-i="0"]')?.focus({ preventScroll: true }));
      return () => cancelAnimationFrame(raf);
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      if (btn.current?.isConnected) restoreFocus(btn.current);
    }
    return undefined;
  }, [open]);

  // keys, a touch on the veil, a turn of the phone
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const list = [...(card.current?.querySelectorAll<HTMLElement>('.add-item') ?? [])];
      const focused = list.find((el) => el === document.activeElement);
      const step = keyStep(e.key, focused ? Number(focused.dataset.i) : -1, list.length);
      if (!step) return;
      e.preventDefault();
      e.stopPropagation();
      if ('close' in step) machine.dismiss();
      else list.find((el) => Number(el.dataset.i) === step.focus)?.focus({ preventScroll: true });
    };
    // a touch that starts outside the card and the button closes the menu and goes no further (a toast keeps its taps)
    let swallowUntil = 0;
    const swallow = (e: Event) => {
      if (performance.now() > swallowUntil) return;
      e.stopPropagation();
      if (e.type === 'click') {
        e.preventDefault();
        swallowUntil = 0;
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target instanceof Element ? e.target : null;
      if (t?.closest('.add-menu, .dock-add')) return;
      machine.dismiss();
      if (t?.closest('.toast-host')) return;
      // and takes no focus with it: focus goes back to the button
      e.preventDefault();
      e.stopPropagation();
      swallowUntil = performance.now() + 800;
    };
    const away = () => machine.dismiss();
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointerup', swallow, true);
    window.addEventListener('click', swallow, true);
    window.addEventListener('resize', away);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('resize', away);
      // the click of the closing touch comes after the menu has gone: keep swallowing it for that pointer's lifetime
      const left = swallowUntil - performance.now();
      const off = () => {
        window.removeEventListener('pointerup', swallow, true);
        window.removeEventListener('click', swallow, true);
      };
      if (left > 0) setTimeout(off, left);
      else off();
    };
  }, [open, machine]);
  // the keyboard coming up closes it
  useEffect(() => {
    if (kb) machine.dismiss();
  }, [kb, machine]);

  // a card taller than the screen can hold scrolls (very large text on a short phone); otherwise a touch on it is the slide's
  useLayoutEffect(() => {
    const el = card.current;
    if (open && el) el.toggleAttribute('data-scrolls', el.scrollHeight > el.clientHeight + 1);
  }, [open]);

  const vw = typeof window === 'undefined' ? 0 : window.innerWidth;
  const vh = typeof window === 'undefined' ? 0 : window.innerHeight;
  return (
    <>
      <AddButton
        buttonRef={btn}
        open={open}
        m={m.glyph}
        menuId={menuId}
        {...press.handlers}
        onPointerDown={(e) => {
          press.handlers.onPointerDown?.(e);
          if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
          // no compatibility mouse events for this touch: the focus the menu takes is not handed back to the button as the finger lifts
          e.preventDefault();
          pressed.current = true;
          show(e.currentTarget);
          machine.pressButton();
          if (machine.get().open) follow(e.pointerId);
        }}
        onClick={(e) => {
          // the keyboard and VoiceOver click with no pointer behind them (`detail` 0)
          if (pressed.current && e.detail !== 0) return void (pressed.current = false);
          pressed.current = false;
          show(e.currentTarget);
          machine.toggle();
        }}
        onContextMenu={(e) => e.preventDefault()}
      />
      {typeof document === 'undefined'
        ? null
        : createPortal(
            // `cm-layer` only while it is drawn: the app reads that class as "a menu is up" (pull to refresh, tips, the day's rollover)
            <div className={shown ? 'cm-layer add-layer' : 'add-layer'} role="presentation" hidden={!shown}>
              <motion.div className="cm-hole add-hole" aria-hidden="true" style={at ? { left: at.left, top: at.top, width: at.width, height: at.height } : undefined} variants={m.veil} initial={false} animate={open ? 'open' : 'closed'} />
              <AddCard
                id={menuId}
                cardRef={card}
                rows={rows}
                open={open}
                m={m}
                style={at ? { right: vw - at.right, bottom: vh - at.top + GAP, transformOrigin: `calc(100% - ${at.width / 2}px) calc(100% + ${GAP + at.height / 2}px)` } : undefined}
                onRow={(index) => machine.clickRow(index)}
                onRest={(state) => {
                  // a rest that is no longer the menu's state (opened again mid-close) changes nothing
                  if (state === 'open' && machine.get().open) hold();
                  if (state === 'closed') gone();
                }}
                onPointerDown={(e) => {
                  if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
                  // as on the button: the row a touch lifts on keeps no focus, so the button has it when a sheet opens
                  e.preventDefault();
                  const row = e.target instanceof Element ? e.target.closest<HTMLElement>('.add-item') : null;
                  machine.pressCard(row ? Number(row.dataset.i) : -1);
                  follow(e.pointerId);
                }}
              />
            </div>,
            document.body,
          )}
    </>
  );
};

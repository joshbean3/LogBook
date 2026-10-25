import { counts, isAutoStatus, label, sessionStatus, type Session } from '@logbook/shared';
import { ArrowRightLeft, Check, HeartPulse, Pencil, Share2, SkipForward, Trash2, Undo2 } from 'lucide-react';
import { useSessionMutations } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import type { ContextMenuItem } from '@/ui/ContextMenu';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { markSeenToday } from '@/ui/useFirstToday';
import type { Log } from '../log/useLog';
import type { ShareData } from '../share/cards';
import { ShareSheet } from '../share/ShareSheet';
import { openMoveSheet, pushMoveSheet } from './MoveSheet';
import { useReshape } from './reshape';
import { SessionEditor } from './SessionEditor';

const nameOf = (s: Session) => (s.kind === 'rest' ? 'Rest' : label(s));

/** What can be done to a session on a day, given its state: future sessions can't be marked done (audit §2.3). */
export const sessionCan = (log: Log, date: string, s: Session) => {
  const st = sessionStatus(log.snap, date, s);
  const auto = isAutoStatus(log.snap, date, s);
  const training = s.kind !== 'rest';
  return {
    st,
    auto,
    /** Done / Floor by hand: today or past, not rest, not already proven by a run or logged sets. */
    mark: training && !auto && date <= log.today,
    skip: training && !counts(st),
    sick: training && !counts(st) && s.mark !== 'sick',
  };
};

/**
 * Every action a session has, in one place, so a row's swipe, its context menu and the session sheet do the same thing
 * with the same haptic and the same toast. `push` opens Move/Edit/Share inside the current sheet (from the session sheet).
 */
export const useSessionActions = (log: Log) => {
  const { mark, remove, restore } = useSessionMutations();
  const { easeAfter } = useReshape();
  const sheet = useSheet();
  const toast = useToast();

  /** Done by hand: the session's one success (a Strava run that lands later is silent, §6.1). */
  const done = (s: Session) => {
    mark.mutate({ session: s, mark: 'done' });
    markSeenToday(`success-${s.id}`);
    haptics.success();
  };
  /**
   * "Not feeling 100%" after a run that counted (§6.3): the run stays done; what it does is ease the next three days still
   * ahead, with Undo. Before it counts, it is the illness skip (`sick`). Returns how many sessions it eased: with none, it says
   * nothing (the sheet's pill answers in place; §8: toasts are for Undo and errors only, code review 1 #6).
   */
  const notFeeling = (date: string, s: Session): number => {
    if (counts(sessionStatus(log.snap, date, s))) {
      const r = easeAfter(log, date);
      if (r.eased) toast(`${r.eased} ${r.eased === 1 ? 'session' : 'sessions'} eased`, { label: 'Undo', fn: r.undo });
      return r.eased;
    }
    return sick(date, s);
  };
  /** Floor met by hand: the day kept. The sheet's Floor shows it; no toast without an Undo (§8). */
  const floor = (s: Session) => {
    mark.mutate({ session: s, mark: 'floor' });
    markSeenToday(`success-${s.id}`);
    haptics.success();
  };
  /** Un-completing is silent (§11.4). */
  const clear = (s: Session) => {
    mark.mutate({ session: s, mark: null });
  };
  const skip = (s: Session) => {
    const was = s.mark;
    const skipping = was !== 'skip' && was !== 'sick';
    mark.mutate({ session: s, mark: skipping ? 'skip' : null });
    toast(skipping ? `${nameOf(s)} skipped` : `${nameOf(s)} back on`, { label: 'Undo', fn: () => mark.mutate({ session: s, mark: was }) });
  };
  /**
   * "Not feeling 100%": skipped for illness (the week still counts it) and the next three days still ahead eased, in one
   * action with one Undo for both (§8: a toast carries an Undo or an error, never an offer; code review 1 #6).
   */
  const sick = (date: string, s: Session): number => {
    const was = s.mark;
    mark.mutate({ session: s, mark: 'sick' });
    const r = easeAfter(log, date);
    const said = r.eased ? `${nameOf(s)} skipped · ${r.eased} eased` : `${nameOf(s)} skipped`;
    toast(said, {
      label: 'Undo',
      fn: () => {
        mark.mutate({ session: { ...s, mark: 'sick' }, mark: was });
        r.undo();
      },
    });
    return r.eased;
  };
  const del = (s: Session) => {
    remove.mutate(s);
    sheet.close();
    haptics.delete();
    toast('Deleted', { label: 'Undo', fn: () => restore.mutate(s) });
  };
  const move = (date: string, s: Session, push = false) => (push ? pushMoveSheet(sheet, date, s) : openMoveSheet(sheet, date, s));
  const edit = (date: string, s: Session, push = false) => {
    const spec = { eyebrow: nameOf(s), title: 'Edit', detent: 'large' as const, body: <SessionEditor date={date} session={s} /> };
    if (push) sheet.push(spec);
    else sheet.open(spec);
  };
  const share = (data: ShareData, push = false) => {
    const spec = { title: 'Share', eyebrow: data.label ?? data.name, body: <ShareSheet data={data} /> };
    if (push) sheet.push(spec);
    else sheet.open(spec);
  };
  const add = (date: string) => sheet.open({ title: 'Add a session', detent: 'large', body: <SessionEditor date={date} session={null} /> });

  /** The long-press menu for a session: every gesture's action, then the rest; Delete last and red. */
  const menuItems = (date: string, s: Session, extra: { share?: ShareData | null; push?: boolean } = {}): ContextMenuItem[] => {
    const c = sessionCan(log, date, s);
    const items: ContextMenuItem[] = [];
    if (c.mark) {
      if (c.st === 'done') items.push({ label: 'Not done', icon: <Undo2 size={18} />, onSelect: () => clear(s) });
      else items.push({ label: 'Done', icon: <Check size={18} />, onSelect: () => done(s) });
      if (c.st === 'floor') items.push({ label: 'Clear floor', icon: <Undo2 size={18} />, onSelect: () => clear(s) });
      else items.push({ label: 'Floor', icon: <span className="cm-floor" />, onSelect: () => floor(s) });
    }
    if (c.skip || s.mark === 'skip' || s.mark === 'sick') items.push({ label: s.mark === 'skip' || s.mark === 'sick' ? 'Put it back' : 'Skip', icon: <SkipForward size={18} />, onSelect: () => skip(s) });
    if (c.sick) items.push({ label: 'Not feeling 100%', icon: <HeartPulse size={18} />, onSelect: () => sick(date, s) });
    items.push({ label: 'Move', icon: <ArrowRightLeft size={18} />, onSelect: () => move(date, s, extra.push) });
    items.push({ label: 'Edit', icon: <Pencil size={18} />, onSelect: () => edit(date, s, extra.push) });
    if (extra.share && extra.share.miles > 0) items.push({ label: 'Share', icon: <Share2 size={18} />, onSelect: () => share(extra.share!, extra.push) });
    items.push({ label: 'Delete', icon: <Trash2 size={18} />, destructive: true, onSelect: () => del(s) });
    return items;
  };

  return { done, floor, clear, skip, sick, notFeeling, del, move, edit, share, add, menuItems };
};

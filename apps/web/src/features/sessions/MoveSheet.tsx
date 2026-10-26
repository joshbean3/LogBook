import { fmtDate, label, mondayOf, shiftDays, type Session } from '@logbook/shared';
import { haptics } from '@/lib/haptics';
import { Pressable } from '@/ui/Pressable';
import { useSheet, type SheetApi } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { useLog } from '../log/useLog';
import { DayPicker } from './DayPicker';
import { movesOnly, useMoveTo } from '../plan/moveRule';

const nameOf = (s: Session) => (s.kind === 'rest' ? 'Rest' : label(s));

/** The Move sheet's title: just "Move"; the session rides in the eyebrow. Kept for callers that import it. */
export const MoveTitle = ({ session }: { session: Session }) => <span>Move {nameOf(session)}</span>;

const spec = (date: string, session: Session) => ({ eyebrow: nameOf(session), title: 'Move', body: <MovePanel date={date} session={session} /> });

/** Open Move on its own (a row's left swipe, a context menu). */
export const openMoveSheet = (sheet: SheetApi, date: string, session: Session) => sheet.open(spec(date, session));
/** Push Move inside an open session sheet, with a back chevron. */
export const pushMoveSheet = (sheet: SheetApi, date: string, session: Session) => sheet.push(spec(date, session));

/**
 * Toast words for a reshape picked in the Move sheet, with Undo. A pick is silent (spec §11.4: `drop` is a drag's drop into
 * a slot; a pick is a pick); a plan conflict, two hard days now touching, is the one `warning`.
 */
export const announceReshape = (toast: ReturnType<typeof useToast>, r: { conflict: string[] | null; said: string; undo: () => void }) => {
  if (r.conflict) {
    haptics.warning();
    toast('Two hard days in a row. Keep it?', { label: 'Undo', fn: r.undo });
  } else toast(r.said, { label: 'Undo', fn: r.undo });
};

/**
 * After a pick the row the sheet would give focus back to has moved (it is a new row on its new day): focus goes to the
 * moved session's row in the shown page once the sheet has let go of focus, not to `<body>` (code review 2 #8). When its
 * new day is not on the shown page (a move past Sunday, or off Today's day), focus goes to the shown pager, where the
 * arrow keys page to it (code review 3 #1).
 */
const refocusMoved = (id: string, to: string) => {
  const t0 = performance.now();
  const cur = '.tab[data-active] .pl-pane.is-on .dp-page[data-role="cur"]';
  const tick = () => {
    if (performance.now() - t0 > 1500) return;
    const a = document.activeElement;
    // still in the closing sheet: wait; somewhere else on purpose: leave it
    if (a && a !== document.body && a.isConnected) {
      if (a.closest('.sheet, [role="dialog"]')) return void requestAnimationFrame(tick);
      return;
    }
    const row = document.querySelector<HTMLElement>(`${cur} [data-session-id="${CSS.escape(id)}"] .pl-line`);
    if (row) return void row.focus({ preventScroll: true });
    // its day is on the shown page: the row comes with the write's render
    if (document.querySelector(`${cur} [data-plan-day="${to}"]`) && performance.now() - t0 < 600) return void requestAnimationFrame(tick);
    const pager = document.querySelector<HTMLElement>('.tab[data-active] .pl-pane.is-on .dp') ?? document.querySelector<HTMLElement>('.tab[data-active] .dp[aria-roledescription="pager"]');
    pager?.focus({ preventScroll: true });
  };
  requestAnimationFrame(tick);
};

/**
 * Move one session, usually a day or two: Tomorrow and the next free day as one-tap chips (Pressables), then the week as a
 * strip of days (`DayPicker`: a swipe pages it 1:1, the chevrons slide). A day that already has a session swaps with it, as
 * a drop does in Plan, except from a day already past onto today or later: it moves and that day keeps its own (the one
 * rule, `moveRule.ts`: code review 2 #3). A pick closes the sheet and the toast carries Undo.
 */
export const MovePanel = ({ date, session }: { date: string; session: Session }) => {
  const log = useLog([date.slice(0, 7), shiftDays(date, 21).slice(0, 7)]);
  const sheet = useSheet();
  const toast = useToast();
  const moveTo = useMoveTo();
  const t = log.today;
  const go = (to: string) => {
    if (to === date) return;
    const r = moveTo(log, session, date, to);
    const hadFocus = !!document.activeElement && document.activeElement !== document.body;
    sheet.close();
    if (r) announceReshape(toast, r);
    if (r && hadFocus) refocusMoved(session.id, to);
  };
  // the quick picks say days as the owner reads them: Today and Tomorrow are today's, not the session's (review-feel-1 #4)
  const tomorrow = shiftDays(t, 1);
  const freeOn = (d: string) => d >= t && !log.snap.sessionsOn(d).some((x) => x.kind !== 'rest' && x.id !== session.id);
  // the nearest free day to where the session is, either side (never before today); after it on a tie
  let free: string | null = null;
  for (let i = 1; i <= 21 && !free; i++) free = [shiftDays(date, i), shiftDays(date, -i)].find((d) => d !== tomorrow && d !== t && freeOn(d)) ?? null;
  const sameWeek = (d: string) => mondayOf(d) === mondayOf(date);
  const chips: Array<[string, string]> = [];
  if (date !== t && t > shiftDays(date, -30)) chips.push(['Today', t]);
  if (tomorrow !== date) chips.push(['Tomorrow', tomorrow]);
  if (free) chips.push([`${free > date ? 'Next' : 'Nearest'} free day · ${sameWeek(free) ? fmtDate('dow', free) : `${fmtDate('dow', free)}, ${fmtDate('md', free)}`}`, free]);
  return (
    <div className="mv2">
      <p className="t-sub ink2">
        {nameOf(session)} is on {date === t ? 'today' : fmtDate('long', date)}. {movesOnly(date, t, t) ? 'An earlier day with something on it swaps; from today on, it joins the day.' : 'A day with something on it swaps.'}
      </p>
      <div className="mv2-chips" role="group" aria-label="Quick picks">
        {chips.map(([k, d]) => (
          <Pressable key={k} className="pl-chip" onPress={() => go(d)}>
            {k}
          </Pressable>
        ))}
      </div>
      <DayPicker value={date} origin={date} skipId={session.id} onPick={go} labelFor={(d, what) => (d === date ? `${fmtDate('long', d)}, where it is` : `${fmtDate('long', d)}, ${what}. Move here`)} />
    </div>
  );
};

/** Kept for compatibility: the old name of the Move body. */
export const MoveSheet = MovePanel;

import { fmtDate, label, shiftDays, type Session } from '@logbook/shared';
import { haptics } from '@/lib/haptics';
import { Pressable } from '@/ui/Pressable';
import { useSheet, type SheetApi } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { useLog } from '../log/useLog';
import { DayPicker } from './DayPicker';
import { useReshape } from './reshape';

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
 * Move one session, usually a day or two: Tomorrow and the next free day as one-tap chips (Pressables), then the week as a
 * strip of days (`DayPicker`: a swipe pages it 1:1, the chevrons slide). A day that already has a session swaps with it, as
 * a drop does in Plan. A pick closes the sheet and the toast carries Undo.
 */
export const MovePanel = ({ date, session }: { date: string; session: Session }) => {
  const log = useLog([date.slice(0, 7), shiftDays(date, 21).slice(0, 7)]);
  const sheet = useSheet();
  const toast = useToast();
  const { reshape } = useReshape();
  const t = log.today;
  const go = (to: string) => {
    if (to === date) return;
    const r = reshape(log, session, date, to);
    sheet.close();
    if (r) announceReshape(toast, r);
  };
  const tomorrow = shiftDays(date, 1);
  let free: string | null = null;
  for (let i = 1; i <= 21 && !free; i++) {
    const d = shiftDays(date, i);
    if (d < t) continue;
    if (!log.snap.sessionsOn(d).some((x) => x.kind !== 'rest' && x.id !== session.id)) free = d;
  }
  const chips: Array<[string, string]> = [];
  if (date !== t && t > shiftDays(date, -30)) chips.push(['Today', t]);
  if (tomorrow !== t) chips.push(['Tomorrow', tomorrow]);
  if (free && free !== tomorrow && free !== t) chips.push([`Next free day · ${fmtDate('dow', free)}`, free]);
  return (
    <div className="mv2">
      <p className="t-sub ink2">
        {nameOf(session)} is on {date === t ? 'today' : fmtDate('long', date)}. A day with something on it swaps.
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

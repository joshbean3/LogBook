import { monthOf, monthsBetween, shiftDays, type Consent, type PlanDraft, type Session } from '@logbook/shared';

/*
 * The AI plan preview's rules, apart from the screen so the tests can read them: which months the preview needs before
 * its buttons mean anything, what a Replace would take away (counted as `POST /plans/apply` does), and what each button
 * says and sends.
 */

type Span = Pick<PlanDraft, 'start' | 'end'>;

/** Every month the draft's dates touch. The preview loads all of them before it enables a button. */
export const draftMonths = (draft: Span): string[] => monthsBetween(draft.start, draft.end);

/** The calendar as the preview reads it: a month is loaded or it is not, and a day has its sessions. */
export interface CalendarLike {
  loaded(month: string): boolean;
  sessionsOn(date: string): Array<Pick<Session, 'id' | 'mark'>>;
}

/**
 * The sessions a Replace clears, by the server's rule (`POST /plans/apply`, mode `replace`): every session in the draft's
 * dates that nobody has marked. Anything marked (done, floor, skipped, sick) is history and stays. Null while a month of
 * the draft is not loaded yet: an unknown count is never shown as "none".
 */
export const replacedBy = (cal: CalendarLike, draft: Span): string[] | null => {
  if (!draftMonths(draft).every((m) => cal.loaded(m))) return null;
  const ids: string[] = [];
  for (let d = draft.start; d <= draft.end; d = shiftDays(d, 1)) {
    if (!cal.loaded(monthOf(d))) return null;
    for (const s of cal.sessionsOn(d)) if (s.mark == null) ids.push(s.id);
  }
  return ids;
};

export interface ApplyChoice {
  /** The one pinned button: what it says and the mode it sends. Null while the calendar is still being read. */
  primary: { label: string; mode: 'replace' | 'add' } | null;
  /** Shown beside it only when a Replace is on offer and the draft is not a revision: keep what is there. */
  keep: boolean;
}

/**
 * The preview's buttons. With sessions in range the primary button says "Replace N sessions" and replaces; with none it
 * says "Add to my plan" and adds (so the label and the request never disagree). A revision rewrites the range, so it
 * offers no "keep them".
 */
export const applyChoice = (replaced: string[] | null, revise: boolean): ApplyChoice => {
  if (replaced == null) return { primary: null, keep: false };
  const n = replaced.length;
  if (!n) return { primary: { label: 'Add to my plan', mode: 'add' }, keep: false };
  return { primary: { label: `Replace ${n} ${n === 1 ? 'session' : 'sessions'}`, mode: 'replace' }, keep: !revise };
};

/**
 * May a draft be asked for? Only after the account has answered the permission step (`consent.at` is set). An account
 * that never answered, or whose answer is not known on this device yet, sends nothing.
 */
export const mayDraft = (consent: Pick<Consent, 'at'> | null | undefined): boolean => !!consent && consent.at != null;

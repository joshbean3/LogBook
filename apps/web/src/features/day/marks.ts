import { label, type Session, type SessionMark } from '@logbook/shared';

/**
 * The error a refused mark raises (§8: errors are the one other thing a toast is for; code review 3 #3, day review 3 #6). One
 * toast at a time, so it takes the place of a Skip's `Undo` toast, which would otherwise contradict the card.
 */
export const refusedMark = (s: Session, m: SessionMark | null) => (m === 'skip' ? `Couldn’t skip ${label(s)}.` : m === 'done' || m === 'floor' ? `Couldn’t mark ${label(s)} done.` : `Couldn’t change ${label(s)}.`);

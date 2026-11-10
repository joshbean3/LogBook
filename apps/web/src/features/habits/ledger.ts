/**
 * Habit checks on their way to the server, per habit and day. A check is drawn before it is saved (the tile lights on the
 * tap), so a save the server refuses has to be taken back: to what was saved before, not to whatever is on screen.
 *
 * `begin` notes the saved state when the first write for a key goes out. `settle` records each answer: a write that was
 * saved becomes the new saved state, a refused one marks the key. When the last write for the key is back and any was
 * refused, `settle` returns the state to put back; otherwise null (nothing to undo, or more answers still to come).
 */
export const createLedger = () => {
  const open = new Map<string, { saved: boolean; pending: number; refused: boolean }>();
  return {
    begin(key: string, saved: boolean) {
      const f = open.get(key) ?? { saved, pending: 0, refused: false };
      f.pending++;
      open.set(key, f);
    },
    settle(key: string, ok: boolean, value: boolean): boolean | null {
      const f = open.get(key);
      if (!f) return null;
      f.pending--;
      if (ok) f.saved = value;
      else f.refused = true;
      if (f.pending > 0) return null;
      open.delete(key);
      return f.refused ? f.saved : null;
    },
  };
};

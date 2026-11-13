import { addChallenge, challengeState, challengeTitle, easierChallenge, skipChallenge, type Slot } from '@logbook/shared';
import { useEffect, useRef, useState } from 'react';
import { useBootstrap } from '@/api/queries';
import { useReviewAccess } from '@/features/goals/refine';
import { KPin } from '@/features/goals/Kit';
import { haptics } from '@/lib/haptics';
import { Orb } from '@/ui/Orb';
import { Button } from '@/ui/primitives';
import { useSheet, type SheetApi } from '@/ui/Sheet';
import { updateOrbs, useChallenge } from '../store';
import { actionsFor, ASK_FAILED, ASK_WORDS, ASKING, doneWords, eyebrowOf, PICKED_CAPTION, progressWords, sheetLine, whatCounts } from './model';
import { askPick, mayAskFor } from './pick';
import { useBoard } from './useBoard';
import './challenge.css';

/** The thinking Orb is on screen at least this long, so a quick answer does not flash it. */
const ASK_MIN_MS = 700;

/** The sheet's title: the engine's own title for the challenge as it stands (it changes with "Easier" and with a pick). */
const Title = ({ slotKey }: { slotKey: string }) => {
  const c = useChallenge(slotKey);
  return <>{c ? challengeTitle(c) : ''}</>;
};

/**
 * The challenge's sheet, small: the eyebrow ("Today's challenge"), the title, one plain line saying what counts and what
 * it pays, then one Sky button ("Add to today") and the quiet actions: "Skip", "Easier" where the challenge has a size,
 * and "Ask the assistant to pick" when this account may ask. Once added it shows progress and a quiet "Drop it". Skipping
 * and dropping cost nothing and close the sheet with nothing said.
 *
 * Asking shows the assistant's Orb thinking with a status line, then the answer in place: the title becomes the item the
 * assistant chose, under "Picked by the assistant" and its reason. A failure of any kind leaves the challenge as it was,
 * with one quiet line.
 */
const ChallengeSheet = ({ slotKey }: { slotKey: string }) => {
  const sheet = useSheet();
  const board = useBoard();
  const boot = useBootstrap();
  const access = useReviewAccess();
  const [asking, setAsking] = useState<'idle' | 'asking' | 'failed'>('idle');
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  const live = board?.live[slotKey];
  const latest = useRef(board);
  latest.current = board;
  // it is no longer on offer or running (it lapsed, its day was paused, it was settled elsewhere): nothing to say
  const gone = !!board && !live?.view;
  useEffect(() => {
    if (gone) sheet.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gone]);
  if (!board || !live || !live.view) return <div className="k-sheet ch-sheet" aria-busy={!board} />;

  const { slot, challenge: c, facts, view } = live;
  const actions = actionsFor(c, slot, facts, board.today, { mayAsk: mayAskFor(boot.data?.features, access), menu: view.shown === 'offered' ? board.menuOf(slotKey) : [] });
  const progress = challengeState(c, slot, facts).progress;

  const add = () => {
    haptics.toggle();
    updateOrbs((s) => addChallenge(s, slot, facts, new Date()));
    sheet.close();
  };
  const letGo = () => {
    updateOrbs((s) => skipChallenge(s, slot.key, new Date()));
    sheet.close();
  };
  const ask = async () => {
    setAsking('asking');
    const [ok] = await Promise.all([askPick(slotKey, () => latest.current?.menuOf(slotKey) ?? []), new Promise((r) => setTimeout(r, ASK_MIN_MS))]);
    if (alive.current) setAsking(ok ? 'idle' : 'failed');
  };

  return (
    <div className="k-sheet ch-sheet" data-state={view.shown}>
      <section className="k-card ch-card">
        {view.caption ? <span className="caps">{PICKED_CAPTION}</span> : null}
        {view.reason ? <p className="ch-reason">{view.reason}</p> : null}
        {view.shown === 'offered' ? (
          <p className={view.reason ? 'ch-note' : 'ch-line'}>{sheetLine(slot.kind, c, facts)}</p>
        ) : (
          <>
            <p className="ch-line is-strong">{view.shown === 'done' ? doneWords(live.paid || challengeState(c, slot, facts).pay) : progressWords(slot.kind, c, progress)}</p>
            <p className="ch-note">{whatCounts(c, facts)}</p>
          </>
        )}
      </section>
      {asking === 'asking' ? (
        <p className="ch-status" role="status">
          <Orb size={18} state="think" />
          <span>{ASKING}</span>
        </p>
      ) : asking === 'failed' ? (
        <p className="ch-status" role="status">
          {ASK_FAILED}
        </p>
      ) : null}
      {actions.add || actions.skip || actions.drop ? (
        <KPin>
          {actions.add ? (
            <Button variant="primary" block onClick={add}>
              {actions.add}
            </Button>
          ) : null}
          {asking === 'asking' ? null : (
            <div className="ch-quiet">
              {actions.skip ? (
                <Button variant="quiet" onClick={letGo}>
                  Skip
                </Button>
              ) : null}
              {actions.easier ? (
                <Button variant="quiet" onClick={() => updateOrbs((s) => easierChallenge(s, slot.key))}>
                  Easier
                </Button>
              ) : null}
              {actions.ask && asking === 'idle' ? (
                <Button variant="quiet" onClick={() => void ask()}>
                  {ASK_WORDS}
                </Button>
              ) : null}
              {actions.drop ? (
                <Button variant="quiet" onClick={letGo}>
                  Drop it
                </Button>
              ) : null}
            </div>
          )}
        </KPin>
      ) : null}
    </div>
  );
};

/** Open the sheet for a slot's challenge. */
export const openChallenge = (sheet: SheetApi, slotKey: string, kind: Slot['kind']) => sheet.open({ eyebrow: eyebrowOf(kind), title: <Title slotKey={slotKey} />, body: <ChallengeSheet slotKey={slotKey} /> });

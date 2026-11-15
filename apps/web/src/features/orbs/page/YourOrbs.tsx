import type * as React from 'react';
import { Pressable } from '@/ui/Pressable';
import { OrbGem } from '../gems';
import { heldSaid, type HeldCell } from './model';
import './orbs.css';

/**
 * "Your Orbs": the five rungs in a row, the one earned least often last. Each is its Orb at 32 pt over its name and how
 * many are held. A rung never held is a dashed ring over its name, with no number (never a zero): an empty place on
 * the ladder. The whole row is one button to How Orbs work, which opens at the ladder; VoiceOver hears it in one breath.
 */
export const YourOrbs = ({ cells, onOpen }: { cells: readonly HeldCell[]; onOpen: () => void }): React.JSX.Element => (
  <Pressable className="card orp-held" press="scale" label={heldSaid(cells)} onPress={onOpen}>
    {cells.map((c) => (
      <span key={c.rung} className={`orp-held-cell${c.count ? '' : ' is-empty'}`} aria-hidden="true">
        <span className="orp-held-orb">{c.count ? <OrbGem gem={{ rung: c.rung }} size={32} /> : <span className="orp-held-ring" />}</span>
        <span className="orp-held-name">{c.name}</span>
        {c.count ? <span className="orp-held-n">{c.count}</span> : null}
      </span>
    ))}
  </Pressable>
);

import { withPick, type Offer } from '@logbook/shared';
import { api, isOffline } from '@/api/client';
import { getOrbs, updateOrbs } from '../store';
import { acceptPick, parsePick } from './model';

/**
 * "Ask the assistant to pick" (`POST /challenges/pick`). The phone sends the slot's key and nothing else: no facts, no
 * numbers. The server builds its own menu from the account's records and answers `{ item, target, floor?, why?, by }`.
 *
 * The answer is applied with the engine's `withPick`, against this phone's own menu (`acceptPick`): an item that is not
 * on it, a reason the shared check refuses, or the rule's own pick from the server all leave the challenge as it was.
 * Never throws and never toasts: the sheet shows one quiet line when nothing came of it.
 *
 * An answer is applied only to the sheet that asked for it: one that arrives after that sheet has closed (`live`), or
 * after a newer ask for the same slot went out, changes nothing.
 */

/** Does the server have the route and an assistant to ask? Only a bootstrap that carries the key says so. */
export const pickCapable = (features: unknown): boolean => !!features && typeof features === 'object' && (features as { challengePick?: unknown }).challengePick === true;

/** May "Ask the assistant to pick" be offered? The server has the route, the assistant is allowed, and its training switch is on. */
export const mayAskFor = (features: unknown, access: 'on' | 'off' | 'none' | 'unknown'): boolean => pickCapable(features) && access === 'on';

type Send = (slot: string) => Promise<unknown>;
const post: Send = (slot) => api<unknown>('/challenges/pick', { method: 'POST', json: { slot } });

/** The newest ask per slot: an older answer still on its way is not applied over it. */
const asks = new Map<string, number>();

/**
 * Ask, check, apply. True when the challenge is now the assistant's pick. `menu` is read after the answer comes, so it is
 * this phone's menu as it stands then.
 */
export const askPick = async (key: string, menu: () => readonly Offer[], opts: { send?: Send; offline?: () => boolean; live?: () => boolean } = {}): Promise<boolean> => {
  if ((opts.offline ?? isOffline)()) return false;
  const ticket = (asks.get(key) ?? 0) + 1;
  asks.set(key, ticket);
  let raw: unknown;
  try {
    raw = await (opts.send ?? post)(key);
  } catch {
    return false;
  }
  if (asks.get(key) !== ticket || (opts.live && !opts.live())) return false;
  const answer = parsePick(raw);
  const offer = acceptPick(answer, menu());
  const why = answer?.why?.trim();
  if (!offer || !why) return false;
  updateOrbs((s) => withPick(s, key, [offer], offer.item, why));
  const now = getOrbs()?.challenges[key];
  return !!now && now.by === 'assistant' && now.item === offer.item && now.why === why;
};

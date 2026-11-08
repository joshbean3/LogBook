import type { IntroKey } from '@logbook/shared';

export type Intros = { seen: IntroKey[] | null };

/**
 * Should a feature's intro show now? Only for an enrolled account (`seen` is a list, not null), when the key is not seen on
 * the account or on this device, and the moment is right (`ready`: its tab at its root, nothing over it).
 */
export const introDue = (key: IntroKey, intros: Intros | undefined, here: boolean, ready: boolean): boolean => !!ready && !!intros && intros.seen !== null && !intros.seen.includes(key) && !here;

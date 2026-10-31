import type { Aim } from '@logbook/shared';

/**
 * @deprecated The full-screen celebration is gone (docs/system.md §5: completion is the Mark's one pop). `app/Shell.tsx` still
 * mounts the layer and `features/dayplan` still asks for the moment, so both stay as no-ops until those callers drop them.
 */
export const useCelebrate = () => (_goal: Aim) => undefined;

/** @deprecated Renders nothing; see `useCelebrate`. */
export const CelebrateLayer = (): null => null;

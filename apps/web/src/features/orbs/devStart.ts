import { isISODate, RULES, type ISODate } from '@logbook/shared';

/**
 * The day Orbs start counting from. In a release build it is the build constant `RULES.startsOn` and nothing else: the
 * branch below is not in the bundle. In a development build (`pnpm dev`, the tests) a date under `logbook.dev.orbsStart`
 * stands in, so the feature can be tried before its start date:
 *
 *   localStorage.setItem('logbook.dev.orbsStart', '2026-11-01'); location.reload()
 *
 * The server never honors it: days before `RULES.startsOn` are dropped by `PUT /me/rewards`.
 */
export const DEV_START_KEY = 'logbook.dev.orbsStart';
export const orbsStart = (): ISODate => {
  if (import.meta.env.DEV) {
    try {
      const v = localStorage.getItem(DEV_START_KEY);
      if (v && isISODate(v)) return v;
    } catch {
      /* no storage: the constant stands */
    }
  }
  return RULES.startsOn;
};

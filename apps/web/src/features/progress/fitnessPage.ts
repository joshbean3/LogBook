/**
 * What the lower half of Fitness shows (Progress, then Trends), apart from the screen: which trend tiles, whether the
 * health group, whether the section is there at all. Pure, so the page and its tests agree.
 */
import type { HealthLink } from './healthDays';
import type { MetricId } from './metrics';

/** Fitness's trend tiles, in order. Habits' consistency is not training: it lives on Today (Habits, History). */
export const TREND_IDS: readonly MetricId[] = ['mileage', 'pace', 'lifts'];
/** Pace needs runs with a time, and only a synced source has those: with none offered, the tile is never shown. */
export const UNTIMED_IDS: readonly MetricId[] = ['mileage', 'lifts'];
/** The body's numbers from Apple Health, in the order they are read: the night, then the two heart numbers. */
export const BODY_IDS: readonly MetricId[] = ['sleep', 'hrv', 'rhr'];

export const trendIds = (timed: boolean): readonly MetricId[] => (timed ? TREND_IDS : UNTIMED_IDS);

/**
 * The health group shows once Apple Health has anything to do with this account: a phone is connected, a sync is
 * running, or the server holds readings. Before that it is not on Fitness at all (it is connected in Settings).
 */
export const healthShown = (built: boolean, link: Pick<HealthLink, 'connected' | 'syncing'>, anyReading: boolean): boolean => built && (link.connected || link.syncing || anyReading);

export interface TrendsShown {
  /** The tiles drawn, in order. */
  tiles: MetricId[];
  /** One section row in the tiles' place ("No trends yet", with the way to connect a source): only when that link exists. */
  empty: boolean;
  /** The body's numbers as one group under the tiles. */
  health: boolean;
  /** The section is drawn at all (its title included). */
  section: boolean;
}

/**
 * Trends on Fitness. A tile shows when its metric has something to show: nobody gets a "None yet" tile for a thing they
 * do not do. Pace is the one exception: while a synced source is on offer and not connected, it stays beside a mileage
 * tile, because its page is the way to connect. With no tile and nothing to connect, the section is only the health
 * group, and with none of the three it is not drawn: the Progress row above already says what will show.
 */
export const trendsShown = ({ ids, has, canConnect, health }: { ids: readonly MetricId[]; has: (id: MetricId) => boolean; canConnect: boolean; health: boolean }): TrendsShown => {
  const any = ids.some(has);
  const tiles = ids.filter((id) => has(id) || (id === 'pace' && canConnect && any));
  const empty = !tiles.length && canConnect;
  return { tiles, empty, health, section: tiles.length > 0 || empty || health };
};

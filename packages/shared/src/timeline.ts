/**
 * The day's timeline (docs/inspiration.md §6, Today 6): what was done, in the order it happened. `at` is the moment it was
 * recorded (an ISO timestamp), `time` a local start time (`HH:MM`) when the source gives one instead.
 */
export type TimelineKind = 'habit' | 'run' | 'lift' | 'activity' | 'learned' | 'journal';
export interface TimelineItem {
  id: string;
  kind: TimelineKind;
  title: string;
  sub: string | null;
  at: string | null;
  time: string | null;
}
export interface DayTimeline {
  date: string;
  items: TimelineItem[];
}

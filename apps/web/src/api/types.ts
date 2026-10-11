import type { CoachRead, Habit, HabitCheck, HrZone, JournalEntry, LiftSet, MorningDayOverride, MorningSettings, PlanBlock, Quote, Session, StravaStatus, Activity } from '@logbook/shared';

export interface Bootstrap {
  user: { id: string; email: string };
  habits: Habit[];
  blocks: PlanBlock[];
  morningSettings: MorningSettings;
  zones: HrZone[] | null;
  strava: StravaStatus;
  features: { claude: boolean; strava: boolean };
  serverTime: string;
}

export interface MonthBundle {
  month: string;
  sessions: Session[];
  checks: HabitCheck[];
  lifts: LiftSet[];
  activities: Activity[];
  morningDays: Record<string, MorningDayOverride>;
  journal: JournalEntry[];
  coach: CoachRead[];
}

export interface Daily {
  date: string;
  memory: JournalEntry | null;
  quote: Quote | null;
  pastCount: number;
}

export interface QuotePage {
  total: number;
  quotes: Quote[];
  themes: readonly string[];
}

export interface AuthStatus {
  hasAccount: boolean;
  setupOpen: boolean;
}

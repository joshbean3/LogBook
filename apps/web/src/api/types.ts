import type { CoachRead, Habit, HabitCheck, HrZone, JournalEntry, LiftSet, MorningDayOverride, MorningSettings, PlanBlock, ProviderConnection, Quote, SavedTrainingProfile, Session, StravaStatus, Activity } from '@logbook/shared';

export interface Bootstrap {
  /** `onboardedAt` null = a new account that has not been through /welcome yet (absent in caches from before it existed). */
  /** `trainingProfile`: the training answers kept on the account (null before any; absent in caches from before it existed). */
  user: {
    id: string;
    email: string;
    onboardedAt?: string | null;
    trainingProfile?: SavedTrainingProfile | null;
    /** Contract 6: the account's name (null or absent before one is given). */
    name?: string | null;
    /** The IANA zone the device last reported (absent in caches from before it existed). */
    timezone?: string | null;
    /** "About you, for the assistant". */
    profileNote?: string | null;
  };
  habits: Habit[];
  blocks: PlanBlock[];
  morningSettings: MorningSettings;
  zones: HrZone[] | null;
  /** Strava as it has always been read; `connections` carries every provider (absent in older caches). */
  strava: StravaStatus;
  connections?: ProviderConnection[];
  /** This account has at least one device subscribed to push. */
  pushEnabled?: boolean;
  features: { claude: boolean; strava: boolean; coros?: boolean; notifications?: boolean };
  /** The server also sends `serverTime`; `fetchBootstrap` drops it so the cached object only changes when the data does. */
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
  /** This visitor can create an account now (first account with setup on, or any with ALLOW_SIGNUP). */
  signupOpen?: boolean;
  /** This visitor has a live session (asked quietly before the bootstrap, so a signed-out open logs no 401). */
  signedIn?: boolean;
}

/** `POST /me/onboarding`: the first-run answers (docs/platform.md §5). Times in minutes after midnight. */
export interface OnboardingAnswers {
  goal: 'base' | '5k' | '10k' | 'half' | 'marathon';
  raceDate?: string | null;
  runDays: Array<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'>;
  longRunDay: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  weeklyMiles: number;
  wake: number;
  leave: number;
  pace?: number | null;
  habits: string[];
  start?: 'monday' | 'tomorrow';
  today?: string;
  /** The morning step's chips as minutes per routine block (B9). Sent for the record; the client also writes it to the morning settings. */
  routine?: { shower: number; ready: number; smoothie: number; prep: number };
}
export interface OnboardingResult {
  user: { id: string; email: string; onboardedAt: string | null; trainingProfile?: SavedTrainingProfile | null };
  morningSettings: MorningSettings;
  habits: Habit[];
  block: PlanBlock;
  months: string[];
  firstDay: string | null;
}
/** `POST /plans/template`: the block written, the months it touches, and how many future planned sessions it replaced. */
export interface TemplateApplied {
  block: PlanBlock;
  months: string[];
  removed: number;
  /** Contract 1 (replace): the planned sessions it soft-deleted, for Undo. */
  replacedIds?: string[];
  /** Contract 1 (replace): the overlapping block it ended at startDate − 1 (`prevEnd` = its old end), or soft-deleted. */
  endedBlock?: { id: string; prevEnd: string } | { id: string; deleted: true };
}

/** Contract 3: `GET /export`, everything the account holds; `POST /import` takes it back (idempotent by id). */
export interface ExportBundle {
  version: 2;
  exportedAt: string;
  user: { id: string; email: string; name?: string | null };
  settings?: unknown;
  habits?: unknown[];
  checks?: unknown[];
  sessions?: Array<{ id: string; deletedAt?: string | null }>;
  activities?: unknown[];
  lifts?: unknown[];
  todos?: unknown[];
  journal?: unknown[];
  quotes?: unknown;
  links?: unknown[];
  blocks?: unknown[];
  trainingProfile?: unknown;
}

import { env } from '../env.js';

/**
 * Which providers' data may be shown to a model.
 *
 * Strava's API Policy (effective 1 June 2026, §5.3, §5.5, §5.10) forbids using Strava Data "directly or indirectly, in
 * connection with the development, training, evaluation, or operation of any AI Application", names "ingestion into a
 * context window" and bars disclosure to AI providers even with the athlete's consent. So nothing that came from Strava,
 * and nothing derived from it, reaches the assistant, the coach's read or the plan builder. The athlete still sees every
 * Strava run in the app (§2.3 allows display to that user). `AI_EXCLUDED_PROVIDERS` extends the list; it can never be
 * emptied of strava.
 */
const EXCLUDED = new Set<string>(['strava', ...(env.AI_EXCLUDED_PROVIDERS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)]);

export const aiExcludedProviders = (): readonly string[] => [...EXCLUDED];
export const aiVisibleProvider = (provider: string | null | undefined): boolean => !EXCLUDED.has((provider ?? 'strava').toLowerCase());
/** Keep only the activities a model may read. */
export const aiVisible = <T extends { provider?: string | null }>(rows: readonly T[]): T[] => rows.filter((a) => aiVisibleProvider(a.provider));
/** One sentence for the system prompt, so the model does not guess at runs it cannot see. */
export const aiSourcesNote = (): string => `Runs recorded through ${aiExcludedProviders().map((p) => (p === 'strava' ? 'Strava' : p)).join(', ')} are not shown to you (their API terms); the owner sees them in the app. Treat a planned session with nothing logged as "not confirmed", never as missed, unless it is marked.`;

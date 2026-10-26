import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { assess, clock, fmtDate, isISODate, KINDS, METERS_PER_MILE, mi, mondayOf, parseISO, shiftDays, today, zClaudeGoalOutput, zClaudePlanOutput, type Activity, type GoalLevel, type HrZone, type PlanDraft, type Session, type SessionKind } from '@logbook/shared';
import { env } from '../env.js';
import { ApiError } from '../lib/util.js';

let client: Anthropic | null = null;
const anthropic = () => {
  if (!env.claudeConfigured) throw new ApiError(503, 'Claude isn’t configured on this server. Add ANTHROPIC_API_KEY.', 'claude_not_configured');
  return (client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 10 * 60_000, maxRetries: 2 }));
};

export interface AthleteContext {
  activities: Activity[];
  zones: HrZone[] | null;
  stravaOk: boolean;
}

/** Six weeks of running, typical paces and zones: what a coach would want to know before writing anything. */
export const recentContext = (ctx: AthleteContext): string => {
  const mon = mondayOf(today());
  const weeks: string[] = [];
  for (let i = 6; i >= 1; i--) {
    const m = shiftDays(mon, -7 * i);
    const ran = ctx.activities.filter((a) => a.kind === 'run' && a.date >= m && a.date < shiftDays(m, 7)).reduce((t, a) => t + a.miles, 0);
    weeks.push(`${fmtDate('md', m)}: ${mi(ran)} mi`);
  }
  const paces = ctx.activities
    .filter((a) => a.kind === 'run' && a.miles > 0.5)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 8)
    .map((a) => clock(a.movingSec / a.miles));
  return [
    ctx.stravaOk ? `Recent weekly running from Strava (Mon-start): ${weeks.join('; ')}.` : 'Recent running data is not available right now; do not assume the athlete is untrained.',
    paces.length ? `Typical recent run paces per mile: ${paces.join(', ')}.` : '',
    ctx.zones ? `Heart-rate zones (bpm): ${ctx.zones.map((z) => `Z${z.zone} ${z.min}${z.max ? `-${z.max}` : '+'}`).join(', ')}.` : '',
    env.ATHLETE_CONTEXT ? `Athlete: ${env.ATHLETE_CONTEXT}` : '',
  ]
    .filter(Boolean)
    .join('\n');
};

const PLAN_RULES = `Rules:
- One object per session. A day may have two (a run and a lift). Leave out rest days unless the source names them.
- type: for runs one of Easy, Recovery, Long, Threshold, Tempo, Speed, Intervals, Hills, Fartlek, Race; for lifts one of Strength, Upper, Lower, Full body, Mobility; for cross one of Cross, Bike, Swim, Hyrox, Yoga, Walk, Heat.
- title: a short label as the athlete would write it, e.g. "Easy 5", "6 × 800m", "Long 12", "Upper body".
- details: the workout itself (warm-up, reps, paces, cues, exercises) in under 300 characters, or "" if there is none.
- miles in miles (convert km × 0.6214, round to 0.1); minutes for time-based sessions; null when not given.
- Dates are real calendar dates. When the source counts weeks instead of dates, Week 1 is the Monday-to-Sunday week that contains the start date given. Put each session on the weekday the source names; if the source gives no weekdays, Day 1 is the start date. Leave out any session that would land before the start date.
- notes: up to 5 short strings for anything the athlete should check: terms you had to interpret (e.g. an undefined pace like "HMP"), sessions you could not place, or assumptions you made. [] when there is nothing to flag.`;

export interface DraftInput {
  mode: 'file' | 'text' | 'describe' | 'revise';
  text?: string;
  instructions?: string;
  start: string;
  end?: string;
  existing?: Array<Pick<Session, 'date' | 'kind' | 'type' | 'title' | 'details' | 'miles' | 'minutes'>>;
  file?: { data: Buffer; mediaType: string } | null;
  ctx: AthleteContext;
}

const cleanDraft = (out: unknown, start: string, end: string | undefined): PlanDraft => {
  const parsed = zClaudePlanOutput.safeParse(out);
  if (!parsed.success) throw new ApiError(502, 'Claude’s answer didn’t come back as a usable plan. Try again, or trim the source to the plan itself.', 'invalid_plan');
  const sessions = parsed.data.sessions
    .filter((s) => isISODate(s.date))
    .map((s) => ({
      date: s.date,
      kind: (KINDS.includes(s.kind as SessionKind) ? s.kind : 'run') as SessionKind,
      type: s.type.slice(0, 30) || null,
      title: s.title.slice(0, 60) || null,
      details: s.details.slice(0, 600) || null,
      miles: Number.isFinite(Number(s.miles)) && Number(s.miles) > 0 ? Math.round(Number(s.miles) * 10) / 10 : null,
      minutes: Number.isFinite(Number(s.minutes)) && Number(s.minutes) > 0 ? Math.round(Number(s.minutes)) : null,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (!sessions.length) throw new ApiError(422, 'Claude found no sessions in that source.', 'empty_plan');
  return {
    name: parsed.data.name.slice(0, 80) || 'Training plan',
    summary: parsed.data.summary.slice(0, 300),
    notes: parsed.data.notes.filter((n) => n.trim()).slice(0, 5).map((n) => n.slice(0, 220)),
    start: sessions[0]!.date < start ? sessions[0]!.date : start,
    end: end && end > sessions[sessions.length - 1]!.date ? end : sessions[sessions.length - 1]!.date,
    sessions,
  };
};

/** Turn a PDF, image, pasted text, a description or a revision request into dated sessions. */
export const draftPlan = async (input: DraftInput): Promise<PlanDraft> => {
  const c = anthropic();
  const t = today();
  const parts: string[] = [
    'You are a running and strength coach turning a training plan into calendar entries for an app.',
    `Today is ${fmtDate('long', t)}, ${t.slice(0, 4)} (${t}).`,
    '',
    'ABOUT THE ATHLETE',
    recentContext(input.ctx),
    '',
  ];
  const instr = (input.instructions ?? '').trim();
  if (input.mode === 'revise') {
    parts.push(
      `TASK: Rewrite the athlete’s planned sessions from ${input.start} to ${input.end} following the instruction. Return the complete new set of sessions for that whole date range (sessions you leave out will be deleted). Keep sessions the instruction does not touch exactly as they are.`,
      '',
      `INSTRUCTION: ${instr}`,
      '',
      'CURRENT SESSIONS (JSON):',
      JSON.stringify(input.existing ?? []),
    );
  } else if (input.mode === 'describe') {
    parts.push(`TASK: Design a training plan from the athlete’s request below. Start on ${input.start}${input.end ? ` and finish by ${input.end}` : ''}. Use sound progression (no more than about 10% weekly mileage growth, a down week every 3-4 weeks), keep weekday sessions short, and include lifting unless told otherwise.`, '', `REQUEST: ${instr}`);
  } else {
    parts.push(`TASK: Convert the plan below into dated sessions. Start date: ${input.start}.${instr ? ` Extra instructions from the athlete: ${instr}` : ''} Follow the source faithfully; do not invent sessions it does not contain.`, '');
    parts.push(input.file ? 'The plan is in the attached document.' : `PLAN SOURCE:\n<<<\n${(input.text ?? '').slice(0, 150000)}\n>>>`);
  }
  parts.push('', PLAN_RULES);

  const content: Anthropic.ContentBlockParam[] = [];
  if (input.file) {
    const mt = input.file.mediaType;
    if (mt === 'application/pdf') content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: input.file.data.toString('base64') } });
    else if (mt === 'image/jpeg' || mt === 'image/png' || mt === 'image/webp' || mt === 'image/gif') content.push({ type: 'image', source: { type: 'base64', media_type: mt, data: input.file.data.toString('base64') } });
    else throw new ApiError(422, 'Upload a PDF, JPG, PNG or WebP.', 'bad_file');
  }
  content.push({ type: 'text', text: parts.join('\n') });

  const stream = c.messages.stream({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 32000,
    output_config: { effort: 'high', format: zodOutputFormat(zClaudePlanOutput) },
    messages: [{ role: 'user', content }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') throw new ApiError(422, 'Claude declined this request. Rephrase it and try again.', 'refused');
  if (msg.stop_reason === 'max_tokens') throw new ApiError(422, 'That plan is too long to convert in one go. Upload fewer weeks at a time.', 'too_long');
  const text = msg.content.find((b) => b.type === 'text')?.text ?? '';
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ApiError(502, 'Claude’s answer didn’t come back as a usable plan. Try again.', 'invalid_plan');
  }
  return cleanDraft(json, input.start, input.end);
};

/** Two or three sentences on one day's run against the plan. */
export const coachRead = async (date: string, sess: Session | null, runs: Activity[], ctx: AthleteContext): Promise<string> => {
  const c = anthropic();
  const a = assess(ctx.zones, sess, runs);
  const splits = a.laps.map((l, i) => `Mile ${i + 1}: ${clock(l[1] / (l[0] / METERS_PER_MILE))}/mi${l[2] != null ? `, ${l[2]} bpm` : ''}`).join('\n');
  const prompt = [
    'You are a running coach writing a short note on one run for the athlete himself.',
    recentContext(ctx),
    '',
    `DATE: ${fmtDate('long', date)} ${parseISO(date).getFullYear()}`,
    `PLANNED: ${sess ? [sess.type, sess.title, sess.miles ? `${sess.miles} mi` : null, sess.details].filter(Boolean).join(' · ') : 'Nothing planned'}`,
    `ACTUAL: ${mi(a.miles)} mi in ${clock(a.movingSec)}${a.pace ? ` (${a.pace}/mi)` : ''}${a.avgHr != null ? `, avg HR ${a.avgHr}, max ${a.maxHr}` : ''}${runs[0]?.cadence ? `, cadence ${runs[0].cadence} spm` : ''}`,
    splits ? `SPLITS:\n${splits}` : '',
    `AUTOMATIC CHECKS: ${a.lines.join(' ')}`,
    '',
    'Write 2-3 plain sentences, under 70 words: what the run did for him, the one thing to change, and what it means for his next session. Use the numbers. No greeting, no lists, no hype, no markdown.',
  ]
    .filter(Boolean)
    .join('\n');
  const msg = await c.messages.create({ model: env.ANTHROPIC_MODEL, max_tokens: 1200, output_config: { effort: 'low' }, messages: [{ role: 'user', content: prompt }] });
  if (msg.stop_reason === 'refusal') throw new ApiError(422, 'Claude declined to write this one.', 'refused');
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  if (!text) throw new ApiError(502, 'Claude sent back an empty note. Try again.', 'empty');
  return text.slice(0, 700);
};

const GOAL_SCOPE: Record<GoalLevel, string> = {
  year: 'a goal for the whole year',
  month: 'a goal for one month',
  week: 'a goal for one week (Monday to Sunday)',
  day: 'a goal for one day: something he can finish today',
};

/**
 * The goal review (Locke and Latham, "New Directions in Goal-Setting Theory", 2006): rewrite the owner's goal so it is
 * specific, measurable, hard but attainable, bound to the period's deadline, and his; a learning goal when the task is new
 * or complex. Keeps his intent and his voice; leaves a goal that already meets the rules alone.
 */
export const refineGoal = async (level: GoalLevel, period: string, end: string, text: string, t: string): Promise<{ text: string; why: string | null; changed: boolean }> => {
  const c = anthropic();
  const prompt = [
    'You review personal goals using the findings of Locke and Latham\'s goal-setting research (35 years of studies; "New Directions in Goal-Setting Theory", 2006).',
    'The findings to apply:',
    '- Specific, difficult goals lead to higher performance than vague goals or "do your best". Replace vague words ("more", "better", "try to", "work on") with a concrete target.',
    '- The goal must be measurable, so he can tell at the deadline whether he hit it: a number, a count, a finished thing, or a clear yes/no outcome.',
    '- Hard but attainable: raise a timid goal a notch, scale down one that cannot fit the period. Difficulty must stay realistic for the time available.',
    '- Bind it to its deadline: the period it is for.',
    '- When the task is new or complex for him, a learning goal (find, try or master N strategies or skills) beats a performance outcome; when the goal is distant, name the first proximal step.',
    '- Commitment comes from goals he owns: write in the first person, in his own words and voice, as a statement of what he will do, not a wish.',
    '',
    `TODAY: ${t}. This is ${GOAL_SCOPE[level]}, period ${period}, ending ${end}.`,
    `HIS GOAL: ${text}`,
    '',
    'Return:',
    '- goal: the rewritten goal, one sentence, at most 28 words, first person, no quotation marks, no emoji, no markdown. Keep his intent and any numbers he gave. If his goal already meets the rules, return it unchanged.',
    '- why: one short plain sentence (under 16 words) naming what you changed, e.g. "Added a number and the Friday deadline so you can tell if you hit it." Empty string if unchanged.',
    '- changed: true if you changed the meaning or the words beyond punctuation.',
  ].join('\n');
  const msg = await c.messages.create({ model: env.ANTHROPIC_MODEL, max_tokens: 1200, output_config: { effort: 'low', format: zodOutputFormat(zClaudeGoalOutput) }, messages: [{ role: 'user', content: prompt }] });
  if (msg.stop_reason === 'refusal') throw new ApiError(422, 'Claude declined to review this goal.', 'refused');
  const raw = msg.content.find((b) => b.type === 'text')?.text ?? '';
  let out: { goal: string; why: string; changed: boolean };
  try {
    out = zClaudeGoalOutput.parse(JSON.parse(raw));
  } catch {
    throw new ApiError(502, 'The review didn’t come back usable. Try again.', 'invalid_goal');
  }
  const goal = out.goal.trim().replace(/^["“]|["”]$/g, '').slice(0, 400);
  const changed = out.changed && !!goal && goal !== text.trim();
  return { text: changed ? goal : text.trim(), why: changed ? out.why.trim().slice(0, 300) || null : null, changed };
};

import { counts, fmtDate, mondayOf, monthsBetween, sessionStatus, shiftDays, type Aim, type PlanBlock } from '@logbook/shared';
import { ChevronDown, ChevronRight, Ellipsis, ListChecks, Plus, Target, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNav, useNavInternal } from '@/app/NavController';
import { ApiError } from '@/api/client';
import { useGoals, usePlanDelete } from '@/api/queries';
import { useConsent } from '@/lib/consent';
import { haptics } from '@/lib/haptics';
import { useContextMenu } from '@/ui/ContextMenu';
import { PageSection } from '@/ui/layout';
import { Orb } from '@/ui/Orb';
import { Row } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { dayRange } from '@/ui/charts/range';
import { stopAssistant } from '../assistant/api';
import { AssistantPane } from '../assistant/AssistantPane';
import { stopAsk } from '../assistant/conversation';
import { useAssistantGate } from '../assistant/Permission';
import { assistantStore } from '../assistant/store';
import { useLog } from '../log/useLog';
import { Arc, arcOf, openPlans, openTemplate, phasesFor, planName, stateOf } from './Blocks';
import { fromEndingBlock } from './builderModel';
import { shortName } from './context';
import { PHASE_WORDS } from './phases';
import { lengthWords, miles1, planFacts, sourceWords } from './planFacts';
import { planWeeks, weekOf } from './topWords';

/**
 * A plan's summary (layout plan 2.4, the owner's request: "the agent should appear there so you can describe in detail
 * what you want; the agent then works and updates the page"). One sheet at the large detent, nothing opened on top:
 *
 * 1. What the assistant reads from this plan: one inset group of its facts (no group title: the plan's name is the sheet's
 *    title right above, and a second serif header would stack on it).
 * 2. The outline: the weekly miles chart, then the weeks as rows, folded to this week and the next two.
 * 3. The assistant: a short heading with the Orb, then the conversation (AssistantPane, this plan's own chat) and its
 *    composer pinned to the sheet's foot. A request goes with this plan as context (`screen.plan`); the answer comes as a
 *    proposal in place, with Apply and Not now; Apply writes through the assistant's apply route, so the outline here and
 *    the Plan tab update at once, and Undo takes it back. The chat shows in History like any other.
 *
 * The plan's actions (New plan, All plans, Delete) are in the "More" menu at the top right. With the assistant off on the
 * server the summary ends after the outline; before the permission step is answered, that step stands in for the
 * conversation, under the summary.
 */
export const openPlanSummary = (sheet: ReturnType<typeof useSheet>, b: PlanBlock, all: PlanBlock[], today: string, fromList = false) =>
  (fromList ? sheet.push : sheet.open)({ eyebrow: stateOf(b, today), title: shortName(planName(b, all, today)), detent: 'large', action: <PlanMore b={b} fromList={fromList} />, body: <PlanSummary b={b} fromList={fromList} /> });

const LEVEL_WORD: Record<Aim['level'], string> = { year: 'Year goal', month: 'Month goal', week: 'Week goal', day: 'Today' };
/** The Goals tab's open goals that name this plan (its name, or its goal), at most three. */
const goalsNaming = (aims: Aim[] | undefined, b: PlanBlock, goal: string | null) => {
  const name = shortName(b.name).toLowerCase();
  const terms = [name.length >= 4 ? name : null, goal && goal !== 'Base build' ? goal.toLowerCase() : null].filter((t): t is string => !!t);
  if (!terms.length) return [];
  return (aims ?? []).filter((a) => a.status === 'open' && terms.some((t) => a.text.toLowerCase().includes(t))).slice(0, 3);
};

/** How many weeks the outline shows before its fold: this week and the next two. */
const FOLD_AT = 3;

const PlanSummary = ({ b, fromList }: { b: PlanBlock; fromList?: boolean }) => {
  const sheet = useSheet();
  const nav = useNav();
  const navInt = useNavInternal();
  // every month of the plan, so the chart and the weeks read all of it (and refresh when Apply changes it)
  const months = useMemo(() => monthsBetween(b.start, b.end).slice(0, 8), [b.start, b.end]);
  const log = useLog(months);
  const aims = useGoals().data;
  const { gate } = useAssistantGate();
  const consent = useConsent().data ?? log.boot?.consent;
  const t = log.today;
  const ai = log.features.claude;
  // this plan's chat: the newest one started here, else a new one (saved, and listed in History, once it has a turn)
  const [chatId] = useState(() => assistantStore.chatForPlan(b.id) ?? assistantStore.newChat(b.id));
  // backing out while it works stops it cleanly: the job is stopped and the chat says Stopped when opened again
  useEffect(
    () => () => {
      if (assistantStore.busyChat() === chatId) void stopAsk(stopAssistant);
    },
    [chatId],
  );
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const root = useRef<HTMLDivElement>(null);
  // Apply wrote the change: the outline above has already redrawn from it, and one tap takes the eye there
  const onApplied = () =>
    toast('Plan updated', {
      label: 'See it',
      fn: () => root.current?.querySelector('.pl-ps-outline')?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }),
    });

  const n = planWeeks(b);
  const f = planFacts(b, n, (d) => log.snap.sessionsOn(d), log.boot?.user.trainingProfile ?? null);
  const arc = arcOf(log, b);
  const phases = phasesFor(log, b, arc);
  const peak = Math.max(0, ...arc.map((w) => w.planned));
  const ready = months.every((m) => log.loaded(`${m}-01`));
  const now = mondayOf(t);
  const named = goalsNaming(aims, b, f.goal);
  const from = sourceWords(b);
  const prof = log.boot?.user.trainingProfile ?? null;

  // this week's sessions: done of due so far (it was "Kept so far" in the old tiles)
  let done = 0;
  let due = 0;
  for (let d = now; d <= shiftDays(now, 6) && d < t; d = shiftDays(d, 1))
    for (const s of log.snap.sessionsOn(d)) {
      if (s.kind === 'rest' || d < b.start || d > b.end) continue;
      const st = sessionStatus(log.snap, d, s);
      if (st === 'skipped') continue;
      due++;
      if (counts(st)) done++;
    }

  const toWeek = (mon: string) => {
    sheet.close();
    nav.go(mon === now ? '/plan' : `/plan/week/${mon}`);
  };
  const toPrivacy = () => {
    sheet.close();
    navInt.go('/settings/privacy');
  };

  // the weeks shown before the fold: from this week (an upcoming plan from its first, a finished one its last three)
  const at = Math.max(0, arc.findIndex((w) => w.mon === now));
  const anchor = now < b.start ? 0 : now > b.end ? Math.max(0, arc.length - FOLD_AT) : at;
  const shown = open || arc.length <= FOLD_AT + 1 ? arc : arc.slice(anchor, anchor + FOLD_AT);
  const hidden = arc.length - shown.length;

  const rows: Array<[string, string] | null> = [
    f.race ? ['Race day', `${fmtDate('dow', f.race.date)}, ${fmtDate('md', f.race.date)}`] : f.goal ? ['Goal', f.goal] : null,
    ['Dates', dayRange(b.start, b.end)],
    ['Length', lengthWords(f)],
    f.runs ? ['Runs a week', f.quality ? `${f.runs}, ${f.quality === 1 ? 'one hard' : `up to ${f.quality} hard`}` : f.runs] : null,
    f.long?.short ? ['Long run', f.long.miles ? `${f.long.short}, up to ${miles1(f.long.miles)} mi` : f.long.short] : null,
    f.peak ? ['Biggest week', `${miles1(f.peak)} mi`] : null,
    prof?.weeklyMiles ? ['Starting miles', `${miles1(prof.weeklyMiles)} mi a week`] : null,
  ];
  const facts = rows.filter((x): x is [string, string] => !!x);

  const lead = (
    <div className="pl-ps-body">
      <p className="pl-ps-lead">What the assistant reads from this plan</p>
      <div className="group pl-ps-facts" aria-busy={!ready || undefined}>
        {facts.map(([k, v]) => (
          <Row key={k} title={k} right={<span className="lrow-value">{v}</span>} />
        ))}
      </div>
      {from ? <p className="pl-ps-from">{from}</p> : null}
      {named.length ? (
        <div className="group pl-ps-aims">
          {named.map((a) => (
            <Row
              key={a.id}
              left={
                <span className="icon-tile" aria-hidden="true">
                  <Target size={18} />
                </span>
              }
              title={a.text}
              sub={LEVEL_WORD[a.level]}
            />
          ))}
        </div>
      ) : null}

      <PageSection size="sm" level={3} title="The outline" className="pl-ps-outline">
        <div className="card pl-ps-chart">
          <p className="pl-ps-peak">
            <span className="pl-ps-peak-n tnum">{peak ? miles1(peak) : '0'}</span>
            <span className="pl-ps-peak-u">mi at the peak</span>
          </p>
          <Arc weeks={arc} today={t} tall />
          <span className="pl-detail-axis" aria-hidden="true">
            <span>{fmtDate('md', b.start)}</span>
            <span>{fmtDate('md', b.end)}</span>
          </span>
        </div>
        <div className="group pl-ps-weeks" role="list" aria-label="Weeks">
          {shown.map((w) => {
            const k = weekOf(b, w.mon < b.start ? b.start : w.mon);
            const ph = phases[w.mon];
            const isNow = w.mon === now;
            const phase = !ph ? '' : ph.phase === 'race' ? 'Race week' : ph.down ? `${PHASE_WORDS[ph.phase]}, down week` : PHASE_WORDS[ph.phase];
            const sub = isNow ? `${due ? `${done} of ${due}` : 'Nothing yet'} done this week` : `${phase || 'Warm-up'} · ${fmtDate('md', w.mon)}`;
            const title = k === 0 ? 'Warm-up week' : `Week ${k}`;
            return (
              <Row
                key={w.mon}
                role="listitem"
                className={isNow ? 'is-now' : undefined}
                title={title}
                sub={sub}
                onClick={() => toWeek(w.mon)}
                label={`${title}${isNow ? ', this week' : ''}. ${sub}. ${miles1(w.planned)} miles planned. Open this week on Plan`}
                right={
                  <>
                    <span className="lrow-value">{miles1(w.planned)} mi</span>
                    <ChevronRight size={18} className="lrow-chev" aria-hidden="true" />
                  </>
                }
              />
            );
          })}
          {hidden > 0 ? (
            <Row
              className="pl-ps-fold"
              title={`${hidden} more ${hidden === 1 ? 'week' : 'weeks'}`}
              onClick={() => setOpen(true)}
              aria-expanded={false}
              right={<ChevronDown size={18} className="lrow-chev" aria-hidden="true" />}
            />
          ) : null}
        </div>
      </PageSection>

      {/* before the permission step is answered, that step (with its own Orb and title) is the assistant's heading */}
      {ai && gate === 'open' ? (
        <section className="pl-ps-ask" aria-labelledby="pl-ps-ask-t">
          <div className="pl-ps-ask-head">
            <Orb size={28} />
            <h3 id="pl-ps-ask-t" className="pl-ps-ask-title">
              Change this plan
            </h3>
          </div>
          {consent?.training === false ? (
            <p className="pl-ps-ask-line">
              The assistant can’t read your plan, so it answers in general terms.{' '}
              <button type="button" className="pl-ps-link" onClick={toPrivacy}>
                Turn it on in Settings
              </button>
            </p>
          ) : (
            <p className="pl-ps-ask-line">Say what you want, in as much detail as you like. Nothing moves until you tap Apply.</p>
          )}
        </section>
      ) : null}
    </div>
  );

  if (!ai)
    return (
      <div className="pl-ps" ref={root}>
        {lead}
      </div>
    );
  const pane = <AssistantPane chat={chatId} date={t} screen={{ tab: 'plan', plan: b.id }} placeholder="Describe what you want to change" lead={gate === 'open' ? lead : undefined} onApplied={onApplied} className="pl-ps-pane" />;
  // before the permission step is answered, it stands in for the conversation, under the summary
  return (
    <div className="pl-ps" ref={root}>
      {gate === 'open' ? null : lead}
      {pane}
    </div>
  );
};

/**
 * The summary's "More" button (a 40 px round Paper button at the top right): New plan, All plans, and Delete plan, which
 * deletes at once with Undo in the toast. The server deletes at once; Undo restores it once the delete has landed.
 */
const PlanMore = ({ b, fromList }: { b: PlanBlock; fromList?: boolean }) => {
  const sheet = useSheet();
  const toast = useToast();
  const menu = useContextMenu();
  const btn = useRef<HTMLButtonElement>(null);
  const log = useLog([]);
  const { remove, restore } = usePlanDelete();
  const del = () => {
    sheet.close();
    haptics.delete();
    const gone = remove.mutateAsync(b);
    gone.catch((e: unknown) => {
      toast(e instanceof ApiError && e.status !== 404 ? `Couldn’t delete the plan. ${e.message}` : 'Couldn’t delete the plan. It’s still on your calendar.');
    });
    toast('Plan deleted', {
      label: 'Undo',
      fn: () =>
        void gone.then(
          () =>
            restore.mutateAsync(b).then(
              () => undefined,
              () => toast('Couldn’t bring the plan back. Try again from Plans.'),
            ),
          () => undefined,
        ),
    });
  };
  const t = log.today;
  const prof = log.boot?.user.trainingProfile ?? null;
  return (
    <button
      ref={btn}
      type="button"
      className="icon-btn pl-more"
      aria-label="More"
      title="More"
      aria-haspopup="menu"
      onClick={() => {
        const el = btn.current;
        if (!el) return;
        menu.open({
          items: [
            { label: 'New plan', icon: <Plus size={18} />, onSelect: () => openTemplate(sheet, log, true, b.end < t && prof ? fromEndingBlock(b, prof) : undefined) },
            { label: 'All plans', icon: <ListChecks size={18} />, onSelect: () => (fromList ? sheet.pop() : openPlans(sheet, true)) },
            { label: 'Delete plan and its sessions ahead', icon: <Trash2 size={18} />, destructive: true, onSelect: del },
          ],
          anchor: el.getBoundingClientRect(),
          label: 'Plan actions',
          returnFocus: el,
          haptic: false,
        });
      }}
    >
      <Ellipsis size={20} aria-hidden="true" />
    </button>
  );
};

import { assess, clock, fmtDate, mi, monthOf, zoneOf, type Activity, type LiftSet } from '@logbook/shared';
import { ChevronRight } from 'lucide-react';
import { Pressable } from '@/ui';
import { Gauge, TrendChart } from '@/ui/charts';
import { useLog } from '../log/useLog';
import { RecordCard, RouteMap, useRunRecords, whenLine } from '../sessions/RunDetail';
import { startClock, usePushSession } from '../sessions/SessionCard';
import { paceText } from './data';
import { chartZones, effortWord, hrShare, lapRows, zoneShare } from './run';
import './activity.css';
import './metric.css';

/** The source chip on a row and at the top of a sheet: where the entry came from. */
export const SourceChip = ({ source }: { source: 'Strava' | 'Manual' }) => <span className={`pa-source ${source === 'Strava' ? 'is-strava' : ''}`}>{source}</span>;

/**
 * An activity in full, opened from Progress's list (docs/inspiration.md §6 "Run detail"): the route, where it came from and
 * when, a record if it set one, a 2×2 of the numbers that matter, the effort on a half gauge when there is heart rate and
 * zones, heart rate lap by lap over your zones, and the laps. The planned session it belongs to is one row away. Strava's
 * data is shown here and nowhere else: it is never sent to the assistant.
 */
export const ActivitySheet = ({ a }: { a: Activity }) => {
  const log = useLog([monthOf(a.date)]);
  const openSession = usePushSession(log);
  const run = a.kind === 'run';
  const records = useRunRecords(run ? [a] : []);
  const sess = log.snap.sessionsOn(a.date).find((s) => s.kind === a.kind) ?? null;
  const as = assess(log.zones, run ? sess : null, [a]);
  const laps = lapRows(a.laps, log.zones);
  const hrLaps = laps.filter((l) => l.hr != null);
  const zones = chartZones(log.zones);
  const when = whenLine(a.date, log.today, a.time, startClock);
  const pace = run && a.miles > 0.2 && a.movingSec ? a.movingSec / a.miles : null;
  const za = a.avgHr != null ? zoneOf(log.zones, a.avgHr) : null;
  const share = hrShare(log.zones, a.avgHr, a.maxHr);
  // an effort word only against a plan: an unplanned run has nothing to be on target for
  const word = sess ? effortWord(as.effort) : null;
  const fastest = laps.length ? Math.min(...laps.map((l) => l.pace)) : 0;
  const slowest = laps.length ? Math.max(...laps.map((l) => l.pace)) : 0;
  const cells: Array<[string, string, string?]> = [
    ['Distance', a.miles > 0.05 ? mi(a.miles) : '–', a.miles > 0.05 ? 'mi' : undefined],
    run ? ['Pace', pace ? paceText(pace) : '–', pace ? '/mi' : undefined] : ['Elevation', String(Math.round(a.elevFt)), 'ft'],
    ['Time', a.movingSec ? clock(a.movingSec) : '–'],
    a.avgHr != null ? ['Avg heart rate', String(a.avgHr), 'bpm'] : ['Elevation', String(Math.round(a.elevFt)), 'ft'],
  ];
  // never the same cell twice (a lift with no heart rate): the fourth falls back to max heart rate or cadence
  if (!run && a.avgHr == null) cells[3] = a.maxHr != null ? ['Max heart rate', String(a.maxHr), 'bpm'] : ['Cadence', a.cadence ? String(Math.round(a.cadence)) : '–', a.cadence ? 'spm' : undefined];
  const fine = [za ? `Z${za} average` : null, a.maxHr != null ? `max ${a.maxHr} bpm` : null, a.cadence ? `${Math.round(a.cadence)} spm` : null, run && a.elevFt ? `${Math.round(a.elevFt)} ft up` : null].filter(Boolean).join(' · ');
  return (
    <div className="pa-sheet">
      {a.polyline ? <RouteMap polyline={a.polyline} drawKey={`pa-${a.id}`} run={a} records={records} /> : null}
      <div className="pa-status">
        <SourceChip source="Strava" />
        <span className="pa-when">{when ?? fmtDate('long', a.date)}</span>
        {!run ? <span className="pa-when">· {a.sportType}</span> : null}
      </div>
      {records.length ? <RecordCard records={records} date={a.date} onTap={() => document.getElementById(`pa-laps-${a.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} /> : null}
      <div className="pa-grid" role="list" aria-label="The numbers">
        {cells.map(([k, v, u]) => (
          <span key={k} className="pa-cell" role="listitem">
            <span className="caps">{k}</span>
            <span className="stamp pa-num">
              {v}
              {u && v !== '–' ? <small>{u}</small> : null}
            </span>
          </span>
        ))}
      </div>
      {fine ? <p className="pa-fine">{fine}</p> : null}
      {a.avgHr == null && !a.perfAt ? <p className="pa-fine">Heart rate and laps are on their way from Strava.</p> : null}

      {share != null ? (
        <section className="pa-sec" aria-labelledby={`pa-eff-${a.id}`}>
          <h3 className="pa-h" id={`pa-eff-${a.id}`}>
            Effort
          </h3>
          <Gauge
            value={share}
            band={sess && /easy|long|recovery/i.test(sess.type ?? '') ? zoneShare(log.zones, 2, a.maxHr) : null}
            center={
              <>
                {a.avgHr}
                <small className="pa-unit">bpm</small>
              </>
            }
            word={word ?? (za ? `Zone ${za} average` : 'Average')}
            min="Z1"
            max="Z5"
            size={220}
            label={`Effort: averaged ${a.avgHr} beats per minute${za ? `, zone ${za}` : ''}${word ? `. ${word}` : ''}`}
          />
          {sess && /easy|long|recovery/i.test(sess.type ?? '') ? <p className="pa-fine pa-center">The shaded stretch is zone 2, where an easy run belongs.</p> : null}
        </section>
      ) : null}

      <section className="pa-sec" aria-labelledby={`pa-hr-${a.id}`}>
        <h3 className="pa-h" id={`pa-hr-${a.id}`}>
          Heart rate by lap
        </h3>
        <TrendChart
          label={hrLaps.length ? `Heart rate by lap, from ${Math.min(...hrLaps.map((l) => l.hr!))} to ${Math.max(...hrLaps.map((l) => l.hr!))} beats per minute` : 'No heart rate by lap'}
          line={laps.map((l) => l.hr)}
          dots={laps.map((l) => l.hr)}
          zones={zones}
          labels={laps.map((l) => (l.part ? `${mi(l.miles)} MI` : `MI ${l.n}`))}
          format={(v) => String(Math.round(v))}
          height={168}
          avg={hrLaps.length > 1 ? a.avgHr : null}
          empty={<span>{a.perfAt ? 'No heart rate on this one.' : 'Heart rate by lap comes in with Strava’s detail.'}</span>}
          readout={(i) =>
            i == null ? (
              <span className="mp-readout caps">{zones.length ? 'Your zones shaded behind' : 'Set zones in Settings to shade them'}</span>
            ) : (
              <span className="mp-readout caps on">
                {laps[i]!.part ? `${mi(laps[i]!.miles)} mi` : `Mile ${laps[i]!.n}`} · {laps[i]!.hr != null ? `${laps[i]!.hr} bpm` : 'No heart rate'}
                {laps[i]!.zone ? ` · Z${laps[i]!.zone}` : ''} · {paceText(laps[i]!.pace)} /mi
              </span>
            )
          }
        />
      </section>

      {laps.length > 1 ? (
        <section className="pa-sec" aria-labelledby={`pa-laps-h-${a.id}`} id={`pa-laps-${a.id}`}>
          <h3 className="pa-h" id={`pa-laps-h-${a.id}`}>
            Laps
          </h3>
          <div className="pa-laps" role="table" aria-label="Laps">
            <div className="pa-lap pa-lap-head caps" role="row">
              <span role="columnheader">Lap</span>
              <span role="columnheader" aria-hidden="true" />
              <span role="columnheader">Pace</span>
              <span role="columnheader">HR</span>
            </div>
            {laps.map((l) => {
              // the fastest lap gets the longest bar
              const w = slowest === fastest ? 1 : 0.3 + 0.7 * (1 - (l.pace - fastest) / (slowest - fastest));
              return (
                <div key={l.n} className={`pa-lap ${l.pace === fastest ? 'is-best' : ''}`} role="row">
                  <span className="pa-lap-n stamp" role="cell">
                    {l.part ? mi(l.miles) : l.n}
                  </span>
                  <span className="pa-lap-bar" role="cell" aria-hidden="true">
                    <i style={{ width: `${w * 100}%` }} />
                  </span>
                  <span className="pa-lap-pace stamp" role="cell">
                    {paceText(l.pace)}
                  </span>
                  <span className="pa-lap-hr" role="cell">
                    {l.hr ?? '–'}
                    {l.zone ? <small> Z{l.zone}</small> : null}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {sess ? (
        <div className="list-edge pa-more">
          <Pressable className="pg-row" press="surface" onPress={() => openSession(a.date, sess)} label="Open the planned session">
            <span className="pg-row-main">
              <span className="pg-row-title">Open the planned session</span>
              <span className="pg-row-sub">Mark it, move it, or get the coach’s read</span>
            </span>
            <ChevronRight size={16} className="pg-chev" aria-hidden="true" />
          </Pressable>
        </div>
      ) : null}
    </div>
  );
};

/** A day's lift sets logged by hand, by exercise. */
export const LiftDaySheet = ({ sets }: { sets: LiftSet[] }) => {
  const by = new Map<string, LiftSet[]>();
  for (const s of sets) by.set(s.exercise.trim(), [...(by.get(s.exercise.trim()) ?? []), s]);
  const volume = sets.reduce((t, s) => t + s.weight * s.reps, 0);
  return (
    <div className="pa-sheet">
      <div className="pa-status">
        <SourceChip source="Manual" />
        <span className="pa-when">Logged by hand</span>
      </div>
      <div className="pa-grid" role="list" aria-label="The numbers">
        <span className="pa-cell" role="listitem">
          <span className="caps">Sets</span>
          <span className="stamp pa-num">{sets.length}</span>
        </span>
        <span className="pa-cell" role="listitem">
          <span className="caps">Volume</span>
          <span className="stamp pa-num">
            {Math.round(volume).toLocaleString('en-US')}
            <small>lb</small>
          </span>
        </span>
      </div>
      <div className="pa-laps" role="table" aria-label="Sets">
        {[...by.entries()].map(([name, xs]) => (
          <div key={name} className="pa-lift" role="row">
            <span className="pa-lift-name" role="rowheader">
              {name}
            </span>
            <span className="pa-lift-sets stamp" role="cell">
              {xs.map((x) => `${x.weight}×${x.reps}`).join('  ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

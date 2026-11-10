import { assess, clock, fmtDate, mi, monthOf, zoneOf, type Activity } from '@logbook/shared';
import { CalendarDays, ChevronRight, Clock, Footprints, Heart, MapPin, Mountain, Timer } from 'lucide-react';
import type { ReactNode } from 'react';
import { Pressable } from '@/ui';
import { Gauge, TrendChart } from '@/ui/charts';
import { useLog } from '../log/useLog';
import { RecordCard, RouteMap, useRunRecords, whenLine } from '../sessions/RunDetail';
import { startClock, usePushSession } from '../sessions/SessionCard';
import { paceText } from './data';
import { chartZones, effortWord, hrShare, lapRows, zoneShare } from './run';
import './progress.css';
import './activity.css';
import './metric.css';

/** The source chip at the top of the sheet: where the activity came from. This file is loaded only in a build with Strava. */
const SourceChip = () => <span className="pa-source is-synced">Strava</span>;

const CELL_ICON: Record<string, ReactNode> = {
  Distance: <MapPin size={16} />,
  Pace: <Timer size={16} />,
  Time: <Clock size={16} />,
  Elevation: <Mountain size={16} />,
  'Heart rate': <Heart size={16} />,
  'Max HR': <Heart size={16} />,
  Cadence: <Footprints size={16} />,
};

/** A tile of the 2×2: the label with its icon, the stamped number with its small unit. */
const Cell = ({ k, v, u }: { k: string; v: string; u?: string }) => (
  <span className="tile pa-cell" role="listitem">
    <span className="tile-label">
      {CELL_ICON[k]}
      <span>{k}</span>
    </span>
    <span className={`tile-value ${v === '–' ? 'is-empty' : ''}`}>
      {v}
      {u && v !== '–' ? <small>{u}</small> : null}
    </span>
  </span>
);

/**
 * An activity in full, opened from Progress's list (docs/inspiration.md §6 "Run detail", docs/shape-system.md §5 sheets): the
 * map card (the route, where it came from and when), a record if it set one, a 2×2 of tiles for the numbers that matter, the
 * effort on a half gauge when there is heart rate and zones, the heart-rate card (lap by lap over your zones), and the laps
 * card. The planned session it belongs to is one row away. Strava's data is shown here and nowhere else: it is never sent to
 * the assistant.
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
  const easyish = !!sess && /easy|long|recovery/i.test(sess.type ?? '');
  const cells: Array<[string, string, string?]> = [
    ['Distance', a.miles > 0.05 ? mi(a.miles) : '–', a.miles > 0.05 ? 'mi' : undefined],
    run ? ['Pace', pace ? paceText(pace) : '–', pace ? '/mi' : undefined] : ['Elevation', String(Math.round(a.elevFt)), 'ft'],
    ['Time', a.movingSec ? clock(a.movingSec) : '–'],
    a.avgHr != null ? ['Heart rate', String(a.avgHr), 'bpm'] : ['Elevation', String(Math.round(a.elevFt)), 'ft'],
  ];
  // never the same cell twice (a lift with no heart rate): the fourth falls back to max heart rate or cadence
  if (!run && a.avgHr == null) cells[3] = a.maxHr != null ? ['Max HR', String(a.maxHr), 'bpm'] : ['Cadence', a.cadence ? String(Math.round(a.cadence)) : '–', a.cadence ? 'spm' : undefined];
  const fine = [za ? `Z${za} average` : null, a.maxHr != null ? `max ${a.maxHr} bpm` : null, a.cadence ? `${Math.round(a.cadence)} spm` : null, run && a.elevFt ? `${Math.round(a.elevFt)} ft up` : null].filter(Boolean).join(' · ');
  return (
    <div className="pa-sheet">
      <section className={`card pa-map ${a.polyline ? '' : 'pa-map-plain'}`} aria-label="Route and source">
        {a.polyline ? <RouteMap polyline={a.polyline} drawKey={`pa-${a.id}`} run={a} records={records} /> : null}
        <div className="pa-status">
          <SourceChip />
          <span className="pa-when">
            {when ?? fmtDate('long', a.date)}
            {!run ? ` · ${a.sportType}` : ''}
          </span>
        </div>
      </section>
      {records.length ? <RecordCard records={records} date={a.date} onTap={() => document.getElementById(`pa-laps-${a.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} /> : null}
      <div className="tiles pa-grid" role="list" aria-label="The numbers">
        {cells.map(([k, v, u]) => (
          <Cell key={k} k={k} v={v} u={u} />
        ))}
      </div>
      {fine ? <p className="pa-fine">{fine}</p> : null}
      {a.avgHr == null && !a.perfAt ? <p className="pa-fine">Heart rate and laps are on their way from Strava.</p> : null}

      {share != null ? (
        <section className="card pa-card" aria-labelledby={`pa-eff-${a.id}`}>
          <h3 className="pa-h" id={`pa-eff-${a.id}`}>
            Effort
          </h3>
          <Gauge
            value={share}
            band={easyish ? zoneShare(log.zones, 2, a.maxHr) : null}
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
          {easyish ? <p className="pa-fine pa-center">The shaded stretch is zone 2, where an easy run belongs.</p> : null}
        </section>
      ) : null}

      <section className="card pa-card" aria-labelledby={`pa-hr-${a.id}`}>
        <h3 className="pa-h" id={`pa-hr-${a.id}`}>
          Heart rate by lap
        </h3>
        <TrendChart
          label={hrLaps.length ? `Heart rate by lap, from ${Math.min(...hrLaps.map((l) => l.hr!))} to ${Math.max(...hrLaps.map((l) => l.hr!))} beats per minute` : 'No heart rate by lap'}
          line={laps.map((l) => l.hr)}
          dots={laps.map((l) => l.hr)}
          zones={zones}
          labels={laps.map((l) => (l.part ? `${mi(l.miles)} mi` : `Mi ${l.n}`))}
          format={(v) => String(Math.round(v))}
          height={168}
          avg={hrLaps.length > 1 ? a.avgHr : null}
          empty={<span>{a.perfAt ? 'No heart rate on this one.' : 'Heart rate by lap comes in with Strava’s detail.'}</span>}
          readout={(i) =>
            i == null ? (
              <span className="mp-readout">{zones.length ? 'Your zones shaded behind' : 'Set zones in Settings to shade them'}</span>
            ) : (
              <span className="mp-readout on">
                {laps[i]!.part ? `${mi(laps[i]!.miles)} mi` : `Mile ${laps[i]!.n}`} · {laps[i]!.hr != null ? `${laps[i]!.hr} bpm` : 'No heart rate'}
                {laps[i]!.zone ? ` · Z${laps[i]!.zone}` : ''} · {paceText(laps[i]!.pace)} /mi
              </span>
            )
          }
        />
      </section>

      {laps.length > 1 ? (
        <section className="card pa-card" aria-labelledby={`pa-laps-h-${a.id}`} id={`pa-laps-${a.id}`}>
          <h3 className="pa-h" id={`pa-laps-h-${a.id}`}>
            Laps
          </h3>
          <div className="pa-laps" role="table" aria-label="Laps">
            <div className="pa-lap pa-lap-head" role="row">
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
                  <span className="pa-lap-n" role="cell">
                    {l.part ? mi(l.miles) : l.n}
                  </span>
                  <span className="pa-lap-bar" role="cell" aria-hidden="true">
                    <i style={{ width: `${w * 100}%` }} />
                  </span>
                  <span className="pa-lap-pace" role="cell">
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
        <div className="group pa-more">
          <Pressable className="pg-drill" press="surface" onPress={() => openSession(a.date, sess)} label="Open the planned session">
            <span className="icon-tile" aria-hidden="true">
              <CalendarDays size={17} />
            </span>
            <span className="pg-drill-main">
              <span className="pg-drill-title">Open the planned session</span>
              <span className="pg-drill-sub">Mark it or move it</span>
            </span>
            <ChevronRight size={16} className="pg-chev" aria-hidden="true" />
          </Pressable>
        </div>
      ) : null}
    </div>
  );
};

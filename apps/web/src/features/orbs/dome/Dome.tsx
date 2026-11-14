import type { ISODate, Level, Rewards } from '@logbook/shared';
import { Bubbles, RefreshCw, Smartphone } from 'lucide-react';
import type * as React from 'react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { haptics } from '@/lib/haptics';
import { useReduced } from '@/lib/motion';
import { Poster, PosterScene } from '@/ui/poster';
import { StatusPill } from '@/ui/primitives';
import { useToast } from '@/ui/Toast';
import { levelBand, levelProgress } from '../page/model';
import { domeBodies, domeSaid } from './bodies';
import { FLOAT_LASTS_MS, OCULUS } from './rules';
import { createStage, type Stage } from './stage';
import './dome.css';

const num = (n: number): string => n.toLocaleString('en-US');
const orbs = (n: number): string => `${num(n)} ${n === 1 ? 'Orb' : 'Orbs'}`;

/** The drawing over the window, in the window's own units: its edge, and the level's arc on that edge. */
const D = OCULUS.d;
const EDGE = 1.5;
const ARC = 3;
/** The rings round the window, as shares of its radius, nearest first. */
const RINGS = [1.14, 1.34, 1.56] as const;

export interface DomeProps {
  store: Rewards;
  today: ISODate;
  /** Every Orb ever earned, and the level it makes. */
  total: number;
  level: Level;
  /** Is Fitness on (default yes)? Off: nothing in the window names training. */
  fitness?: boolean;
  /** Before the first Orb: the poster's title, the line under it, and the rule for the band. */
  empty?: { title: string; line: string; rule: string } | null;
  /** What stands on Paper under the band, in the same card: the week. */
  children?: ReactNode;
}

/**
 * The Orbs page's poster, with a round window in it (the oculus). The poster kit's own card: the total where a poster's
 * title stands, the pale sky running down to the horizon and the hills, and the band with the level's words. In the
 * scene, clear of the hills, the oculus: one circle with thin white rings round it, holding every Orb the person has
 * earned as a flat form with weight (bodies.ts says which; stage.ts makes them fall, roll along the curve and be taken
 * by a finger). On the window's edge a thin Apricot arc from twelve o'clock is the way to the next level.
 *
 * Under the poster, on the ground, three glass pills: Tilt (gravity follows the phone, asked for on that tap and never
 * before), Stir (one upward swirl) and Float (gravity lets go).
 *
 * The window is a picture: hidden from VoiceOver, which hears the same in words (the total, this week by kind, how much
 * of the past) and reaches the pills as buttons. With Reduce Motion the pile is drawn at rest, every form upright, and
 * the pills are not drawn; a tap still names an Orb. Before the first Orb the window is empty and one line says what
 * will fill it.
 */
export const Dome = ({ store, today, total, level, fitness = true, empty, children }: DomeProps): React.JSX.Element => {
  const reduce = useReduced();
  const toast = useToast();
  const oculus = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const caption = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const bodies = useMemo(() => domeBodies(store, today, { fitness }), [store, today, fitness]);
  const said = useMemo(() => domeSaid(store, today, { fitness }), [store, today, fitness]);
  const latest = useRef(bodies);
  latest.current = bodies;
  const [tilt, setTilt] = useState(false);
  const [float, setFloat] = useState(false);
  /** "Tilt is off for Orby" is said once. */
  const told = useRef(false);

  useEffect(() => {
    if (!oculus.current || !canvas.current || !caption.current) return;
    const s = createStage({ oculus: oculus.current, canvas: canvas.current, caption: caption.current }, { reduce });
    stage.current = s;
    s.setBodies(latest.current);
    return () => {
      stage.current = null;
      s.destroy();
      setTilt(false);
      setFloat(false);
    };
  }, [reduce]);
  useEffect(() => {
    stage.current?.setBodies(bodies);
  }, [bodies]);

  const onTilt = () => {
    const s = stage.current;
    if (!s) return;
    if (tilt) {
      setTilt(false);
      void s.setTilt(false);
      return;
    }
    // asked on this tap, and only here: never when the page opens
    void s.setTilt(true).then((answer) => {
      if (stage.current !== s) return;
      setTilt(answer === 'on');
      if (answer === 'failed' && !told.current) {
        told.current = true;
        toast('Tilt is off for Orby');
      }
    });
  };
  const onStir = () => {
    haptics.threshold();
    stage.current?.stir();
  };
  const onFloat = () => {
    haptics.toggle();
    setFloat(!float);
    stage.current?.setFloat(!float);
  };
  // Float lets go by itself after a while (it draws every frame): no haptic, nobody pressed anything
  useEffect(() => {
    if (!float) return;
    const t = window.setTimeout(() => {
      setFloat(false);
      stage.current?.setFloat(false);
    }, FLOAT_LASTS_MS);
    return () => window.clearTimeout(t);
  }, [float]);

  const progress = empty ? 0 : levelProgress(level);
  const band = levelBand(level);
  const r = D / 2 - EDGE / 2;
  const scene = (
    <div className="dm-scene">
      {/* behind the window and the hills: only the sky shows them */}
      <svg className="dm-rings" viewBox={`${-D / 2} ${-D / 2} ${D} ${D}`} aria-hidden="true" focusable="false">
        {RINGS.map((k) => (
          <circle key={k} r={(D / 2) * k} />
        ))}
      </svg>
      <div className="dm-window">
        <div ref={oculus} className="dm-oculus" aria-hidden="true" data-still={reduce || undefined}>
          <canvas ref={canvas} className="dm-canvas" />
        </div>
        <svg className="dm-edge" viewBox={`0 0 ${D} ${D}`} aria-hidden="true" focusable="false">
          <circle className="dm-edge-ring" cx={D / 2} cy={D / 2} r={r} strokeWidth={EDGE} />
          {/* from twelve o'clock, clockwise, as far as the level has been earned: a dot at the very start */}
          {empty ? null : <circle className="dm-edge-arc" cx={D / 2} cy={D / 2} r={r} strokeWidth={ARC} pathLength={1} strokeDasharray={`${Math.max(0.0005, progress).toFixed(4)} 2`} transform={`rotate(-90 ${D / 2} ${D / 2})`} />}
        </svg>
        <div ref={caption} className="dm-caption" aria-hidden="true" />
      </div>
      {empty ? null : (
        <div className="sr-only">
          <p>{said.summary}</p>
          {said.items.length ? (
            <ul>
              {said.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
      <PosterScene size="slim" progress={progress} />
    </div>
  );

  return (
    <>
      {empty ? (
        <Poster className="dm is-empty" label={empty.title} title={empty.title} meta={empty.line} scene={scene} band={{ label: 'The rule', words: empty.rule }}>
          {children}
        </Poster>
      ) : (
        <Poster
          className="dm is-count"
          label={`${orbs(total)}. Level ${num(level.level)}.`}
          titleAs="p"
          title={
            // said first in the summary under it: here it is the picture of the number
            <span className="dm-total" aria-hidden="true">
              <span className="dm-num">{num(total)}</span> <span className="dm-unit">{total === 1 ? 'Orb' : 'Orbs'}</span>
            </span>
          }
          scene={scene}
          band={{ label: band.label, words: band.words }}
        >
          {children}
        </Poster>
      )}
      {empty || reduce ? null : (
        <div className="status-row dm-pills">
          <StatusPill className="dm-pill is-tilt" glyph={<Smartphone size={15} strokeWidth={1.75} />} label="Tilt" voiceLabel="Tilt. Gravity follows the phone" pressed={tilt} onPress={onTilt} />
          <StatusPill className="dm-pill" glyph={<RefreshCw size={15} strokeWidth={1.75} />} label="Stir" voiceLabel="Stir. One swirl" onPress={onStir} />
          <StatusPill className="dm-pill" glyph={<Bubbles size={15} strokeWidth={1.75} />} label="Float" voiceLabel="Float. Gravity lets go" pressed={float} onPress={onFloat} />
        </div>
      )}
    </>
  );
};

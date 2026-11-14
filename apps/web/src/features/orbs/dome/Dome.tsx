import type { ISODate, Level, Rewards } from '@logbook/shared';
import { Bubbles, RefreshCw, Smartphone } from 'lucide-react';
import type * as React from 'react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { haptics } from '@/lib/haptics';
import { useReduced } from '@/lib/motion';
import { Pressable } from '@/ui/Pressable';
import { useToast } from '@/ui/Toast';
import { domeBodies, domeSaid } from './bodies';
import { Gauge } from './Gauge';
import { createStage, type Stage } from './stage';
import './dome.css';

const num = (n: number): string => n.toLocaleString('en-US');

export interface DomeProps {
  store: Rewards;
  today: ISODate;
  /** Every Orb ever earned, and the level it makes. */
  total: number;
  level: Level;
  /** Is Fitness on (default yes)? Off: nothing in the glass names training. */
  fitness?: boolean;
  /** Before the first Orb: the one line under the empty glass, a quieter line after it, and the rule. */
  empty?: { line: string; note?: string; rule: string } | null;
  /** What stands on Paper under the console, in the same card: the week. */
  children?: ReactNode;
}

/**
 * The dome: a glass on a console, holding every Orb the person has earned as a sphere with weight (bodies.ts says which
 * spheres; stage.ts makes them fall, roll and be taken by a finger). Under the glass the console reads the total and the
 * level on a dial, and carries three keys: Tilt (gravity follows the phone, asked for on that tap and never before),
 * Stir (one upward swirl) and Float (gravity lets go).
 *
 * The glass is a picture: hidden from VoiceOver, which hears the same in words (the total, this week by kind, how much
 * of the past) and reaches the keys as buttons. With Reduce Motion the pile is drawn at rest and the keys are not
 * drawn; a tap still names a sphere. Before the first Orb the glass is empty and one line says what will fill it.
 */
export const Dome = ({ store, today, total, level, fitness = true, empty, children }: DomeProps): React.JSX.Element => {
  const reduce = useReduced();
  const toast = useToast();
  const glass = useRef<HTMLDivElement>(null);
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
    if (!glass.current || !canvas.current || !caption.current) return;
    const s = createStage({ glass: glass.current, canvas: canvas.current, caption: caption.current }, { reduce });
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

  return (
    <section className={`dm${empty ? ' is-empty' : ''}`}>
      <div className="dm-stage">
        <div className="dm-dome">
          <div ref={glass} className="dm-glass" aria-hidden="true" data-still={reduce || undefined}>
            <span className="dm-sky" />
            <svg className="dm-orbits" viewBox="0 0 334 334" focusable="false">
              <ellipse cx="236" cy="118" rx="74" ry="24" transform="rotate(-24 236 118)" />
              <circle cx="302.5" cy="85" r="4" />
              <ellipse cx="86" cy="214" rx="52" ry="17" transform="rotate(18 86 214)" />
              <circle cx="37.5" cy="196.5" r="3" />
            </svg>
            <canvas ref={canvas} className="dm-canvas" />
            <svg className="dm-shine" viewBox="0 0 334 334" focusable="false">
              <path d="M 27 129.5 A 145 145 0 0 1 83.8 48.2" />
              <path d="M 99.5 37.5 A 145 145 0 0 1 104 35.2" />
            </svg>
          </div>
          <div ref={caption} className="dm-caption" aria-hidden="true" />
        </div>
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
      {empty ? (
        <div className="dm-console is-empty">
          <p className="dm-line">{empty.line}</p>
          {empty.note ? <p className="dm-note">{empty.note}</p> : null}
          <p className="dm-words">
            <span className="dm-cap">The rule</span>
            <span className="dm-left">{empty.rule}</span>
          </p>
        </div>
      ) : (
        <div className="dm-console">
          <div className="dm-read">
            <div className="dm-facts">
              {/* said first in the summary above: here it is the picture of the number */}
              <p className="dm-total" aria-hidden="true">
                <span className="dm-num">{num(total)}</span> <span className="dm-unit">{total === 1 ? 'Orb' : 'Orbs'}</span>
              </p>
              <p className="dm-words">
                <span className="dm-cap">{`Level ${num(level.level)}`}</span>
                <span className="dm-left">{`${num(level.left)} to level ${num(level.level + 1)}`}</span>
              </p>
            </div>
            <Gauge progress={level.span > 0 ? level.into / level.span : 0} />
          </div>
          {reduce ? null : (
            <div className="dm-keys">
              <Pressable className="dm-key" aria-pressed={tilt} onPress={onTilt}>
                <span className="dm-key-disc">
                  <Smartphone className="dm-key-tilt" size={18} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="dm-key-label">Tilt</span>
              </Pressable>
              <Pressable className="dm-key" onPress={onStir}>
                <span className="dm-key-disc">
                  <RefreshCw size={18} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="dm-key-label">Stir</span>
              </Pressable>
              <Pressable className="dm-key" aria-pressed={float} onPress={onFloat}>
                <span className="dm-key-disc">
                  <Bubbles size={18} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="dm-key-label">Float</span>
              </Pressable>
            </div>
          )}
        </div>
      )}
      {children ? <div className="dm-foot">{children}</div> : null}
    </section>
  );
};

import type * as React from 'react';
import { useId } from 'react';
import { useNowMark } from '@/ui/nowBudget';
import { closed, crestY, FAR, HZ, KEY, MARK_R, markX, marksOf, MIDDLE, NEAR, SKY, SUN_R, sunDx, sunDy, VB_H, VB_W, wayAhead } from './horizon';
import { sunProgress, unit } from './logic';

export interface PosterSceneProps {
  /** full: the hills, the sun and its way (88 tall at 358 wide). slim: a strip of the same hills, no sun (48 tall). Default full. */
  size?: 'full' | 'slim';
  /** The things counted on the horizon (to-dos): one mark each, the first `done` filled. Default 0: no marks. */
  total?: number;
  done?: number;
  /** The sun's place, 0 to 1. Default `done / total` (0 with nothing to count: the sun at rest on the horizon). */
  progress?: number;
  /** The day has its goal: the sun is Sunrise (it counts as one now mark). Default false: an Apricot sun, at rest. */
  lit?: boolean;
}

/**
 * The day scene of a poster: the training card's landscape (same geometry, `./horizon`), drawn from plain numbers. The sun
 * stands at `progress` along its way, the marks on the horizon are the items done and ahead, the dotted way leads to the
 * sun's place, and two rings bloom when everything is done. Only transform and opacity change; a change of `progress`
 * moves the sun over --dur-number, and under Reduce Motion it jumps.
 */
export const PosterScene = ({ size = 'full', total: totalIn = 0, done: doneIn = 0, progress, lit = false }: PosterSceneProps) => {
  const id = useId().replace(/:/g, '');
  const slim = size === 'slim';
  // counts as whole numbers from 0 up, whatever was passed (a missing value, a text, a NaN is 0)
  const whole = (n: number) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
  const total = whole(totalIn);
  const done = whole(doneIn);
  const f = unit(progress ?? sunProgress(done, total));
  // the Sunrise sun is one of the screen's three now marks; past the budget it yields to Apricot
  const paint = useNowMark('pointer', lit && !slim);
  const complete = total > 0 && done >= total;
  const marks = slim ? [] : marksOf({ planned: total, done }, f);
  const way = slim || complete ? [] : wayAhead(f, marks);
  return (
    <svg className={`po-scene${slim ? ' is-slim' : ''}`} viewBox={slim ? `0 40 ${VB_W} ${VB_H - 40}` : `0 0 ${VB_W} ${VB_H}`} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-glow`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" style={{ stopColor: 'var(--apricot)' }} stopOpacity=".95" />
          <stop offset=".3" style={{ stopColor: 'var(--horizon-2)' }} stopOpacity=".8" />
          <stop offset=".64" style={{ stopColor: 'var(--horizon-2)' }} stopOpacity=".32" />
          <stop offset="1" style={{ stopColor: 'var(--horizon-2)' }} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-halo`} cx="50%" cy="50%" r="50%">
          <stop offset="0" style={{ stopColor: 'var(--apricot)' }} stopOpacity=".8" />
          <stop offset=".4" style={{ stopColor: 'var(--horizon-2)' }} stopOpacity=".55" />
          <stop offset=".72" style={{ stopColor: 'var(--welcome-warm)' }} stopOpacity=".3" />
          <stop offset="1" style={{ stopColor: 'var(--welcome-warm)' }} stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}-sky`}>
          <path d={SKY} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-sky)`}>
        <rect className="po-glow" x="0" y="9" width={VB_W} height="68" fill={`url(#${id}-glow)`} style={{ opacity: 0.4 + 0.6 * f }} />
        {slim ? null : (
          <>
            {way.map((d) => (
              <circle key={d.x} className="po-way" cx={d.x} cy={d.y} r="0.9" />
            ))}
            {complete ? null : <circle className="po-target" cx={HZ.x1} cy={HZ.yTop} r={SUN_R} />}
            <g className="po-sun-g" style={{ transform: `translate(${sunDx(f)}px, ${sunDy(f)}px)` }}>
              <circle cx={HZ.x0} cy={HZ.yH} r="48" fill={`url(#${id}-halo)`} style={{ opacity: 0.85 + 0.15 * f }} />
              <circle className={`po-ring${complete ? ' is-on' : ''}`} cx={HZ.x0} cy={HZ.yH} r={SUN_R + 9} />
              <circle className={`po-ring is-outer${complete ? ' is-on' : ''}`} cx={HZ.x0} cy={HZ.yH} r={SUN_R + 17} />
              <circle className="po-sun-key" cx={HZ.x0} cy={HZ.yH} r={SUN_R + KEY} />
              <circle className={`po-sun${lit && paint === 'now' ? '' : ' is-quiet'}`} cx={HZ.x0} cy={HZ.yH} r={SUN_R} />
            </g>
          </>
        )}
      </g>
      <path className="po-hill-1" d={closed(NEAR)} />
      <path className="po-hill-2" d={closed(MIDDLE)} />
      <path className="po-hill-3" d={closed(FAR)} />
      <path className="po-rim" d={NEAR} />
      {marks.map((m, i) => {
        const x = markX(m.share);
        const y = crestY(x);
        return m.inSun ? null : (
          <g key={i} style={{ '--i': i } as React.CSSProperties}>
            <circle className="po-mark-key" cx={x} cy={y} r={MARK_R + 2} />
            <circle className="po-mark" cx={x} cy={y} r={MARK_R - 0.75} />
            <circle className={`po-mark-disc${m.lit ? ' is-lit' : ''}`} cx={x} cy={y} r={MARK_R} />
          </g>
        );
      })}
    </svg>
  );
};

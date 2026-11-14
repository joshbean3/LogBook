import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BOUNCE, FELT, FLOAT, HOLD, OCULUS, REST, ROLL, TIME } from './rules';
import { gemFor } from '../gems';
import { sized, spriteKey } from './sprites';

const css = readFileSync(join(__dirname, 'dome.css'), 'utf8');
const stage = readFileSync(join(__dirname, 'stage.ts'), 'utf8');
const dome = readFileSync(join(__dirname, 'Dome.tsx'), 'utf8');

describe('the oculus on the page', () => {
  it('is 280 px across, and never wider than the card less 40 px', () => {
    expect(css).toContain(`--dm-d: min(${OCULUS.mostPx}px, calc(100% - ${OCULUS.sidePx}px));`);
    expect(css).toMatch(/\.dm-window \{[^}]*width: var\(--dm-d\);\s*aspect-ratio: 1;/);
    // a unit of the simulation is a point at that size: a to-do's Orb is 22 pt across
    expect(OCULUS.d).toBe(OCULUS.mostPx);
  });
  it('is a circle that takes every touch itself, except with Reduce Motion, when the page scrolls over it', () => {
    expect(css).toMatch(/\.dm-oculus \{[^}]*border-radius: 50%;[^}]*touch-action: none/);
    expect(css).toMatch(/\.dm-oculus\[data-still\] \{\s*touch-action: manipulation/);
  });
  it('is flat: Paper inside, a White edge, an Apricot arc, white rings; no gloss, no shadow, no blur', () => {
    expect(css).toMatch(/\.dm-oculus \{[^}]*background: radial-gradient\(closest-side, var\(--paper\) \d+%, var\(--cloud\)\);/);
    expect(css).toMatch(/\.dm-edge-ring \{\s*stroke: var\(--white\);/);
    expect(css).toMatch(/\.dm-edge-arc \{\s*stroke: var\(--apricot\);/);
    expect(css).toMatch(/\.dm-rings \{[^}]*stroke: var\(--white\);\s*stroke-width: 1;/);
    const window = css.slice(css.indexOf('.dm-scene {'), css.indexOf('.dm-caption {'));
    expect(window).not.toMatch(/box-shadow|filter|blur|inset 0/);
    // the one dark thing is the caption a tap shows
    expect([...css.matchAll(/var\(--night-ink\)/g)]).toHaveLength(1);
    expect(css).toMatch(/\.dm-caption \{[^}]*background: var\(--night-ink\);/);
    expect(css).not.toMatch(/console|gauge|dm-key|dm-shine|dm-orbits/);
  });
  it('the level is an arc from twelve o’clock on the edge, and the rings stand behind the window and the hills', () => {
    expect(dome).toMatch(/className="dm-edge-arc"[^>]*pathLength=\{1\}[^>]*transform=\{`rotate\(-90 /);
    expect(dome.indexOf('className="dm-rings"')).toBeLessThan(dome.indexOf('className="dm-window"'));
    expect(dome.indexOf('className="dm-window"')).toBeLessThan(dome.indexOf('<PosterScene size="slim"'));
    expect(dome).not.toMatch(/Gauge|dm-console|dm-key\b/);
  });
  it('animates only opacity, on the duration tokens', () => {
    const moves = [...css.matchAll(/transition(?:-property)?:\s*([^;]+);/g)].map((m) => m[1]!.trim());
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) expect(m).toMatch(/^(none|opacity var\(--dur-[a-z]+\) var\(--ease-out\))$/);
    expect(css).not.toMatch(/animation\s*:/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[^}]*\{[^}]*transition: none/);
  });
  it('the three controls are Today’s status pills in Today’s row, and Increase Contrast has its own rules', () => {
    const row = dome.slice(dome.indexOf('<div className="status-row dm-pills">'));
    expect([...row.matchAll(/<StatusPill [^\n]*label="(\w+)" voiceLabel="([^"]+)"( pressed=\{\w+\})? onPress=\{(\w+)\} \/>/g)].map((m) => [m[1], m[2], m[3]?.trim() ?? null, m[4]])).toEqual([
      ['Tilt', 'Tilt. Gravity follows the phone', 'pressed={tilt}', 'onTilt'],
      ['Stir', 'Stir. One swirl', null, 'onStir'],
      ['Float', 'Float. Gravity lets go', 'pressed={float}', 'onFloat'],
    ]);
    expect(dome).toContain("import { StatusPill } from '@/ui/primitives';");
    expect(css).toMatch(/@media \(prefers-contrast: more\)/);
  });
});

describe('the stage keeps its promises in its own code', () => {
  it('takes down every listener it puts up', () => {
    const added = [...stage.matchAll(/\b(\w+)\.addEventListener\('(\w+)', (\w+)\)/g)].map((m) => `${m[1]}.${m[2]}.${m[3]}`);
    const removed = new Set([...stage.matchAll(/\b(\w+)\.removeEventListener\('(\w+)', (\w+)\)/g)].map((m) => `${m[1]}.${m[2]}.${m[3]}`));
    expect(added.length).toBeGreaterThanOrEqual(7);
    for (const a of added) expect(removed.has(a), a).toBe(true);
    for (const part of ['cancelAnimationFrame(raf)', 'clearTimeout(saidTimer)', 'clearTimeout(tiltWait)', 'io?.disconnect()', 'mo?.disconnect()', 'ro?.disconnect()']) expect(stage.slice(stage.indexOf('destroy: () => {'))).toContain(part);
  });
  it('asks for motion only from the Tilt pill, never when the page opens', () => {
    expect(stage.match(/askMotion\(/g)).toHaveLength(1);
    expect(stage.slice(stage.indexOf('const setTilt'), stage.indexOf('// ---------- pausing'))).toContain('askMotion()');
    expect(dome.match(/setTilt\(true\)/g)).toHaveLength(1);
    expect(dome.slice(dome.indexOf('const onTilt'), dome.indexOf('const onStir'))).toContain('s.setTilt(true)');
    expect(dome).toContain("toast('Tilt is off for Orby')");
  });
  it('uses named haptics only, and nothing reads storage', () => {
    const fired = new Set([...`${stage}\n${dome}`.matchAll(/haptics\.(\w+)\(\)/g)].map((m) => m[1]));
    expect([...fired].sort()).toEqual(['lift', 'orb', 'select', 'threshold', 'tick', 'toggle']);
    expect(`${stage}\n${dome}`).not.toMatch(/localStorage|sessionStorage/);
  });
});

describe('the numbers hold together', () => {
  it('a frame at 60 Hz is eight steps, and a felt hit is well above a resting touch', () => {
    expect(Math.round(1 / 60 / TIME.step)).toBe(8);
    expect(FELT.clack).toBeGreaterThan(BOUNCE.floor);
    expect(FELT.rim).toBeGreaterThan(FELT.clack);
    expect(FELT.gapMs).toBeGreaterThanOrEqual(100);
    expect(REST.moving).toBeLessThan(REST.after);
    expect(HOLD.captionMs).toBe(2400);
    // a floating form drifts round slowly; a rolling one may turn a good deal faster
    expect(FLOAT.spin).toBeLessThan(0.5);
    expect(ROLL.max).toBeGreaterThan(20);
  });
});

describe('sprites', () => {
  it('the art is given the exact pixels it is cut at, whatever size it was written with', () => {
    expect(sized('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="2 2 96 96"><circle r="4"/></svg>', 66)).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="2 2 96 96" width="66" height="66"><circle r="4"/></svg>');
    expect(sized('<svg viewBox="0 0 100 100"><path stroke-width="2" d="M0 0"/></svg>', 44)).toBe('<svg viewBox="0 0 100 100" width="44" height="44"><path stroke-width="2" d="M0 0"/></svg>');
  });
  it('one picture per gem, shift step, count and size (whatever the family calls its hues and styles)', () => {
    const g = gemFor('habit', 'd:2026-11-16:habit:0');
    expect(spriteKey(g, 44)).toBe(spriteKey({ ...g }, 44));
    expect(spriteKey(g, 44)).not.toBe(spriteKey(g, 60));
    expect(spriteKey(g, 44)).not.toBe(spriteKey({ ...g, shift: g.shift + 0.25 }, 44));
    expect(spriteKey({ ...g, stars: 3 }, 44)).not.toBe(spriteKey({ ...g, stars: 4 }, 44));
    expect(spriteKey(g, 44)).not.toBe(spriteKey(gemFor('fused:year', 'y:0'), 44));
  });
  it('are drawn turned by their Orb’s own angle, and upright with Reduce Motion', () => {
    expect(stage).toContain('const a = reduce ? 0 : W.rot[i]!;');
    expect(stage).toMatch(/ctx\.setTransform\(c, d, -d, c, cx, cy\);\s*ctx\.drawImage\(s\.img, -s\.side \/ 2, -s\.side \/ 2\);/);
    // a remembered pile keeps its angles, and an Orb that stays through a change of the store keeps its own
    expect(stage).toContain('world.rot.set(hit.rot);');
    expect(stage).toContain('rot: world.rot[i]!');
  });
});

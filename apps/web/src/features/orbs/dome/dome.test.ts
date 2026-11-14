import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BOUNCE, FELT, GLASS, HOLD, REST, TIME } from './rules';
import { sized, spriteKey } from './sprites';

const css = readFileSync(join(__dirname, 'dome.css'), 'utf8');
const stage = readFileSync(join(__dirname, 'stage.ts'), 'utf8');
const dome = readFileSync(join(__dirname, 'Dome.tsx'), 'utf8');

describe('the glass on the page', () => {
  it('is 56 percent of the screen, 440 px at most, and leaves 96 px of page above the dock', () => {
    expect(css).toContain(`--dm-h: min(${GLASS.share}svh, ${GLASS.mostPx}px, calc(100svh - var(--safe-t) - 44px - var(--sp-4) - var(--chrome-h) - ${GLASS.pageLeft}px));`);
  });
  it('is never squatter than the glass the fill limit was worked out for', () => {
    expect(css).toContain(`width: min(100%, calc(var(--dm-h) * ${GLASS.w} / ${GLASS.minH}));`);
  });
  it('takes every touch itself, except with Reduce Motion, when the page scrolls over it', () => {
    expect(css).toMatch(/\.dm-glass \{[^}]*touch-action: none/);
    expect(css).toMatch(/\.dm-glass\[data-still\] \{\s*touch-action: manipulation/);
  });
  it('animates only opacity and transform, on the duration tokens', () => {
    const moves = [...css.matchAll(/transition(?:-property)?:\s*([^;]+);/g)].map((m) => m[1]!.trim());
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) expect(m).toMatch(/^(none|(opacity|transform) var\(--dur-[a-z]+\) var\(--ease-out\))$/);
    expect(css).not.toMatch(/animation\s*:/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[^}]*\{[^}]*transition: none/);
  });
  it('each key is a 44 pt disc, and Increase Contrast has its own rules', () => {
    expect(css).toMatch(/\.dm-key-disc \{[^}]*width: var\(--hit\);\s*height: var\(--hit\)/);
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
  it('asks for motion only from the Tilt key, never when the page opens', () => {
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
    expect(FELT.glass).toBeGreaterThan(FELT.clack);
    expect(FELT.gapMs).toBeGreaterThanOrEqual(100);
    expect(REST.moving).toBeLessThan(REST.after);
    expect(HOLD.captionMs).toBe(2400);
  });
});

describe('sprites', () => {
  it('the art is given the exact pixels it is cut at, whatever size it was written with', () => {
    expect(sized('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="2 2 96 96"><circle r="4"/></svg>', 66)).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="2 2 96 96" width="66" height="66"><circle r="4"/></svg>');
    expect(sized('<svg viewBox="0 0 100 100"><path stroke-width="2" d="M0 0"/></svg>', 44)).toBe('<svg viewBox="0 0 100 100" width="44" height="44"><path stroke-width="2" d="M0 0"/></svg>');
  });
  it('one picture per gem, shift step, star count and size', () => {
    const g = { hue: 'apricot', style: 'plain', shift: 0.5 } as const;
    expect(spriteKey(g, 44)).toBe(spriteKey({ ...g }, 44));
    expect(spriteKey(g, 44)).not.toBe(spriteKey(g, 60));
    expect(spriteKey(g, 44)).not.toBe(spriteKey({ ...g, shift: 0 }, 44));
    expect(spriteKey({ hue: 'night', style: 'starred', shift: 0, stars: 3 }, 44)).not.toBe(spriteKey({ hue: 'night', style: 'starred', shift: 0, stars: 4 }, 44));
  });
});

import { gemBox, gemSvg, type Gem } from '../gems';

/**
 * The Orbs as pictures: each Orb's drawing at each size is turned into pixels once and kept, and a frame only copies
 * them (`drawImage`, always upright: a sphere is lit from above, so it never turns). Nothing is painted from paths
 * while the pile moves, and no Orb is a DOM node.
 *
 * A sprite is cut from the gem's own SVG at the exact device pixels it will be shown at, so it is as sharp as the art.
 * It is larger than the Orb where the art is (a glow, its rings: `gemBox`), with the sphere at its middle. The cache
 * lives as long as the page does: opening the page a second time draws at once. A gem is taken as it comes: its rung,
 * and how a rung is drawn, are the ladder's business (features/orbs/gems).
 */
export interface Sprite {
  /** The pixels: a canvas the art was drawn into once. */
  img: HTMLCanvasElement;
  /** Its side in device pixels: the art box, rounded up to whole pixels, the sphere at its middle. */
  side: number;
}

const idOf = (g: Gem): string => `${g.rung}`;
/** What names one sprite: the gem and the Orb's diameter in device pixels. */
export const spriteKey = (g: Gem, px: number): string => `${idOf(g)}@${px}`;

const ready = new Map<string, Sprite>();
const loading = new Map<string, Promise<Sprite | null>>();
const MOST = 600;

/** The art as a picture the canvas can take, at `side` pixels: the SVG with its size written on its root (some engines draw an SVG with no size as nothing). */
export const sized = (svg: string, side: number): string =>
  svg.replace(/<svg\b([^>]*)>/, (_m, attrs: string) => `<svg${attrs.replace(/\s(?:width|height)="[^"]*"/g, '')} width="${side}" height="${side}">`);

const cut = (g: Gem, px: number): Promise<Sprite | null> =>
  new Promise((resolve) => {
    try {
      // the art at its exact size (the sphere is `px` across), in the middle of a canvas of whole pixels
      const art = px * gemBox(g);
      const side = Math.max(2, Math.ceil(art));
      const off = (side - art) / 2;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const img = new Image();
      img.decoding = 'async';
      const done = (ok: boolean) => {
        img.onload = img.onerror = null;
        if (!ok) return resolve(null);
        try {
          const c = document.createElement('canvas');
          c.width = c.height = side;
          const ctx = c.getContext('2d');
          if (!ctx) return resolve(null);
          ctx.drawImage(img, off, off, art, art);
          resolve({ img: c, side });
        } catch {
          resolve(null);
        }
      };
      img.onload = () => done(true);
      img.onerror = () => done(false);
      // a ring is a hairline of the screen's own px, so the art is asked for at the size the Orb is seen at
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized(gemSvg(g, px / dpr), side))}`;
    } catch {
      resolve(null);
    }
  });

/** The sprite for a gem at a diameter of `px` device pixels, if it has been cut already. */
export const spriteNow = (g: Gem, px: number): Sprite | undefined => ready.get(spriteKey(g, px));
/** Cut it (once) and keep it. Null when the art could not be drawn: the caller draws a plain disc. */
export const loadSprite = (g: Gem, px: number): Promise<Sprite | null> => {
  const key = spriteKey(g, px);
  const have = ready.get(key);
  if (have) return Promise.resolve(have);
  let p = loading.get(key);
  if (!p) {
    p = cut(g, px).then((s) => {
      loading.delete(key);
      if (s) {
        if (ready.size >= MOST) ready.clear();
        ready.set(key, s);
      }
      return s;
    });
    loading.set(key, p);
  }
  return p;
};

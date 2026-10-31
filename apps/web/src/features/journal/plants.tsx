import { motion } from 'motion/react';

/**
 * The garden's plants (after One Year): line drawings in one ink, on a 24 grid, round-capped like a pen. A day with a
 * memory grows one of them (the same one every time: it is picked from the date); today is the little house.
 */
const P = (d: string) => d;
export const PLANTS: string[][] = [
  // tulip
  [P('M12 22V11'), P('M12 18c-3-.5-4.5-2.5-4.5-5'), P('M12 16c3-.5 4.5-2.5 4.5-5'), P('M8 5l2 2.5L12 5l2 2.5L16 5v3a4 4 0 0 1-8 0z')],
  // daisy
  [P('M12 22V12'), P('M12 18c-2 0-3.5-1-4-3'), P('M12 4.5a1.8 1.8 0 1 1 0 .01'), P('M12 8.3a1.7 1.7 0 1 0 .01 0'), P('M12 4.6c-1.4-2.4 1.4-2.4 0 0M12 11.4c-1.4 2.4 1.4 2.4 0 0M8.6 8c-2.4-1.4-2.4 1.4 0 0M15.4 8c2.4-1.4 2.4 1.4 0 0')],
  // sprout
  [P('M12 22v-9'), P('M12 15c0-3.5-3-5.5-6.5-5.5 0 3.5 3 5.5 6.5 5.5z'), P('M12 13c0-3.5 3-5.5 6.5-5.5 0 3.5-3 5.5-6.5 5.5z')],
  // two mushrooms
  [P('M3.5 15a5 4.5 0 0 1 10 0z'), P('M7 15v5a1.6 1.6 0 0 0 3.2 0v-5'), P('M13.5 18a3.5 3 0 0 1 7 0z'), P('M16 18v3h2v-3'), P('M6.5 12.5h.01M10 12h.01')],
  // sunflower
  [P('M12 22V13'), P('M12 18c2.5 0 4-1.5 4.5-3.5'), P('M12 5.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z'), P('M12 2.5v1.5M12 12v1.5M7 8h1.5M15.5 8H17M8.5 4.5l1 1M14.5 10.5l1 1M15.5 4.5l-1 1M9.5 10.5l-1 1')],
  // fern
  [P('M12 22C12 15 13 8 16 3'), P('M12.4 18l-3.4-1.5M12.6 15l-3.6-2M13 12l-3-2.5M13.8 9l-2.6-2.6'), P('M12.6 17l3.4-2M13 14l3.5-2.4M13.6 11l3-2.6M14.6 8l2.4-2.4')],
  // cactus
  [P('M10 22V8a2 2 0 0 1 4 0v14'), P('M10 15H7.5a1.5 1.5 0 0 1-1.5-1.5V11'), P('M14 13h2.5a1.5 1.5 0 0 0 1.5-1.5V8.5'), P('M7 22h10')],
  // rose
  [P('M12 22v-9'), P('M12 18c2.5 0 3.5-1.5 3.5-3'), P('M12 11.5a4 4 0 1 1 4-4c0 2.2-1.8 4-4 4z'), P('M12 9a1.5 1.5 0 1 1 1.5-1.5'), P('M9.5 5.5c1.5.5 2.5 1 2.5 2')],
  // cherries
  [P('M8.5 15.5a2.5 2.5 0 1 1 0 .01'), P('M15.5 17.5a2.5 2.5 0 1 1 0 .01'), P('M8.5 13c0-4 2-7 6-9.5M15.5 15c0-4-1-7-1-11'), P('M14.5 3.5c1.5-1 3.5-1 4.5.5-1.5 1-3.5 1-4.5-.5z')],
  // lavender
  [P('M12 22V9'), P('M12 4.5c-1 .5-1 1.5 0 2 1-.5 1-1.5 0-2zM12 7.5c-1.2.5-1.2 1.6 0 2.1 1.2-.5 1.2-1.6 0-2.1z'), P('M9.5 6.5c-.8.6-.6 1.6.4 1.9.6-.7.4-1.6-.4-1.9zM14.5 6.5c.8.6.6 1.6-.4 1.9-.6-.7-.4-1.6.4-1.9z'), P('M12 16c-2 0-3-1-3.5-2.5')],
  // grass
  [P('M6 22c1-4.5 1-8-.5-11'), P('M10 22c0-6 .5-10 2.5-14'), P('M14 22c0-5-1-9-3-12'), P('M18 22c-.5-4 0-7.5 2-10')],
  // clover
  [P('M12 22v-9'), P('M12 13a2.6 2.6 0 1 1-2.2-4 2.6 2.6 0 1 1 4.4 0 2.6 2.6 0 1 1-2.2 4z'), P('M12 17c1.5 0 3-1 3.5-2.5')],
  // bellflower
  [P('M6 22c0-9 3-14 8-17'), P('M9.5 10c1.5-1 3.5-1 4.5.5L14 13c-1.5.8-3.5.8-4.5 0z'), P('M13.5 5.5c1.5-.6 3-.2 3.6 1.2l.2 2.2c-1.2.5-2.6.4-3.4-.4z')],
  // pine
  [P('M12 3l-4 6h2.5l-3.5 5h3l-3 5h10l-3-5h3l-3.5-5H16z'), P('M12 19v3')],
];
export const HOUSE: string[] = ['M4.5 11.5L12 5l7.5 6.5', 'M6.5 10v11h11V10', 'M10.5 21v-4.5h3V21', 'M12 9.2a1.4 1.4 0 1 1 0 .01', 'M9 3.5h6'];

/** A date's plant: the same one every time, spread across the set. */
export const plantOf = (date: string): number => {
  let h = 2166136261;
  for (let i = 0; i < date.length; i++) h = Math.imul(h ^ date.charCodeAt(i), 16777619);
  return Math.abs(h) % PLANTS.length;
};

/** A plant, or the house. `draw` grows it stroke by stroke (the moment a memory is planted). */
export const Plant = ({ date, house, size = 22, draw, className = '' }: { date: string; house?: boolean; size?: number; draw?: boolean; className?: string }) => {
  const paths = house ? HOUSE : PLANTS[plantOf(date)]!;
  return (
    <svg className={`plant ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d, i) =>
        draw ? <motion.path key={i} d={d} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.55, delay: 0.12 * i, ease: [0.22, 1, 0.36, 1] }} /> : <path key={i} d={d} />,
      )}
    </svg>
  );
};

/** The hand-drawn circle with a plus: where a memory can be planted. */
export const PlantButtonGlyph = () => (
  <svg className="plant-plus" width={56} height={56} viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
    <path d="M30 6.5c11 .8 19.5 9.6 19 21-.5 11.6-10 20.8-21.6 20.4C16 47.5 6.6 38.2 7.1 26.5 7.6 15 16.4 6.6 27.6 6.8c3.2 0 6 .8 8.4 2" />
    <path d="M28 18.5v19M18.5 28h19" />
  </svg>
);

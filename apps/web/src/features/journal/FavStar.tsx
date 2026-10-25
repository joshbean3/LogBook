import type * as React from 'react';
import { Star } from 'lucide-react';
import { motion, useMotionValue } from 'motion/react';
import { useLayoutEffect, useRef } from 'react';
import { popFav } from './feel';

/**
 * The favourite star. When `on` turns true after it mounted (a favourite made here: a swipe, a sheet's button, a menu), it
 * pops on `springs.complete` and `toggle` fires on the apex frame (`popFav`). Un-favouriting is silent and still (§11.4).
 * `always` keeps an outlined star in place while off (a button's icon); otherwise nothing renders while off.
 */
export const FavStar = ({ on, size = 11, always, className = 'jfav', label }: { on: boolean; size?: number; always?: boolean; className?: string; label?: string }): React.JSX.Element | null => {
  const scale = useMotionValue(1);
  const was = useRef(on);
  useLayoutEffect(() => {
    if (on && !was.current) popFav(scale);
    was.current = on;
  }, [on, scale]);
  if (!on && !always) return null;
  return (
    <motion.span className={`fav-star ${className}`} style={{ scale, display: 'inline-flex' }} aria-label={label} aria-hidden={label ? undefined : true}>
      <Star size={size} fill={on ? 'currentColor' : 'none'} />
    </motion.span>
  );
};

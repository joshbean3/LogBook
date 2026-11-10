import type * as React from 'react';
import { motion, useMotionValue } from 'motion/react';
import { useLayoutEffect, useRef } from 'react';
import { FavoriteIcon } from '@/ui/icons';
import { popFav } from './feel';

/**
 * The Favorite mark: the set's heart (guide 7, plan 5.4; the component keeps its old name), Deep Sky when on. When `on`
 * turns true after it mounted (a favorite made here: a swipe, a sheet's button, a menu), it pops on `springs.complete` and `toggle` fires on the apex frame (`popFav`). Un-favoriting is silent and still (§11.4).
 * `always` keeps an outlined heart in place while off (a button's icon); otherwise nothing renders while off.
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
      <FavoriteIcon size={size} fill={on ? 'currentColor' : 'none'} />
    </motion.span>
  );
};

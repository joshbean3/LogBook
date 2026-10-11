import { animate, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

/** A number that eases to its new value instead of jumping. */
export const AnimatedNumber = ({ value, format = (v) => String(Math.round(v)) }: { value: number; format?: (v: number) => string }) => {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const last = useRef(value);
  useEffect(() => {
    if (reduce || !Number.isFinite(value) || !Number.isFinite(last.current)) {
      setShown(value);
      last.current = value;
      return;
    }
    const ctl = animate(last.current, value, { duration: 0.5, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setShown(v) });
    last.current = value;
    return () => ctl.stop();
  }, [value, reduce]);
  return <>{format(shown)}</>;
};

import { useEffect, useRef } from 'react';

/**
 * Run `fn` (as it stood on the last render) when the component goes away. A field in a sheet saves on blur, and a sheet
 * flicked down takes its field with it without a blur: this is where what was typed is saved then.
 */
export const useOnLeave = (fn: () => void): void => {
  const latest = useRef(fn);
  latest.current = fn;
  useEffect(() => () => latest.current(), []);
};

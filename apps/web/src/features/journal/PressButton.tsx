import type * as React from 'react';
import { usePress } from '@/ui';

/**
 * A row's button with the one press (§11.1): `data-pressed` on pointerdown, the row shows `--surface-2` (press="surface"),
 * text verbs dim (press="dim"). For the plain buttons inside WP6's rows (entries, quotes, a day's entries), where a
 * `Pressable` would add its own semantics; a swipe row that captures the pointer ends the press at once (`usePress`).
 */
export const PressButton = ({ press = 'surface', className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { press?: 'surface' | 'dim' | 'scale' }): React.JSX.Element => {
  const p = usePress({ disabled: rest.disabled });
  return <button type="button" className={`${className} pressable`.trim()} data-press={press} {...p.handlers} {...rest} />;
};

import type * as React from 'react';
import { forwardRef } from 'react';
import { usePress } from '@/ui/usePress';

/**
 * A plain `<button>` with the one press (docs/feel.md §11.1, M33): `data-pressed` written on touch-down by WP1's `usePress`,
 * the CSS scale (or surface) from it, never `:active` (which iOS does not show on touch-down; code review 1 #9). For the
 * session sheet's verbs and pills and the editor's chips, which keep their own button semantics (`aria-pressed`, `role`).
 */
export const PressButton = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { press?: 'scale' | 'surface' | 'dim' }>(function PressButton({ press = 'scale', className, ...rest }, ref) {
  const p = usePress({ disabled: !!rest.disabled });
  return <button ref={ref} type="button" {...rest} {...p.handlers} className={`pressable ${className ?? ''}`} data-press={press} />;
});

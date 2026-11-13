import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { startOrbs } from './engine';

/**
 * Orbs' reconciler, mounted once in the shell (app/Shell.tsx). It draws nothing and returns nothing: it listens to the
 * caches and keeps the Orbs store in step with what the person has done (engine.ts), and tells `window` what was gained
 * (`logbook:orbs-gained`). Screens read the store through the selectors in store.ts.
 */
export const useReconcile = (): void => {
  const qc = useQueryClient();
  useEffect(() => startOrbs(qc), [qc]);
};

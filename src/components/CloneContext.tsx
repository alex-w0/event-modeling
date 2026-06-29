import { createContext, useContext } from 'react';

/**
 * Duplicates the given nodes (and the arrows between them) — implemented in
 * Board, called from the per-node copy buttons. A slice id brings its children
 * along; see lib/clone.ts for the full behavior.
 */
const CloneContext = createContext<(ids: string[]) => void>(() => undefined);

export function useDuplicateNodes(): (ids: string[]) => void {
  return useContext(CloneContext);
}

export const CloneProvider = CloneContext.Provider;

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface FlowTraceApi {
  /** The element a flow trace is playing from, or null when no trace is active. */
  originId: string | null;
  /** Starts a trace from `id`; clicking the active origin again stops it. */
  toggleTrace: (id: string) => void;
  stopTrace: () => void;
}

const FlowTraceApiContext = createContext<FlowTraceApi | null>(null);

export function useFlowTrace(): FlowTraceApi {
  const api = useContext(FlowTraceApiContext);
  if (!api) throw new Error('useFlowTrace must be used inside <FlowTraceProvider>');
  return api;
}

/** Owns which element (if any) a flow trace is currently playing from. */
export function FlowTraceProvider({ children }: { children: ReactNode }) {
  const [originId, setOriginId] = useState<string | null>(null);

  const toggleTrace = useCallback((id: string) => {
    setOriginId((current) => (current === id ? null : id));
  }, []);
  const stopTrace = useCallback(() => setOriginId(null), []);

  const api = useMemo<FlowTraceApi>(() => ({ originId, toggleTrace, stopTrace }), [originId, toggleTrace, stopTrace]);

  return <FlowTraceApiContext.Provider value={api}>{children}</FlowTraceApiContext.Provider>;
}

/**
 * The node ids in the active flow trace (origin + downstream), computed in
 * Board (see lib/highlight.ts) and read per-node in CqrsNode for the pulse.
 */
const TracedNodesContext = createContext<ReadonlySet<string>>(new Set());

export function useTracedNodes(): ReadonlySet<string> {
  return useContext(TracedNodesContext);
}

export const TracedNodesProvider = TracedNodesContext.Provider;

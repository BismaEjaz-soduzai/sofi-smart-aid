import { createContext, useContext, ReactNode } from "react";
import { useCallSignal } from "@/hooks/useCallSignal";

type CallSignal = ReturnType<typeof useCallSignal>;

const CallContext = createContext<CallSignal | null>(null);

export function CallProvider({ children }: { children: ReactNode }) {
  // roomId is no longer per-room since the provider is global; the active call
  // already carries its own room URL. Pass an empty string — startCall callers
  // that need a specific roomId can build their own URL or reuse callUrl.
  const call = useCallSignal("global");
  return <CallContext.Provider value={call}>{children}</CallContext.Provider>;
}

export function useCallContext(): CallSignal {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCallContext must be used inside <CallProvider>");
  return ctx;
}

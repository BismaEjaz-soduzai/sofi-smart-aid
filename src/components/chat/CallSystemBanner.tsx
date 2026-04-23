import { Phone } from "lucide-react";

/**
 * Shared parser + renderer for system messages that embed a call URL using
 * the `||CALL_URL:` convention. Used in both ChatRooms and SmartWorkspace
 * so the green Join banner is identical everywhere.
 */
export function parseCallSystemMessage(content: string): {
  isCall: boolean;
  displayText: string;
  callUrl: string | null;
} {
  if (!content || !content.includes("||CALL_URL:")) {
    return { isCall: false, displayText: content, callUrl: null };
  }
  const [displayText, callPart] = content.split("||CALL_URL:");
  const callUrl = (callPart || "").trim() || null;
  return { isCall: !!callUrl, displayText: (displayText || "").trim(), callUrl };
}

interface CallSystemBannerProps {
  callerName: string;
  displayText: string;
  callUrl: string;
  onJoin: (callUrl: string) => void;
  variant?: "wide" | "inline";
}

export function CallSystemBanner({
  callerName,
  displayText,
  callUrl,
  onJoin,
  variant = "wide",
}: CallSystemBannerProps) {
  if (variant === "inline") {
    return (
      <div className="flex items-center justify-center gap-2 py-1">
        <span className="text-[11px] text-foreground bg-success/10 border border-success/20 rounded-full px-3 py-1 flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          {displayText}
        </span>
        <button
          onClick={() => onJoin(callUrl)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-success text-success-foreground text-[11px] font-semibold hover:opacity-90 transition-opacity"
        >
          <Phone className="w-3 h-3" /> Join Call
        </button>
      </div>
    );
  }
  return (
    <div className="flex justify-center">
      <div className="flex items-center justify-between gap-3 bg-success/5 border border-success/20 rounded-2xl px-4 py-3 w-full max-w-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{callerName}</p>
            <p className="text-[11px] text-muted-foreground truncate">{displayText}</p>
          </div>
        </div>
        <button
          onClick={() => onJoin(callUrl)}
          className="text-xs font-semibold bg-success text-success-foreground hover:opacity-90 rounded-full px-3 py-1.5 transition-opacity flex-shrink-0 flex items-center gap-1"
        >
          <Phone className="w-3 h-3" /> Join Call
        </button>
      </div>
    </div>
  );
}

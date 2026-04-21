import { useEffect, useRef } from "react";
import { ExternalLink, Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface JitsiCallPanelProps {
  roomName: string;
  callUrl: string;
  isVideo: boolean;
  displayName: string;
  onClose: () => void;
}

/**
 * Lightweight call bar — auto-opens the Jitsi call in a new tab/window the
 * first time it mounts, then shows a small "in call" status strip with
 * Re-open / End buttons. Keeps SOFI free of embedded iframes per user request.
 */
export default function JitsiCallPanel({
  roomName,
  callUrl,
  isVideo,
  displayName,
  onClose,
}: JitsiCallPanelProps) {
  const openedRef = useRef(false);

  // Build URL with prejoin disabled and identity prefilled
  const params = new URLSearchParams({ "userInfo.displayName": displayName });
  const config = [
    "config.prejoinPageEnabled=false",
    "config.disableDeepLinking=true",
    `config.startWithVideoMuted=${isVideo ? "false" : "true"}`,
    "interfaceConfig.MOBILE_APP_PROMO=false",
  ].join("&");
  const launchUrl = `${callUrl}#${config}&${params.toString()}`;

  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    window.open(launchUrl, "_blank", "noopener,noreferrer");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="border-b border-border bg-card/60 flex-shrink-0">
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          <Phone className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="font-medium text-foreground">In call:</span>
          <span className="font-mono truncate">{roomName}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button asChild size="sm" variant="outline" className="h-7 text-[11px] gap-1">
            <a href={launchUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3 h-3" /> Re-open
            </a>
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} className="h-7 w-7 p-0">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

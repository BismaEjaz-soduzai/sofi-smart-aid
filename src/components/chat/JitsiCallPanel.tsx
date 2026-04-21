import { useEffect, useRef } from "react";
import { ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface JitsiCallPanelProps {
  roomName: string;
  callUrl: string;
  isVideo: boolean;
  displayName: string;
  onClose: () => void;
}

/**
 * Embedded Jitsi call panel — uses the public meet.jit.si iframe so the user
 * never leaves SOFI during a call. Falls back to "Open in new tab".
 *
 * We pre-fill the display name and (for voice calls) start with video muted
 * via URL hash config so users don't need to log in or configure each call.
 */
export default function JitsiCallPanel({
  roomName,
  callUrl,
  isVideo,
  displayName,
  onClose,
}: JitsiCallPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Build iframe URL with prejoin disabled and identity prefilled
  const params = new URLSearchParams({
    "userInfo.displayName": displayName,
  });
  const config: string[] = [
    "config.prejoinPageEnabled=false",
    "config.disableDeepLinking=true",
    "config.startWithAudioMuted=false",
    `config.startWithVideoMuted=${isVideo ? "false" : "true"}`,
    "interfaceConfig.MOBILE_APP_PROMO=false",
    "interfaceConfig.SHOW_JITSI_WATERMARK=false",
    "interfaceConfig.SHOW_BRAND_WATERMARK=false",
    "interfaceConfig.DISABLE_VIDEO_BACKGROUND=false",
  ];
  const src = `${callUrl}#${config.join("&")}&${params.toString()}`;

  useEffect(() => {
    // Defensive: if the iframe somehow blocks, surface a fallback message via console
    const t = window.setTimeout(() => {
      // no-op; iframe load timing varies
    }, 8000);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="border-b border-border bg-background flex-shrink-0">
      <div className="flex items-center justify-between px-4 py-2 bg-card/60">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          <span className="font-medium text-foreground">In call:</span>
          <span className="font-mono">{roomName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button asChild size="sm" variant="ghost" className="h-7 text-[11px] gap-1">
            <a href={callUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3 h-3" /> New tab
            </a>
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} className="h-7 w-7 p-0">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      <div className="w-full h-[480px] bg-black">
        <iframe
          ref={iframeRef}
          src={src}
          allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
          className="w-full h-full border-0"
          title="SOFI call"
        />
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  Monitor, MonitorOff, Minimize2, Maximize2, GripHorizontal, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface VideoCallOverlayProps {
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  memberNames: Map<string, string>;
  callDuration: number;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onStartScreenShare: () => void;
  onStopScreenShare: () => void;
  onEndCall: () => void;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function VideoTile({ stream, label, muted = false }: { stream: MediaStream; label: string; muted?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="relative bg-muted rounded-xl overflow-hidden aspect-video">
      <video ref={videoRef} autoPlay playsInline muted={muted} className="w-full h-full object-cover" />
      {label && (
        <div className="absolute bottom-2 left-2 bg-background/70 backdrop-blur-sm text-foreground text-xs px-2 py-1 rounded-lg">
          {label}
        </div>
      )}
    </div>
  );
}

function useDraggable(initialPos: { x: number; y: number }) {
  const [pos, setPos] = useState(initialPos);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const elRef = useRef<HTMLDivElement>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    const rect = elRef.current?.getBoundingClientRect();
    if (rect) {
      offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const x = Math.max(0, Math.min(window.innerWidth - 288, e.clientX - offset.current.x));
    const y = Math.max(0, Math.min(window.innerHeight - 200, e.clientY - offset.current.y));
    setPos({ x, y });
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return { pos, elRef, onPointerDown, onPointerMove, onPointerUp };
}

export default function VideoCallOverlay({
  localStream, screenStream, remoteStreams,
  isAudioEnabled, isVideoEnabled, isScreenSharing, memberNames,
  callDuration,
  onToggleAudio, onToggleVideo, onStartScreenShare, onStopScreenShare, onEndCall,
}: VideoCallOverlayProps) {
  const [minimized, setMinimized] = useState(false);
  const displayStream = screenStream || localStream;
  const remoteEntries = Array.from(remoteStreams.entries());
  const gridCols = remoteEntries.length <= 1 ? "grid-cols-1" : remoteEntries.length <= 4 ? "grid-cols-2" : "grid-cols-3";

  const { pos, elRef, onPointerDown, onPointerMove, onPointerUp } = useDraggable({
    x: window.innerWidth - 300,
    y: window.innerHeight - 280,
  });

  if (minimized) {
    return (
      <div
        ref={elRef}
        style={{ left: pos.x, top: pos.y }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="fixed z-50 w-72 rounded-2xl overflow-hidden shadow-2xl border border-border bg-background/95 backdrop-blur-xl select-none"
      >
        <div
          onPointerDown={onPointerDown}
          className="flex items-center justify-between gap-1 py-1.5 px-3 bg-muted/60 cursor-grab active:cursor-grabbing"
        >
          <GripHorizontal className="w-4 h-4 text-muted-foreground" />
          <span className="text-[10px] font-mono text-muted-foreground">{formatDuration(callDuration)}</span>
        </div>
        <div className="relative">
          {displayStream ? (
            <VideoTile stream={displayStream} label="" muted />
          ) : (
            <div className="aspect-video bg-muted flex items-center justify-center">
              <p className="text-xs text-muted-foreground">In Call</p>
            </div>
          )}
          <div className="absolute top-2 right-2 flex gap-1">
            <Button variant="secondary" size="icon" className="h-7 w-7 rounded-full bg-background/80 backdrop-blur-sm" onClick={() => setMinimized(false)}>
              <Maximize2 className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="absolute top-2 left-2">
            <span className="text-[10px] font-medium bg-destructive/90 text-destructive-foreground px-2 py-0.5 rounded-full animate-pulse">● LIVE</span>
          </div>
        </div>
        <div className="flex items-center justify-center gap-2 p-2 bg-card">
          <Button variant={isAudioEnabled ? "secondary" : "destructive"} size="icon" className="h-8 w-8 rounded-full" onClick={onToggleAudio}>
            {isAudioEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          </Button>
          <Button variant={isVideoEnabled ? "secondary" : "destructive"} size="icon" className="h-8 w-8 rounded-full" onClick={onToggleVideo}>
            {isVideoEnabled ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
          </Button>
          <Button variant="destructive" size="icon" className="h-8 w-8 rounded-full" onClick={onEndCall}>
            <PhoneOff className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col">
      {/* Call info bar */}
      <div className="flex items-center justify-center gap-3 py-2 border-b border-border bg-card/40">
        <span className="text-[10px] font-medium bg-destructive/90 text-destructive-foreground px-2 py-0.5 rounded-full animate-pulse">● LIVE</span>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-mono">{formatDuration(callDuration)}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {remoteEntries.length + 1} participant{remoteEntries.length !== 0 ? "s" : ""}
        </span>
      </div>

      <div className="flex-1 p-4 overflow-auto">
        <div className={`grid ${gridCols} gap-3 max-w-5xl mx-auto h-full`}>
          {displayStream && <VideoTile stream={displayStream} label={isScreenSharing ? "Your Screen" : "You"} muted />}
          {remoteEntries.map(([peerId, stream]) => (
            <VideoTile key={peerId} stream={stream} label={memberNames.get(peerId) || "Participant"} />
          ))}
          {remoteEntries.length === 0 && (
            <div className="flex items-center justify-center bg-muted rounded-xl aspect-video">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Waiting for others to join...</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Share the invite code so others can join the call</p>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-center gap-3 p-4 border-t border-border">
        <Button variant="secondary" size="icon" className="h-12 w-12 rounded-full" onClick={() => setMinimized(true)}>
          <Minimize2 className="w-5 h-5" />
        </Button>
        <Button variant={isAudioEnabled ? "secondary" : "destructive"} size="icon" className="h-12 w-12 rounded-full" onClick={onToggleAudio}>
          {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </Button>
        <Button variant={isVideoEnabled ? "secondary" : "destructive"} size="icon" className="h-12 w-12 rounded-full" onClick={onToggleVideo}>
          {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </Button>
        <Button variant={isScreenSharing ? "default" : "secondary"} size="icon" className="h-12 w-12 rounded-full" onClick={isScreenSharing ? onStopScreenShare : onStartScreenShare}>
          {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
        </Button>
        <Button variant="destructive" size="icon" className="h-12 w-12 rounded-full" onClick={onEndCall}>
          <PhoneOff className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}

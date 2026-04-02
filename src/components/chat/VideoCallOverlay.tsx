import { useEffect, useRef } from "react";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  Monitor, MonitorOff
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
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onStartScreenShare: () => void;
  onStopScreenShare: () => void;
  onEndCall: () => void;
}

function VideoTile({ stream, label, muted = false }: { stream: MediaStream; label: string; muted?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative bg-muted rounded-xl overflow-hidden aspect-video">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-2 left-2 bg-background/70 backdrop-blur-sm text-foreground text-xs px-2 py-1 rounded-lg">
        {label}
      </div>
    </div>
  );
}

export default function VideoCallOverlay({
  localStream,
  screenStream,
  remoteStreams,
  isAudioEnabled,
  isVideoEnabled,
  isScreenSharing,
  memberNames,
  onToggleAudio,
  onToggleVideo,
  onStartScreenShare,
  onStopScreenShare,
  onEndCall,
}: VideoCallOverlayProps) {
  const displayStream = screenStream || localStream;
  const remoteEntries = Array.from(remoteStreams.entries());
  const gridCols = remoteEntries.length <= 1 ? "grid-cols-1" : remoteEntries.length <= 4 ? "grid-cols-2" : "grid-cols-3";

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col">
      {/* Video grid */}
      <div className="flex-1 p-4 overflow-auto">
        <div className={`grid ${gridCols} gap-3 max-w-5xl mx-auto h-full`}>
          {/* Local video */}
          {displayStream && (
            <VideoTile
              stream={displayStream}
              label={isScreenSharing ? "Your Screen" : "You"}
              muted
            />
          )}

          {/* Remote videos */}
          {remoteEntries.map(([peerId, stream]) => (
            <VideoTile
              key={peerId}
              stream={stream}
              label={memberNames.get(peerId) || "Participant"}
            />
          ))}

          {/* Placeholder when no remote */}
          {remoteEntries.length === 0 && (
            <div className="flex items-center justify-center bg-muted rounded-xl aspect-video">
              <p className="text-sm text-muted-foreground">Waiting for others to join...</p>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 p-4 border-t border-border">
        <Button
          variant={isAudioEnabled ? "secondary" : "destructive"}
          size="icon"
          className="h-12 w-12 rounded-full"
          onClick={onToggleAudio}
        >
          {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </Button>

        <Button
          variant={isVideoEnabled ? "secondary" : "destructive"}
          size="icon"
          className="h-12 w-12 rounded-full"
          onClick={onToggleVideo}
        >
          {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </Button>

        <Button
          variant={isScreenSharing ? "default" : "secondary"}
          size="icon"
          className="h-12 w-12 rounded-full"
          onClick={isScreenSharing ? onStopScreenShare : onStartScreenShare}
        >
          {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
        </Button>

        <Button
          variant="destructive"
          size="icon"
          className="h-12 w-12 rounded-full"
          onClick={onEndCall}
        >
          <PhoneOff className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}

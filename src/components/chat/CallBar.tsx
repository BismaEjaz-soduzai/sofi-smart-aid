import { motion } from "framer-motion";
import { Circle, PhoneOff, Video, Phone, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CallBarProps {
  callUrl: string;
  isVideo: boolean;
  startedBy: string;
  elapsed: number;
  isRecording: boolean;
  recordingTime: number;
  formatRecTime: (s: number) => string;
  onReopen?: () => void;
  onEnd: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function CallBar({
  isVideo,
  startedBy,
  elapsed,
  isRecording,
  recordingTime,
  formatRecTime,
  onReopen,
  onEnd,
  onStartRecording,
  onStopRecording,
}: CallBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex items-center gap-3 px-4 py-2 border-b border-border bg-success/5 backdrop-blur-sm flex-shrink-0"
    >
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-ping" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
        </span>
        <span className="text-[11px] font-bold tracking-wider text-success">LIVE</span>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-foreground">
        {isVideo ? <Video className="w-3.5 h-3.5 text-success" /> : <Phone className="w-3.5 h-3.5 text-success" />}
        <span className="font-medium">{startedBy}</span>
        <span className="text-muted-foreground">·</span>
        <span className="font-mono text-muted-foreground">{fmt(elapsed)}</span>
      </div>

      {isRecording && (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <Circle className="w-2.5 h-2.5 fill-destructive text-destructive animate-pulse" />
          <span className="font-mono font-medium">REC {formatRecTime(recordingTime)}</span>
        </div>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        {isRecording ? (
          <Button size="sm" variant="outline" onClick={onStopRecording} className="h-7 text-[11px] gap-1">
            <Square className="w-3 h-3" /> Stop Rec
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onStartRecording} className="h-7 text-[11px] gap-1">
            <Circle className="w-3 h-3" /> Record
          </Button>
        )}
        <Button size="sm" variant="destructive" onClick={onEnd} className="h-7 text-[11px] gap-1">
          <PhoneOff className="w-3 h-3" /> End
        </Button>
      </div>
    </motion.div>
  );
}

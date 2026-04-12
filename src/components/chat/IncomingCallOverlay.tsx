import { useEffect } from "react";
import { motion } from "framer-motion";
import { Phone, PhoneOff, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { playRingtone, showBrowserNotification } from "@/lib/notificationSounds";
import type { IncomingCall } from "@/hooks/useWebRTC";

interface IncomingCallOverlayProps {
  call: IncomingCall;
  onAccept: () => void;
  onReject: () => void;
}

export default function IncomingCallOverlay({ call, onAccept, onReject }: IncomingCallOverlayProps) {
  // Play ringtone loop + browser notification
  useEffect(() => {
    const stopRingtone = playRingtone();
    showBrowserNotification(
      `${call.fromName} is calling`,
      `Incoming ${call.isVideo ? "video" : "voice"} call`,
      "incoming-call"
    );
    return stopRingtone;
  }, [call]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-xl"
    >
      <div className="flex flex-col items-center gap-6 p-8">
        <div className="relative">
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute inset-0 rounded-full bg-primary/20"
            style={{ width: 120, height: 120, top: -10, left: -10 }}
          />
          <Avatar className="w-24 h-24 border-4 border-primary/30">
            <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
              {call.fromName[0]?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground">{call.fromName}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Incoming {call.isVideo ? "Video" : "Voice"} Call...
          </p>
        </div>

        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="flex items-center gap-1 text-muted-foreground"
        >
          {call.isVideo ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
          <span className="text-xs">Ringing...</span>
        </motion.div>

        <div className="flex items-center gap-8 mt-4">
          <div className="flex flex-col items-center gap-2">
            <Button variant="destructive" size="icon" className="h-16 w-16 rounded-full shadow-lg" onClick={onReject}>
              <PhoneOff className="w-6 h-6" />
            </Button>
            <span className="text-xs text-muted-foreground">Decline</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 1 }}>
              <Button size="icon" className="h-16 w-16 rounded-full bg-success hover:bg-success/90 text-success-foreground shadow-lg" onClick={onAccept}>
                <Phone className="w-6 h-6" />
              </Button>
            </motion.div>
            <span className="text-xs text-muted-foreground">Accept</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

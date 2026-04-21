import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";

interface VoiceMicButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
  size?: "sm" | "md";
}

/**
 * Web Speech API mic button — appends the recognised transcript via onTranscript.
 * Falls back gracefully if the browser doesn't support SpeechRecognition.
 */
export default function VoiceMicButton({ onTranscript, className = "", size = "sm" }: VoiceMicButtonProps) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      try { recognitionRef.current?.stop(); } catch { /* noop */ }
    };
  }, []);

  const toggle = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Voice input isn't supported in this browser");
      return;
    }
    if (listening) {
      try { recognitionRef.current?.stop(); } catch { /* noop */ }
      setListening(false);
      return;
    }
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      const text = Array.from(event.results)
        .map((r: any) => r[0]?.transcript || "")
        .join(" ")
        .trim();
      if (text) onTranscript(text);
    };
    recognition.onerror = (e: any) => {
      if (e.error !== "no-speech" && e.error !== "aborted") {
        toast.error(`Voice input failed: ${e.error}`);
      }
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const sizeClass = size === "md" ? "w-10 h-10" : "w-8 h-8";
  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? "Stop dictation" : "Voice to text"}
      className={`${sizeClass} rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${
        listening
          ? "bg-destructive/15 text-destructive animate-pulse"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      } ${className}`}
    >
      {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
    </button>
  );
}

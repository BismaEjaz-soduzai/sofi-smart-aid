import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useFocusTimerOptional } from "@/contexts/FocusTimerContext";
import { Trophy, Play, X } from "lucide-react";

export default function FocusCompletionModal() {
  const ctx = useFocusTimerOptional();
  if (!ctx) return null;
  const { showCompletion, dismissCompletion, startAgain, duration, sessionType } = ctx;

  return (
    <Dialog open={showCompletion} onOpenChange={(o) => { if (!o) dismissCompletion(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Trophy className="w-7 h-7 text-primary" />
          </div>
          <DialogTitle className="text-center">Session complete! 🎉</DialogTitle>
          <DialogDescription className="text-center">
            Great work — you finished a {duration}-min {sessionType.toLowerCase()}. Keep the streak alive?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row gap-2 sm:justify-center">
          <Button variant="outline" onClick={dismissCompletion} className="flex-1">
            <X className="w-4 h-4 mr-1" /> Quit
          </Button>
          <Button onClick={startAgain} className="flex-1">
            <Play className="w-4 h-4 mr-1" /> Start again
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

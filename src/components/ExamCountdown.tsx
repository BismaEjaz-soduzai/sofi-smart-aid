import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, GraduationCap, Plus, X } from "lucide-react";
import { differenceInCalendarDays, format } from "date-fns";

interface Exam {
  id: string;
  subject: string;
  date: string; // ISO yyyy-MM-dd
}

const STORAGE_KEY = "sofi-exams";

function loadExams(): Exam[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export default function ExamCountdown() {
  const [open, setOpen] = useState(true);
  const [exams, setExams] = useState<Exam[]>(() => loadExams());
  const [adding, setAdding] = useState(false);
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(exams));
  }, [exams]);

  const sorted = useMemo(
    () => [...exams].sort((a, b) => a.date.localeCompare(b.date)),
    [exams]
  );

  const add = () => {
    if (!subject.trim() || !date) return;
    setExams((p) => [...p, { id: crypto.randomUUID(), subject: subject.trim(), date }]);
    setSubject(""); setDate(""); setAdding(false);
  };

  const remove = (id: string) => setExams((p) => p.filter((e) => e.id !== id));

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Exam Countdown</h3>
          {sorted.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {sorted.length}
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-3 border-t border-border">
              {sorted.length === 0 && !adding && (
                <p className="text-xs text-muted-foreground pt-3">
                  Track upcoming exams and see days remaining at a glance.
                </p>
              )}

              {sorted.length > 0 && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-3">
                  {sorted.map((exam) => (
                    <ExamCard key={exam.id} exam={exam} onRemove={() => remove(exam.id)} />
                  ))}
                </div>
              )}

              {adding ? (
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <input
                    autoFocus
                    placeholder="Subject (e.g. Calculus)"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="flex-1 text-sm bg-muted/40 border border-border rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-ring/30"
                  />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="text-sm bg-muted/40 border border-border rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-ring/30"
                  />
                  <button onClick={add} className="text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90">
                    Add
                  </button>
                  <button onClick={() => { setAdding(false); setSubject(""); setDate(""); }} className="text-sm px-2 py-1.5 rounded-lg border border-border hover:bg-muted">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAdding(true)}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-dashed border-border hover:border-primary hover:text-primary transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Exam
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ExamCard({ exam, onRemove }: { exam: Exam; onRemove: () => void }) {
  const days = differenceInCalendarDays(new Date(exam.date + "T00:00:00"), new Date());
  const isToday = days === 0;
  const tone =
    days < 0 ? "text-muted-foreground border-border bg-muted/30"
    : days === 0 ? "text-destructive border-destructive/30 bg-destructive/10 animate-pulse"
    : days < 7 ? "text-destructive border-destructive/30 bg-destructive/10 animate-pulse"
    : days <= 14 ? "text-warning border-warning/30 bg-warning/10"
    : "text-success border-success/30 bg-success/10";

  return (
    <div className={`relative rounded-xl border px-3 py-3 ${tone} transition-colors`}>
      <button
        onClick={onRemove}
        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full hover:bg-background/50 flex items-center justify-center text-muted-foreground hover:text-foreground"
        aria-label="Remove exam"
      >
        <X className="w-3 h-3" />
      </button>
      <div className="text-xs font-medium text-foreground truncate pr-5">{exam.subject}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        {isToday ? (
          <span className="text-sm font-bold uppercase tracking-wider">Today!</span>
        ) : days < 0 ? (
          <span className="text-sm font-medium">Past</span>
        ) : (
          <>
            <span className="text-2xl font-bold leading-none">{days}</span>
            <span className="text-[10px] uppercase tracking-wider">day{days === 1 ? "" : "s"} left</span>
          </>
        )}
      </div>
      <div className="text-[10px] text-muted-foreground mt-1">
        {format(new Date(exam.date + "T00:00:00"), "EEE, MMM d, yyyy")}
      </div>
    </div>
  );
}

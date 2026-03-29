import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Plus, X, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";

interface TimeBlock {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  category: string;
  date: string;
}

const CATEGORIES = ["Study", "Work", "Personal", "Assignment", "Revision", "Break"];
const CATEGORY_COLORS: Record<string, string> = {
  Study: "bg-primary/10 text-primary border-primary/20",
  Work: "bg-info/10 text-info border-info/20",
  Personal: "bg-warning/10 text-warning border-warning/20",
  Assignment: "bg-destructive/10 text-destructive border-destructive/20",
  Revision: "bg-success/10 text-success border-success/20",
  Break: "bg-muted text-muted-foreground border-border",
};

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6 AM to 9 PM

export default function Planner() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState<"day" | "week">("day");
  const [form, setForm] = useState({ title: "", startTime: "09:00", endTime: "10:00", category: "Study" });

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const dayBlocks = blocks.filter((b) => b.date === format(selectedDate, "yyyy-MM-dd"));

  const addBlock = () => {
    if (!form.title.trim()) return;
    setBlocks((prev) => [...prev, { ...form, id: crypto.randomUUID(), date: format(selectedDate, "yyyy-MM-dd") }]);
    setForm({ title: "", startTime: "09:00", endTime: "10:00", category: "Study" });
    setShowForm(false);
  };

  const removeBlock = (id: string) => setBlocks((prev) => prev.filter((b) => b.id !== id));

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Planner</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Organize your schedule with time blocks</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" /> Add Block
        </button>
      </div>

      {/* View toggle + date nav */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
          {(["day", "week"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all capitalize ${view === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{v}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedDate(addDays(selectedDate, -1))} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-medium text-foreground min-w-[140px] text-center">{format(selectedDate, "EEEE, MMM d")}</span>
          <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Week bar (if week view) */}
      {view === "week" && (
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((d) => {
            const isSelected = isSameDay(d, selectedDate);
            const dayBlockCount = blocks.filter((b) => b.date === format(d, "yyyy-MM-dd")).length;
            return (
              <button key={d.toISOString()} onClick={() => setSelectedDate(d)} className={`p-2 rounded-xl text-center transition-all ${isSelected ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:border-primary/30"}`}>
                <p className={`text-[10px] font-medium ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{format(d, "EEE")}</p>
                <p className={`text-lg font-semibold ${isSelected ? "" : "text-foreground"}`}>{format(d, "d")}</p>
                {dayBlockCount > 0 && <div className={`w-1.5 h-1.5 rounded-full mx-auto mt-1 ${isSelected ? "bg-primary-foreground/60" : "bg-primary"}`} />}
              </button>
            );
          })}
        </div>
      )}

      {/* Timeline */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {HOURS.map((hour) => {
          const timeStr = `${hour.toString().padStart(2, "0")}:00`;
          const hourBlocks = dayBlocks.filter((b) => {
            const startH = parseInt(b.startTime.split(":")[0]);
            return startH === hour;
          });
          return (
            <div key={hour} className="flex border-b border-border last:border-b-0 min-h-[3rem]">
              <div className="w-16 flex-shrink-0 p-2 text-xs text-muted-foreground font-medium border-r border-border flex items-start justify-end pr-3 pt-2">
                {format(new Date(2024, 0, 1, hour), "h a")}
              </div>
              <div className="flex-1 p-1.5 space-y-1">
                {hourBlocks.map((block) => {
                  const colorClass = CATEGORY_COLORS[block.category] || CATEGORY_COLORS.Break;
                  return (
                    <motion.div key={block.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${colorClass}`}>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{block.title}</p>
                        <p className="text-[10px] opacity-70">{block.startTime} – {block.endTime} · {block.category}</p>
                      </div>
                      <button onClick={() => removeBlock(block.id)} className="text-current opacity-40 hover:opacity-100 transition-opacity flex-shrink-0 ml-2"><X className="w-3.5 h-3.5" /></button>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {dayBlocks.length === 0 && (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"><Calendar className="w-5 h-5 text-muted-foreground" /></div>
          <p className="text-sm font-medium text-foreground">No blocks scheduled</p>
          <p className="text-xs text-muted-foreground mt-1">Add time blocks to plan your day</p>
        </div>
      )}

      {/* Add block form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4 shadow-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-foreground">Add Time Block</h3>
                <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Title</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Study React" className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Start</label>
                    <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">End</label>
                    <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Category</label>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map((c) => (
                      <button key={c} onClick={() => setForm({ ...form, category: c })} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${form.category === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{c}</button>
                    ))}
                  </div>
                </div>
              </div>

              <button onClick={addBlock} disabled={!form.title.trim()} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity">
                Add Block
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

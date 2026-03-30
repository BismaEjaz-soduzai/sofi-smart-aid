import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Sparkles, BookOpen, GraduationCap, Rocket, Briefcase,
  Presentation, Library, X, Calendar, Target, TrendingUp,
  CheckCircle2, Clock, MoreHorizontal, Trash2, ChevronRight,
  Loader2, Send,
} from "lucide-react";
import { usePlans, useCreatePlan, useDeletePlan, useUpdatePlan, usePlanSessions, useCreateSession, useToggleSession, type Plan, type PlanInsert } from "@/hooks/usePlans";
import { format } from "date-fns";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-chat`;

const TEMPLATES = [
  { emoji: "📘", title: "2-Month Test Prep", goal: "Prepare for final exams", category: "exam", color: "blue", duration: "2 months" },
  { emoji: "📝", title: "Weekly Study Plan", goal: "Organize weekly study sessions", category: "study", color: "teal", duration: "1 week" },
  { emoji: "🎓", title: "Exam Countdown", goal: "Day-by-day exam preparation", category: "exam", color: "purple", duration: "2 weeks" },
  { emoji: "🚀", title: "FYP Work Plan", goal: "Structure FYP deliverables", category: "project", color: "orange", duration: "3 months" },
  { emoji: "💼", title: "Assignment Plan", goal: "Complete assignment step-by-step", category: "assignment", color: "green", duration: "1 week" },
  { emoji: "🎤", title: "Presentation Prep", goal: "Prepare presentation slides & speech", category: "personal", color: "pink", duration: "3 days" },
  { emoji: "📚", title: "7-Day Revision Sprint", goal: "Intensive revision period", category: "study", color: "teal", duration: "7 days" },
];

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  study: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20" },
  exam: { bg: "bg-info/10", text: "text-info", border: "border-info/20" },
  assignment: { bg: "bg-success/10", text: "text-success", border: "border-success/20" },
  project: { bg: "bg-warning/10", text: "text-warning", border: "border-warning/20" },
  personal: { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/20" },
};

const COLOR_OPTIONS = [
  { value: "blue", class: "bg-primary" },
  { value: "teal", class: "bg-primary" },
  { value: "purple", class: "bg-info" },
  { value: "green", class: "bg-success" },
  { value: "orange", class: "bg-warning" },
  { value: "pink", class: "bg-destructive" },
];

const EMOJI_OPTIONS = ["📘", "📝", "🎓", "🚀", "💼", "🎤", "📚", "🧠", "⚡", "🎯", "💡", "🔥"];

const SUGGESTED_AI_PROMPTS = [
  "Make me a 2-month study plan for Software Testing",
  "Create a weekly revision plan for Cloud Computing",
  "Build a 5-day assignment completion plan",
  "Generate a 30-day FYP roadmap",
];

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

type View = "overview" | "create" | "ai-generate" | "plan-detail";

export default function Planner() {
  const { data: plans = [], isLoading } = usePlans();
  const createPlan = useCreatePlan();
  const deletePlan = useDeletePlan();
  const updatePlan = useUpdatePlan();
  const [view, setView] = useState<View>("overview");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanInsert>({
    title: "", goal: "", category: "study", emoji: "📘", color_tag: "blue",
    start_date: null, end_date: null, duration: "", description: "", source_type: "manual",
  });

  // AI state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiOutput, setAiOutput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const activePlans = plans.filter((p) => p.status === "active");
  const completedPlans = plans.filter((p) => p.status === "completed");

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    try {
      await createPlan.mutateAsync(form);
      toast.success("Plan created!");
      setView("overview");
      resetForm();
    } catch { toast.error("Failed to create plan"); }
  };

  const handleTemplate = (t: typeof TEMPLATES[0]) => {
    setForm({ ...form, title: t.title, goal: t.goal, category: t.category, emoji: t.emoji, color_tag: t.color, duration: t.duration, source_type: "template" });
    setView("create");
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim() || aiLoading) return;
    setAiLoading(true);
    setAiOutput("");
    let content = "";
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: [{ role: "user", content: `You are a study planner. Create a detailed structured plan with sessions/milestones. Format with clear titles, dates, and checkpoints:\n\n${aiPrompt}` }] }),
      });
      if (!resp.ok) throw new Error("AI error");
      if (!resp.body) throw new Error("No body");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) { content += c; setAiOutput(content); }
          } catch { buffer = line + "\n" + buffer; break; }
        }
      }
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setAiLoading(false); }
  };

  const saveAiPlan = async () => {
    if (!aiPrompt.trim()) return;
    try {
      await createPlan.mutateAsync({
        title: aiPrompt.slice(0, 60),
        goal: aiPrompt,
        category: "study",
        emoji: "🧠",
        color_tag: "purple",
        description: aiOutput,
        source_type: "ai",
      });
      toast.success("AI plan saved!");
      setView("overview");
      setAiPrompt("");
      setAiOutput("");
    } catch { toast.error("Failed to save plan"); }
  };

  const resetForm = () => setForm({ title: "", goal: "", category: "study", emoji: "📘", color_tag: "blue", start_date: null, end_date: null, duration: "", description: "", source_type: "manual" });

  if (view === "plan-detail" && selectedPlan) {
    return <PlanDetail plan={selectedPlan} onBack={() => { setView("overview"); setSelectedPlan(null); }} onDelete={async () => { await deletePlan.mutateAsync(selectedPlan.id); setView("overview"); setSelectedPlan(null); toast.success("Plan deleted"); }} onStatusChange={async (status) => { await updatePlan.mutateAsync({ id: selectedPlan.id, status }); setSelectedPlan({ ...selectedPlan, status }); }} />;
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="p-4 lg:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <motion.div variants={item} className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Planner</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create structured plans to achieve your goals ✨</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView("ai-generate")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-info/10 text-info text-sm font-medium hover:bg-info/20 transition-colors">
            <Sparkles className="w-4 h-4" /> AI Generate
          </button>
          <button onClick={() => { resetForm(); setView("create"); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" /> Create Plan
          </button>
        </div>
      </motion.div>

      {/* Quick Templates */}
      {view === "overview" && (
        <>
          <motion.div variants={item}>
            <p className="text-xs font-medium text-muted-foreground mb-3">Quick Templates</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {TEMPLATES.map((t) => {
                const style = CATEGORY_STYLES[t.category] || CATEGORY_STYLES.study;
                return (
                  <button key={t.title} onClick={() => handleTemplate(t)} className={`flex items-center gap-3 p-3 rounded-xl border ${style.border} ${style.bg} hover:shadow-sm transition-all text-left group`}>
                    <span className="text-xl">{t.emoji}</span>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold ${style.text} truncate`}>{t.title}</p>
                      <p className="text-[10px] text-muted-foreground">{t.duration}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* Progress Overview */}
          <motion.div variants={item} className="grid grid-cols-3 gap-3">
            {[
              { label: "Active Plans", value: activePlans.length, icon: Target, color: "text-primary" },
              { label: "Completed", value: completedPlans.length, icon: CheckCircle2, color: "text-success" },
              { label: "Total Sessions", value: plans.reduce((a, p) => a + p.progress, 0), icon: TrendingUp, color: "text-info" },
            ].map((s) => (
              <div key={s.label} className="glass-card p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center"><s.icon className={`w-4 h-4 ${s.color}`} /></div>
                <div>
                  <p className="text-lg font-bold text-foreground">{s.value}</p>
                  <p className="text-[11px] text-muted-foreground">{s.label}</p>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Plans List */}
          <motion.div variants={item} className="space-y-4">
            {activePlans.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Active Plans</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {activePlans.map((plan) => <PlanCard key={plan.id} plan={plan} onClick={() => { setSelectedPlan(plan); setView("plan-detail"); }} />)}
                </div>
              </div>
            )}
            {completedPlans.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" /> Completed Plans</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {completedPlans.map((plan) => <PlanCard key={plan.id} plan={plan} onClick={() => { setSelectedPlan(plan); setView("plan-detail"); }} />)}
                </div>
              </div>
            )}
            {plans.length === 0 && !isLoading && (
              <div className="text-center py-12">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"><Target className="w-6 h-6 text-muted-foreground" /></div>
                <p className="text-sm font-medium text-foreground">No plans yet</p>
                <p className="text-xs text-muted-foreground mt-1">Create your first plan or use a template</p>
              </div>
            )}
          </motion.div>
        </>
      )}

      {/* Create Plan Form */}
      {view === "create" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 space-y-5 max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground">Create Plan</h2>
            <button onClick={() => setView("overview")} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>

          <div className="space-y-4">
            {/* Emoji + Title */}
            <div className="flex gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Icon</label>
                <div className="flex flex-wrap gap-1 max-w-[160px]">
                  {EMOJI_OPTIONS.map((e) => (
                    <button key={e} onClick={() => setForm({ ...form, emoji: e })} className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${form.emoji === e ? "bg-primary/10 ring-1 ring-primary" : "bg-muted hover:bg-muted/80"}`}>{e}</button>
                  ))}
                </div>
              </div>
              <div className="flex-1 space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Title</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Final Exam Prep" className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring" />
                <label className="text-xs font-medium text-muted-foreground mt-3 block">Goal</label>
                <input value={form.goal || ""} onChange={(e) => setForm({ ...form, goal: e.target.value })} placeholder="What do you want to achieve?" className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring" />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Category</label>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(CATEGORY_STYLES).map((c) => (
                  <button key={c} onClick={() => setForm({ ...form, category: c })} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${form.category === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{c}</button>
                ))}
              </div>
            </div>

            {/* Color */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Color Tag</label>
              <div className="flex gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button key={c.value} onClick={() => setForm({ ...form, color_tag: c.value })} className={`w-7 h-7 rounded-full ${c.class} transition-all ${form.color_tag === c.value ? "ring-2 ring-offset-2 ring-ring" : "opacity-50 hover:opacity-80"}`} />
                ))}
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Start Date</label>
                <input type="date" value={form.start_date || ""} onChange={(e) => setForm({ ...form, start_date: e.target.value || null })} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">End Date</label>
                <input type="date" value={form.end_date || ""} onChange={(e) => setForm({ ...form, end_date: e.target.value || null })} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Duration</label>
                <input value={form.duration || ""} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="e.g. 2 weeks" className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring" />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Description (optional)</label>
              <textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Add any notes..." className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>

          <button onClick={handleCreate} disabled={!form.title.trim() || createPlan.isPending} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity">
            {createPlan.isPending ? "Creating..." : "Create Plan"}
          </button>
        </motion.div>
      )}

      {/* AI Generate */}
      {view === "ai-generate" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 max-w-3xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2"><Sparkles className="w-4 h-4 text-info" /> AI Plan Generator</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Describe what you need, and SOFI will create a plan for you</p>
            </div>
            <button onClick={() => { setView("overview"); setAiOutput(""); setAiPrompt(""); }} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>

          {/* Prompt input */}
          <div className="flex items-end gap-2 bg-card border border-border rounded-xl px-4 py-3">
            <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAiGenerate(); } }} placeholder="e.g. Make me a 2-month study plan for Software Testing..." rows={2} className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none" />
            <button onClick={handleAiGenerate} disabled={!aiPrompt.trim() || aiLoading} className="w-9 h-9 rounded-lg bg-info text-info-foreground flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0">
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>

          {/* Suggestions */}
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_AI_PROMPTS.map((p) => (
              <button key={p} onClick={() => setAiPrompt(p)} className="px-3 py-1.5 rounded-lg bg-muted/60 text-xs text-muted-foreground hover:bg-info/10 hover:text-info transition-colors">{p}</button>
            ))}
          </div>

          {/* Output */}
          {aiOutput && (
            <div className="glass-card p-5 space-y-4">
              <div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{aiOutput}</ReactMarkdown></div>
              {!aiLoading && (
                <button onClick={saveAiPlan} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">Save as Plan</button>
              )}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Plan Card ──────────────────────────────
function PlanCard({ plan, onClick }: { plan: Plan; onClick: () => void }) {
  const style = CATEGORY_STYLES[plan.category] || CATEGORY_STYLES.study;
  return (
    <motion.div whileHover={{ y: -2 }} onClick={onClick} className={`glass-card-hover p-4 cursor-pointer border ${style.border} space-y-3`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{plan.emoji}</span>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{plan.title}</h3>
            <p className="text-[11px] text-muted-foreground">{plan.goal}</p>
          </div>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text} capitalize`}>{plan.category}</span>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        {plan.duration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{plan.duration}</span>}
        {plan.start_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(plan.start_date), "MMM d")}</span>}
        <span className="flex items-center gap-1 ml-auto"><ChevronRight className="w-3 h-3" /></span>
      </div>
      {plan.progress > 0 && (
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(plan.progress, 100)}%` }} />
        </div>
      )}
    </motion.div>
  );
}

// ─── Plan Detail ────────────────────────────
function PlanDetail({ plan, onBack, onDelete, onStatusChange }: { plan: Plan; onBack: () => void; onDelete: () => void; onStatusChange: (s: string) => void }) {
  const { data: sessions = [] } = usePlanSessions(plan.id);
  const createSession = useCreateSession();
  const toggleSession = useToggleSession();
  const [showAdd, setShowAdd] = useState(false);
  const [sessionForm, setSessionForm] = useState({ title: "", date: "", note: "" });
  const style = CATEGORY_STYLES[plan.category] || CATEGORY_STYLES.study;

  const completed = sessions.filter((s) => s.is_completed).length;
  const total = sessions.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const addSession = async () => {
    if (!sessionForm.title.trim()) return;
    await createSession.mutateAsync({ plan_id: plan.id, title: sessionForm.title, date: sessionForm.date || null, note: sessionForm.note });
    setSessionForm({ title: "", date: "", note: "" });
    setShowAdd(false);
    toast.success("Session added");
  };

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">← Back to Planner</button>

      {/* Plan header */}
      <div className={`glass-card p-5 border ${style.border} space-y-3`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{plan.emoji}</span>
            <div>
              <h1 className="text-lg font-bold text-foreground">{plan.title}</h1>
              <p className="text-sm text-muted-foreground">{plan.goal}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {plan.status === "active" && <button onClick={() => onStatusChange("completed")} className="px-3 py-1.5 rounded-lg bg-success/10 text-success text-xs font-medium hover:bg-success/20">Mark Complete</button>}
            {plan.status === "completed" && <button onClick={() => onStatusChange("active")} className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20">Reactivate</button>}
            <button onClick={onDelete} className="px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className={`px-2 py-0.5 rounded-full ${style.bg} ${style.text} font-semibold capitalize`}>{plan.category}</span>
          {plan.duration && <span>⏱️ {plan.duration}</span>}
          {plan.start_date && <span>📅 {format(new Date(plan.start_date), "MMM d, yyyy")}</span>}
          {plan.end_date && <span>→ {format(new Date(plan.end_date), "MMM d, yyyy")}</span>}
        </div>
        {total > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Progress</span><span className="font-medium text-foreground">{completed}/{total} sessions</span></div>
            <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} /></div>
          </div>
        )}
      </div>

      {/* Description */}
      {plan.description && (
        <div className="glass-card p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Description / AI Plan</p>
          <div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{plan.description}</ReactMarkdown></div>
        </div>
      )}

      {/* Sessions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-muted-foreground">Sessions / Milestones</p>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"><Plus className="w-3 h-3" /> Add Session</button>
        </div>

        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="glass-card p-4 mb-3 space-y-3">
            <input value={sessionForm.title} onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })} placeholder="Session title" className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none" />
            <div className="flex gap-2">
              <input type="date" value={sessionForm.date} onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })} className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none" />
              <button onClick={addSession} disabled={!sessionForm.title.trim()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40">Add</button>
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm font-medium">Cancel</button>
            </div>
          </motion.div>
        )}

        <div className="space-y-2">
          {sessions.map((s) => (
            <div key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${s.is_completed ? "bg-muted/30 border-border" : "bg-card border-border hover:border-primary/20"}`}>
              <button onClick={() => toggleSession.mutate({ id: s.id, is_completed: !s.is_completed, plan_id: plan.id })} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${s.is_completed ? "bg-primary border-primary" : "border-muted-foreground/40 hover:border-primary"}`}>
                {s.is_completed && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${s.is_completed ? "text-muted-foreground line-through" : "text-foreground"}`}>{s.title}</p>
                {s.date && <p className="text-[10px] text-muted-foreground">{format(new Date(s.date), "MMM d, yyyy")}</p>}
              </div>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">No sessions yet. Add milestones to track your progress.</div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Sparkles, BookOpen, GraduationCap, Rocket, Briefcase,
  Presentation, Library, X, Calendar as CalendarIcon, Target, TrendingUp,
  CheckCircle2, Clock, MoreHorizontal, Trash2, ChevronRight,
  Loader2, Send, LayoutList, LayoutGrid, CalendarDays, Edit3, Save, ArrowLeft,
  AlertCircle, Bell, RefreshCw, Wand2, Brain, Check, Flame, Layers, Star,
} from "lucide-react";
import { useRewards } from "@/hooks/useRewards";
import { awardXpOnce, revokeXpKey } from "@/hooks/useRewardLedger";
import { usePlans, useCreatePlan, useDeletePlan, useUpdatePlan, usePlanSessions, useCreateSession, useToggleSession, type Plan, type PlanInsert } from "@/hooks/usePlans";
import { useTasks } from "@/hooks/useTasks";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, parseISO, startOfWeek, endOfWeek, differenceInDays, isPast, isToday, isTomorrow, addDays, addWeeks, subWeeks, isWeekend } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { handleAiError, throwIfBadResponse } from "@/lib/aiError";
import ReactMarkdown from "react-markdown";
import { useDailyActivity } from "@/hooks/useStudySessions";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, RadialBar, RadialBarChart, PolarAngleAxis } from "recharts";

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

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
  study: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20", gradient: "from-primary/20 to-primary/5" },
  exam: { bg: "bg-info/10", text: "text-info", border: "border-info/20", gradient: "from-info/20 to-info/5" },
  assignment: { bg: "bg-success/10", text: "text-success", border: "border-success/20", gradient: "from-success/20 to-success/5" },
  project: { bg: "bg-warning/10", text: "text-warning", border: "border-warning/20", gradient: "from-warning/20 to-warning/5" },
  personal: { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/20", gradient: "from-destructive/20 to-destructive/5" },
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
  "2-month Software Engineering exam prep",
  "Weekly revision plan for 5 subjects",
  "30-day FYP completion roadmap",
  "5-day assignment sprint plan",
  "1-month internship preparation",
  "Semester study schedule",
  "7-day exam crash course",
  "Daily routine with study blocks",
];

const TEMPLATE_PROMPTS: Record<string, string> = {
  "2-Month Test Prep": "Create a 2-month test preparation plan with daily study sessions, weekly reviews, and practice tests. Include specific time allocations per topic.",
  "Weekly Study Plan": "Create a 7-day weekly study plan covering multiple subjects with balanced daily sessions, breaks, and a Sunday review.",
  "Exam Countdown": "Create a 14-day exam countdown plan with topic-by-topic revision, mock tests on day 7 and day 13, and a light review on the final day.",
  "FYP Work Plan": "Create a 3-month Final Year Project plan with weekly deliverables, supervisor meeting milestones, prototype checkpoints, and submission deadlines.",
  "Assignment Plan": "Create a 7-day assignment completion plan: research, outline, draft, revise, polish, proofread, submit. One clear focus per day.",
  "Presentation Prep": "Create a 3-day presentation preparation plan: day 1 outline & research, day 2 build slides & visuals, day 3 rehearse & polish delivery.",
  "7-Day Revision Sprint": "Create an intensive 7-day revision sprint covering all key topics, with daily active recall, practice questions, and a final mock test.",
};

// Parse "Sessions" / "Day-by-day" lines from AI markdown into session objects.
function parseAiSessions(markdown: string, startDate: string | null): Array<{ title: string; date: string | null }> {
  if (!markdown) return [];
  const lines = markdown.split(/\r?\n/);
  const out: Array<{ title: string; date: string | null }> = [];
  const start = startDate ? parseISO(startDate) : null;

  // Pattern A: "### Day N — YYYY-MM-DD — focus"
  // Pattern B: "- [YYYY-MM-DD] title — desc"  or  "- [Day N] title — desc"
  // Pattern C: numbered "1. title"
  const dayHeader = /^#{2,4}\s*Day\s+(\d+)\s*[—\-:]\s*(\d{4}-\d{2}-\d{2})?\s*[—\-:]?\s*(.+)?$/i;
  const bracketLine = /^[-*]\s*\[?(?:Day\s+(\d+)|(\d{4}-\d{2}-\d{2}))\]?\s*[—\-:]?\s*(.+)$/i;
  const numbered = /^(\d+)\.\s+(.+)$/;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    let m = line.match(dayHeader);
    if (m) {
      const dayN = parseInt(m[1], 10);
      const explicit = m[2] || null;
      const title = (m[3] || `Day ${dayN}`).replace(/[*_`]/g, "").trim();
      const date = explicit || (start ? format(addDays(start, dayN - 1), "yyyy-MM-dd") : null);
      out.push({ title, date });
      continue;
    }
    m = line.match(bracketLine);
    if (m) {
      const dayN = m[1] ? parseInt(m[1], 10) : null;
      const explicit = m[2] || null;
      const title = m[3].replace(/[*_`]/g, "").trim();
      const date = explicit || (dayN && start ? format(addDays(start, dayN - 1), "yyyy-MM-dd") : null);
      out.push({ title, date });
      continue;
    }
    m = line.match(numbered);
    if (m && /session|day|week|milestone|topic/i.test(m[2])) {
      out.push({ title: m[2].replace(/[*_`]/g, "").trim(), date: null });
    }
  }
  // Dedupe by title+date
  const seen = new Set<string>();
  return out.filter((s) => {
    const k = `${s.title}::${s.date}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 30);
}

type View = "overview" | "create" | "ai-generate" | "plan-detail";
type Tab = "board" | "calendar";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

interface SessionLite {
  id: string;
  plan_id: string;
  title: string;
  date: string | null;
  is_completed: boolean;
}

export default function Planner() {
  const { data: plans = [], isLoading } = usePlans();
  const { data: tasks = [] } = useTasks();
  const createPlan = useCreatePlan();
  const deletePlan = useDeletePlan();
  const updatePlan = useUpdatePlan();
  const createSession = useCreateSession();
  const activity = useDailyActivity(7);
  const navigate = useNavigate();
  const rewards = useRewards();
  const notifiedRef = useRef<Set<string>>(new Set());
  const [view, setView] = useState<View>("overview");
  const [tab, setTab] = useState<Tab>("board");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [allSessions, setAllSessions] = useState<SessionLite[]>([]);
  const [form, setForm] = useState<PlanInsert>({
    title: "", goal: "", category: "study", emoji: "📘", color_tag: "blue",
    start_date: null, end_date: null, duration: "", description: "", source_type: "manual",
  });

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiOutput, setAiOutput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Fetch ALL sessions across user's plans (for board grouping, today's focus, stats)
  useEffect(() => {
    if (plans.length === 0) { setAllSessions([]); return; }
    const planIds = plans.map((p) => p.id);
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("plan_sessions")
        .select("id, plan_id, title, date, is_completed")
        .in("plan_id", planIds);
      if (!cancelled) setAllSessions((data || []) as SessionLite[]);
    })();
    return () => { cancelled = true; };
  }, [plans]);

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const sessionsByPlan = useMemo(() => {
    const m = new Map<string, SessionLite[]>();
    allSessions.forEach((s) => {
      if (!m.has(s.plan_id)) m.set(s.plan_id, []);
      m.get(s.plan_id)!.push(s);
    });
    return m;
  }, [allSessions]);

  const isPlanOverdue = (planId: string) => {
    const sess = sessionsByPlan.get(planId) || [];
    return sess.some((s) => !s.is_completed && s.date && s.date < todayStr);
  };
  const planHasTodaySession = (planId: string) => {
    const sess = sessionsByPlan.get(planId) || [];
    return sess.some((s) => !s.is_completed && s.date === todayStr);
  };

  const todayFocus = useMemo(() => {
    return allSessions
      .filter((s) => !s.is_completed && s.date === todayStr)
      .map((s) => ({ ...s, plan: plans.find((p) => p.id === s.plan_id) }))
      .filter((s) => s.plan);
  }, [allSessions, plans, todayStr]);

  const completedThisWeek = useMemo(() => {
    const cutoff = format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");
    return allSessions.filter((s) => s.is_completed && s.date && s.date >= cutoff).length;
  }, [allSessions]);

  const activePlans = plans.filter((p) => p.status === "active" && !isPlanOverdue(p.id));
  const overduePlans = plans.filter((p) => p.status === "active" && isPlanOverdue(p.id));
  const completedPlans = plans.filter((p) => p.status === "completed");
  const avgProgress = plans.length ? Math.round(plans.reduce((a, p) => a + (p.progress || 0), 0) / plans.length) : 0;

  const awardSessionXP = (sessionId: string) => {
    awardXpOnce(`session:${sessionId}`, 30);
  };

  const toggleTodaySession = async (sessionId: string, planId: string) => {
    setAllSessions((cur) => cur.map((s) => s.id === sessionId ? { ...s, is_completed: true } : s));
    const { error } = await supabase.from("plan_sessions").update({ is_completed: true } as any).eq("id", sessionId);
    if (error) {
      toast.error("Failed to update");
      setAllSessions((cur) => cur.map((s) => s.id === sessionId ? { ...s, is_completed: false } : s));
      return;
    }
    const planSess = (sessionsByPlan.get(planId) || []).map((s) => s.id === sessionId ? { ...s, is_completed: true } : s);
    if (planSess.length) {
      const done = planSess.filter((s) => s.is_completed).length;
      const progress = Math.round((done / planSess.length) * 100);
      const status = progress === 100 ? "completed" : "active";
      await supabase.from("plans").update({ progress, status } as any).eq("id", planId);
    }
    const awarded = awardXpOnce(`session:${sessionId}`, 30);
    toast.success(awarded ? "✅ Done! +30 XP 🎯" : "✅ Done!");
  };

  // Milestone notifications — checks every hour and on plan changes
  useEffect(() => {
    if (activePlans.length === 0) return;

    const checkMilestones = async () => {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
      const today = new Date();
      for (const plan of activePlans) {
        const { data: upcoming } = await supabase
          .from("plan_sessions")
          .select("id,title,date,is_completed")
          .eq("plan_id", plan.id)
          .eq("is_completed", false);
        (upcoming || []).forEach((s: any) => {
          if (!s.date) return;
          const d = parseISO(s.date);
          const diff = differenceInDays(d, today);
          if (diff < 0 || diff > 3) return;
          const key = `${plan.id}:${s.id}`;
          if (notifiedRef.current.has(key)) return;
          notifiedRef.current.add(key);
          const when = diff === 0 ? "today" : diff === 1 ? "tomorrow" : `in ${diff} days`;
          toast.info(`📌 ${s.title}`, { description: `${plan.title} · due ${when}` });
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            try {
              new Notification(`SOFI — Milestone due ${when}`, {
                body: `${s.title} (${plan.title})`,
                icon: "/favicon.png",
              });
            } catch {}
          }
        });
      }
    };

    checkMilestones();
    const interval = setInterval(checkMilestones, 60 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans]);

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    try { await createPlan.mutateAsync(form); toast.success("Plan created!"); setView("overview"); resetForm(); }
    catch { toast.error("Failed to create plan"); }
  };

  const handleTemplate = (t: typeof TEMPLATES[0]) => {
    setForm({ ...form, title: t.title, goal: t.goal, category: t.category, emoji: t.emoji, color_tag: t.color, duration: t.duration, source_type: "template" });
    setView("create");
  };

  const [templateLoading, setTemplateLoading] = useState<string | null>(null);
  const handleTemplateAI = async (t: typeof TEMPLATES[0]) => {
    if (templateLoading) return;
    setTemplateLoading(t.title);
    setForm((f) => ({ ...f, title: t.title, goal: t.goal, category: t.category, emoji: t.emoji, color_tag: t.color, duration: t.duration, source_type: "ai" }));
    setAiPrompt(TEMPLATE_PROMPTS[t.title] || `Create a ${t.duration} plan for: ${t.goal}`);
    setView("ai-generate");
    // Kick off generation on next tick after state settles
    setTimeout(() => { handleAiGenerate(); setTemplateLoading(null); }, 50);
  };

  const buildContextualPrompt = (extra: string) => {
    // Compute real day count from dates if both are set
    let dayInfo = "";
    let correctionNote = "";
    if (form.start_date && form.end_date) {
      const s = parseISO(form.start_date);
      const e = parseISO(form.end_date);
      const days = differenceInDays(e, s) + 1;
      if (days > 0) {
        dayInfo = `\nEXACT TIMEFRAME: ${days} day(s), from ${form.start_date} to ${form.end_date}.`;
        // Detect mismatch between user's duration text and actual days
        if (form.duration && form.duration.trim()) {
          const dur = form.duration.toLowerCase();
          const declaredDays =
            /week/.test(dur) ? (parseInt(dur) || 1) * 7 :
            /month/.test(dur) ? (parseInt(dur) || 1) * 30 :
            /day/.test(dur) ? (parseInt(dur) || 0) : 0;
          if (declaredDays && Math.abs(declaredDays - days) > 1) {
            correctionNote = `\nIMPORTANT CORRECTION: The user wrote duration "${form.duration}" (~${declaredDays} days), but the start/end dates only cover ${days} days. Begin your response with one short sentence correcting this (e.g. "This is not a ${form.duration}; based on your dates it is a ${days}-day plan. I'll generate a ${days}-day plan accordingly."), then produce the plan strictly within ${days} days.`;
          }
        }
      }
    } else if (form.duration) {
      dayInfo = `\nDURATION: ${form.duration} (no exact dates provided — pick a sensible day-by-day breakdown).`;
    }

    const fields = [
      form.title && `Title: ${form.title}`,
      form.goal && `Goal: ${form.goal}`,
      form.category && `Category: ${form.category}`,
      form.color_tag && `Color tag: ${form.color_tag}`,
      form.start_date && `Start date: ${form.start_date}`,
      form.end_date && `End date: ${form.end_date}`,
      form.duration && `User-stated duration: ${form.duration}`,
      form.description && `Existing notes/description: ${form.description}`,
    ].filter(Boolean).join("\n");

    return `You are an expert study & productivity planner. Generate a clean, structured plan using ALL the user's form data below.${dayInfo}${correctionNote}

USER'S PLAN DETAILS:
${fields || "(no fields filled yet)"}

${extra ? `ADDITIONAL USER REQUEST:\n${extra}\n` : ""}
RULES YOU MUST FOLLOW:
1. STRICTLY respect the start_date and end_date. Never schedule anything outside that range.
2. If a correction note is given above, output that one-line correction first, then the plan.
3. Output the plan as clean Markdown with this structure:
   - A short 1-line summary
   - A "## Day-by-day Plan" section with one "### Day N — <YYYY-MM-DD> — <focus>" block per day, each containing 2-5 bullet tasks (optionally prefixed with a time slot like "09:00–10:30 —").
   - Then a "## Grouped by Category" section with bullet points grouping tasks by theme/category.
4. Be realistic, specific to the goal "${form.goal || form.title || "the user's objective"}", and match the category "${form.category}".
5. Do NOT invent dates outside the given range. Do NOT pad with filler days.`;
  };

  const handleAiGenerate = async () => {
    // Allow generation if form has meaningful data OR user typed an extra prompt
    const hasFormData = form.title.trim() || form.goal?.trim() || (form.start_date && form.end_date);
    if (!hasFormData && !aiPrompt.trim()) {
      toast.error("Add a title, goal or dates first so the AI can plan accurately.");
      return;
    }
    if (aiLoading) return;
    setAiLoading(true); setAiOutput("");
    let content = "";
    try {
      const fullPrompt = view === "create"
        ? buildContextualPrompt(aiPrompt.trim())
        : `You are a study planner. Create a detailed structured plan with sessions/milestones. Format with clear titles, dates, and checkpoints:\n\n${aiPrompt}`;
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: [{ role: "user", content: fullPrompt }] }),
      });
      if (!resp.ok) { await throwIfBadResponse(resp, "AI Plan"); }
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
          let line = buffer.slice(0, idx); buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try { const p = JSON.parse(json); const c = p.choices?.[0]?.delta?.content; if (c) { content += c; setAiOutput(content); } }
          catch { buffer = line + "\n" + buffer; break; }
        }
      }
    } catch (e: any) { handleAiError(e, "AI Plan"); }
    finally { setAiLoading(false); }
  };

  const [aiPlanTitle, setAiPlanTitle] = useState("");

  const saveAiPlan = async () => {
    if (!aiOutput.trim()) { toast.error("Generate a plan first"); return; }
    const title = (aiPlanTitle.trim() || aiPrompt.trim().slice(0, 60) || "Untitled AI Plan");
    try {
      const created = await createPlan.mutateAsync({ title, goal: aiPrompt, category: form.category || "study", emoji: form.emoji || "🧠", color_tag: form.color_tag || "purple", start_date: form.start_date || null, end_date: form.end_date || null, description: aiOutput, source_type: "ai" });
      // Auto-create sessions parsed from the AI output
      const parsed = parseAiSessions(aiOutput, created.start_date);
      let createdCount = 0;
      for (const s of parsed) {
        try { await createSession.mutateAsync({ plan_id: created.id, title: s.title, date: s.date }); createdCount++; }
        catch {}
      }
      toast.success(createdCount > 0 ? `Plan saved with ${createdCount} sessions created automatically` : "Plan saved!");
      setView("overview"); setAiPrompt(""); setAiOutput(""); setAiPlanTitle(""); resetForm();
    } catch { toast.error("Failed to save plan"); }
  };

  const saveAiAsPlanFromCreate = async () => {
    if (!aiOutput.trim()) { toast.error("Generate a plan first"); return; }
    if (!form.title.trim()) { toast.error("Add a title before saving"); return; }
    try {
      const created = await createPlan.mutateAsync({ ...form, description: aiOutput, source_type: "ai" });
      const parsed = parseAiSessions(aiOutput, created.start_date);
      let createdCount = 0;
      for (const s of parsed) {
        try { await createSession.mutateAsync({ plan_id: created.id, title: s.title, date: s.date }); createdCount++; }
        catch {}
      }
      toast.success(createdCount > 0 ? `Plan saved with ${createdCount} sessions created automatically` : "Plan saved!");
      setView("overview"); resetForm(); setAiOutput(""); setAiPrompt("");
    } catch { toast.error("Failed to save plan"); }
  };

  const resetForm = () => setForm({ title: "", goal: "", category: "study", emoji: "📘", color_tag: "blue", start_date: null, end_date: null, duration: "", description: "", source_type: "manual" });

  if (view === "plan-detail" && selectedPlan) {
    return <PlanDetail plan={selectedPlan} navigate={navigate} onBack={() => { setView("overview"); setSelectedPlan(null); }} onDelete={async () => { await deletePlan.mutateAsync(selectedPlan.id); setView("overview"); setSelectedPlan(null); toast.success("Plan deleted"); }} onUpdate={async (updates) => { await updatePlan.mutateAsync({ id: selectedPlan.id, ...updates }); setSelectedPlan({ ...selectedPlan, ...updates }); }} />;
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Tab bar */}
      <div className="flex items-center justify-between p-2 border-b border-border bg-card/60 backdrop-blur-sm">
        <div className="flex gap-1">
          {([
            { key: "board" as Tab, label: "Board", icon: LayoutGrid },
            { key: "calendar" as Tab, label: "Calendar", icon: CalendarDays },
          ]).map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
        {tab !== "calendar" && (
          <div className="flex gap-2">
            <button onClick={() => setView("ai-generate")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-info/10 text-info text-xs font-medium hover:bg-info/20 transition-colors"><Sparkles className="w-3.5 h-3.5" /> AI Generate</button>
            <button onClick={() => { resetForm(); setView("create"); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"><Plus className="w-3.5 h-3.5" /> Create</button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {tab === "calendar" ? (
          <CalendarView plans={plans} tasks={tasks} planSessions={allSessions} onOpenPlan={(p) => { setSelectedPlan(p); setView("plan-detail"); }} onAddSession={async (planId, title, date) => { await createSession.mutateAsync({ plan_id: planId, title, date }); setAllSessions((cur) => [...cur, { id: `tmp-${Date.now()}`, plan_id: planId, title, date, is_completed: false }]); toast.success("Session added"); }} onToggleSession={toggleTodaySession} />
        ) : (
          <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-5">
            {view === "overview" && (
              <>
                {/* Today's Focus */}
                <motion.div variants={item} className="glass-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-warning" /> Today's Focus
                      <span className="text-[10px] font-normal text-muted-foreground ml-1">{format(new Date(), "EEE, MMM d")}</span>
                    </p>
                    {todayFocus.length > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/10 text-warning font-semibold">{todayFocus.length} due</span>}
                  </div>
                  {todayFocus.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">Nothing due today — great day to get ahead 🚀</p>
                  ) : (
                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                      {todayFocus.map((s) => (
                        <motion.div key={s.id} layout
                          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 hover:bg-muted border border-border flex-shrink-0 group cursor-pointer"
                          onClick={() => { setSelectedPlan(s.plan!); setView("plan-detail"); }}>
                          <span className="text-base">{s.plan?.emoji}</span>
                          <div className="min-w-0 max-w-[180px]">
                            <p className="text-xs font-semibold text-foreground truncate">{s.title}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{s.plan?.title}</p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleTodaySession(s.id, s.plan_id); }}
                            className="ml-1 w-6 h-6 rounded-full bg-success/10 text-success hover:bg-success hover:text-success-foreground flex items-center justify-center transition-colors flex-shrink-0"
                            title="Mark complete">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>

                {/* Stats pills */}
                <motion.div variants={item} className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {[
                    { label: "Active Plans", value: activePlans.length, icon: Target, color: "text-primary", bg: "bg-primary/10" },
                    { label: "Total Milestones", value: allSessions.length, icon: Layers, color: "text-info", bg: "bg-info/10" },
                    { label: "Completed this week", value: completedThisWeek, icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
                    { label: "Avg progress", value: `${avgProgress}%`, icon: TrendingUp, color: "text-warning", bg: "bg-warning/10" },
                    { label: `Level ${rewards.level} · ${rewards.xp} XP`, value: "⭐", icon: Star, color: "text-info", bg: "bg-info/10" },
                  ].map((s) => (
                    <div key={s.label} className={`flex items-center gap-2 px-3 py-2 rounded-full border border-border ${s.bg} flex-shrink-0`}>
                      <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
                      <span className={`text-sm font-bold ${s.color}`}>{s.value}</span>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">{s.label}</span>
                    </div>
                  ))}
                </motion.div>

                {/* Templates */}
                <motion.div variants={item}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium text-muted-foreground">Quick Templates</p>
                    <p className="text-[10px] text-muted-foreground">⚡ One-click AI generate · long-press to customize</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {TEMPLATES.map((t) => {
                      const style = CATEGORY_STYLES[t.category] || CATEGORY_STYLES.study;
                      const loading = templateLoading === t.title;
                      return (
                        <button
                          key={t.title}
                          onClick={() => handleTemplateAI(t)}
                          onContextMenu={(e) => { e.preventDefault(); handleTemplate(t); }}
                          disabled={loading}
                          title="Click: AI generate · Right-click: edit form"
                          className={`relative flex items-center gap-3 p-3 rounded-xl border ${style.border} ${style.bg} hover:shadow-md hover:scale-[1.02] active:scale-95 transition-all text-left group disabled:opacity-60`}>
                          <span className="text-xl flex-shrink-0">{t.emoji}</span>
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs font-semibold ${style.text} truncate`}>{t.title}</p>
                            <p className="text-[10px] text-muted-foreground">{t.duration}</p>
                          </div>
                          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-info flex-shrink-0" /> : <Sparkles className="w-3 h-3 text-info opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>

                {/* Activity chart + radial */}
                <motion.div variants={item} className="grid lg:grid-cols-3 gap-3">
                  <div className="glass-card p-4 lg:col-span-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-primary" /> Weekly Focus Activity</p>
                      <span className="text-[10px] text-muted-foreground">Last 7 days</span>
                    </div>
                    <div className="h-[160px] -ml-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={activity} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="planArea" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                          <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={28} />
                          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v} min`, "Focus"]} />
                          <Area type="monotone" dataKey="minutes" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#planArea)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="glass-card p-4 flex flex-col">
                    <p className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5"><Target className="w-3.5 h-3.5 text-info" /> Avg Plan Progress</p>
                    <div className="relative flex-1 flex items-center justify-center">
                      <div className="h-[140px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ name: "avg", value: avgProgress, fill: "hsl(var(--primary))" }]} startAngle={90} endAngle={-270}>
                            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                            <RadialBar background={{ fill: "hsl(var(--muted))" }} dataKey="value" cornerRadius={20} />
                          </RadialBarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <p className="text-2xl font-bold text-foreground">{avgProgress}%</p>
                        <p className="text-[10px] text-muted-foreground">{plans.length} plan{plans.length !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Board or List View */}
                {plans.length === 0 && !isLoading ? (
                  <div className="text-center py-12"><div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"><Target className="w-6 h-6 text-muted-foreground" /></div><p className="text-sm font-medium text-foreground">No plans yet</p><p className="text-xs text-muted-foreground mt-1">Create your first plan or use a template</p></div>
                ) : tab === "board" ? (
                  <motion.div variants={item} className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
                    {([
                      { key: "active", label: "Active", items: activePlans, accent: "text-primary", dot: "bg-primary" },
                      { key: "overdue", label: "Overdue", items: overduePlans, accent: "text-destructive", dot: "bg-destructive" },
                      { key: "completed", label: "Completed", items: completedPlans, accent: "text-success", dot: "bg-success" },
                    ]).map((col) => (
                      <div key={col.key} className="flex-shrink-0 w-[300px] sm:w-[340px] flex flex-col">
                        <div className="flex items-center justify-between mb-3 px-1">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                            <p className={`text-xs font-semibold ${col.accent}`}>{col.label}</p>
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{col.items.length}</span>
                        </div>
                        <div className="space-y-3">
                          {col.items.length === 0 ? (
                            <div className="border border-dashed border-border rounded-xl p-6 text-center text-[11px] text-muted-foreground">No plans here</div>
                          ) : col.items.map((plan) => (
                            <PlanCard key={plan.id} plan={plan} sessions={sessionsByPlan.get(plan.id) || []} hasToday={planHasTodaySession(plan.id)} onClick={() => { setSelectedPlan(plan); setView("plan-detail"); }} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                ) : (
                  // List view
                  <motion.div variants={item} className="space-y-2">
                    {[...overduePlans, ...activePlans, ...completedPlans].map((plan) => (
                      <PlanRow key={plan.id} plan={plan} sessions={sessionsByPlan.get(plan.id) || []} overdue={isPlanOverdue(plan.id)} onClick={() => { setSelectedPlan(plan); setView("plan-detail"); }} />
                    ))}
                  </motion.div>
                )}
              </>
            )}

            {/* Create Form */}
            {view === "create" && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 space-y-5 max-w-2xl mx-auto">
                <div className="flex items-center justify-between"><h2 className="text-base font-bold text-foreground">Create Plan</h2><button onClick={() => setView("overview")} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button></div>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Icon</label><div className="flex flex-wrap gap-1 max-w-[160px]">{EMOJI_OPTIONS.map((e) => (<button key={e} onClick={() => setForm({ ...form, emoji: e })} className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${form.emoji === e ? "bg-primary/10 ring-1 ring-primary" : "bg-muted hover:bg-muted/80"}`}>{e}</button>))}</div></div>
                    <div className="flex-1 space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Final Exam Prep" className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring" /><label className="text-xs font-medium text-muted-foreground mt-3 block">Goal</label><input value={form.goal || ""} onChange={(e) => setForm({ ...form, goal: e.target.value })} placeholder="What do you want to achieve?" className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring" /></div>
                  </div>
                  <div><label className="text-xs font-medium text-muted-foreground mb-1.5 block">Category</label><div className="flex flex-wrap gap-1.5">{Object.keys(CATEGORY_STYLES).map((c) => (<button key={c} onClick={() => setForm({ ...form, category: c })} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${form.category === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{c}</button>))}</div></div>
                  <div><label className="text-xs font-medium text-muted-foreground mb-1.5 block">Color Tag</label><div className="flex gap-2">{COLOR_OPTIONS.map((c) => (<button key={c.value} onClick={() => setForm({ ...form, color_tag: c.value })} className={`w-7 h-7 rounded-full ${c.class} transition-all ${form.color_tag === c.value ? "ring-2 ring-offset-2 ring-ring" : "opacity-50 hover:opacity-80"}`} />))}</div></div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Start Date</label><input type="date" value={form.start_date || ""} onChange={(e) => setForm({ ...form, start_date: e.target.value || null })} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring" /></div>
                    <div><label className="text-xs font-medium text-muted-foreground mb-1 block">End Date</label><input type="date" value={form.end_date || ""} onChange={(e) => setForm({ ...form, end_date: e.target.value || null })} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring" /></div>
                    <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Duration</label><input value={form.duration || ""} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="e.g. 2 weeks" className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring" /></div>
                  </div>
                  <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Description (optional)</label><textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Add any notes..." className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none focus:ring-1 focus:ring-ring" /></div>
                </div>
                {/* AI Generate inline */}
                <div className="border-t border-border pt-4 mt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-info" /> Generate with AI</p>
                  <p className="text-[10px] text-muted-foreground mb-2">AI will read your title, goal, dates, duration & description above and build a strict day-by-day plan.</p>
                  <div className="flex gap-2">
                    <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="Optional extra instructions (e.g. focus on weak topics)" className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAiGenerate(); } }} />
                    <button onClick={handleAiGenerate} disabled={aiLoading} className="px-3 py-2 rounded-lg bg-info/10 text-info text-xs font-medium hover:bg-info/20 disabled:opacity-40 transition-colors flex items-center gap-1.5 whitespace-nowrap">
                      {aiLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</> : <><Sparkles className="w-3.5 h-3.5" /> Generate</>}
                    </button>
                  </div>
                  {aiLoading && !aiOutput && (
                    <div className="mt-3 bg-muted/30 border border-border rounded-xl p-4 flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-info" /> Reading your plan details and generating…
                    </div>
                  )}
                  {aiOutput && (
                    <div className="mt-3 bg-muted/30 border border-border rounded-xl p-4 max-h-60 overflow-auto">
                      <div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{aiOutput}</ReactMarkdown></div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <button onClick={saveAiAsPlanFromCreate} disabled={createPlan.isPending} className="px-3 py-1.5 rounded-lg bg-success text-success-foreground text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center gap-1.5"><Save className="w-3 h-3" /> Save as Plan</button>
                        <button onClick={() => { setForm({ ...form, description: aiOutput, source_type: "ai" }); setAiOutput(""); setAiPrompt(""); toast.success("AI plan added to description"); }} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity">Use as Description</button>
                        <button onClick={() => { setAiOutput(""); }} className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-medium hover:text-foreground transition-colors">Discard</button>
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={handleCreate} disabled={!form.title.trim() || createPlan.isPending} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity">{createPlan.isPending ? "Creating..." : "Create Plan"}</button>
              </motion.div>
            )}

            {/* AI Generate (standalone) */}
            {view === "ai-generate" && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 max-w-3xl mx-auto">
                <div className="flex items-center justify-between"><div><h2 className="text-base font-bold text-foreground flex items-center gap-2"><Sparkles className="w-4 h-4 text-info" /> AI Plan Generator</h2><p className="text-xs text-muted-foreground mt-0.5">Describe what you need, and SOFI will create a plan</p></div><button onClick={() => { setView("overview"); setAiOutput(""); setAiPrompt(""); }} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button></div>
                <div className="flex items-end gap-2 bg-card border border-border rounded-xl px-4 py-3"><textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAiGenerate(); } }} placeholder="e.g. Make me a 2-month study plan..." rows={2} className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none" /><button onClick={handleAiGenerate} disabled={!aiPrompt.trim() || aiLoading} className="w-9 h-9 rounded-lg bg-info text-info-foreground flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0">{aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}</button></div>
                <div className="flex flex-wrap gap-2">{SUGGESTED_AI_PROMPTS.map((p) => (<button key={p} onClick={() => setAiPrompt(p)} className="px-3 py-1.5 rounded-lg bg-muted/60 text-xs text-muted-foreground hover:bg-info/10 hover:text-info transition-colors">{p}</button>))}</div>
                {aiOutput && (
                  <div className="glass-card p-5 space-y-4">
                    <div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{aiOutput}</ReactMarkdown></div>
                    {!aiLoading && (
                      <div className="space-y-2 pt-2 border-t border-border">
                        <label className="text-xs font-medium text-muted-foreground">Plan title (so you can find it later)</label>
                        <input
                          value={aiPlanTitle}
                          onChange={(e) => setAiPlanTitle(e.target.value)}
                          placeholder="e.g. Cloud Computing — 5-day Revision"
                          className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
                        />
                        <button onClick={saveAiPlan} disabled={createPlan.isPending} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center justify-center gap-2">
                          <Save className="w-4 h-4" /> {createPlan.isPending ? "Saving…" : "Save as Plan"}
                        </button>
                        <p className="text-[10px] text-muted-foreground text-center">Your plan will appear in the Plans list. Click it anytime to view the full content.</p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Calendar View (Google-Calendar-style month grid) ──────────
function CalendarView({
  plans, tasks, planSessions, onOpenPlan, onAddSession, onToggleSession,
}: {
  plans: Plan[]; tasks: any[]; planSessions: SessionLite[];
  onOpenPlan: (p: Plan) => void;
  onAddSession: (planId: string, title: string, date: string) => Promise<void>;
  onToggleSession: (sessionId: string, planId: string) => Promise<void>;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [addDay, setAddDay] = useState<string | null>(null);
  const [addPlanId, setAddPlanId] = useState<string>("");
  const [addTitle, setAddTitle] = useState("");

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });
  const today = new Date();

  const planById = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans]);

  // Map date -> sessions[]
  const sessionsByDate = useMemo(() => {
    const m = new Map<string, Array<SessionLite & { plan?: Plan }>>();
    planSessions.forEach((s) => {
      if (!s.date) return;
      const arr = m.get(s.date) || [];
      arr.push({ ...s, plan: planById.get(s.plan_id) });
      m.set(s.date, arr);
    });
    return m;
  }, [planSessions, planById]);

  const taskByDate = useMemo(() => {
    const m = new Map<string, any[]>();
    tasks.forEach((t: any) => { if (t.due_date) { const a = m.get(t.due_date) || []; a.push(t); m.set(t.due_date, a); } });
    return m;
  }, [tasks]);

  const colorForCategory = (cat: string): string => {
    const c = (CATEGORY_STYLES[cat] || CATEGORY_STYLES.study).text.replace("text-", "bg-");
    return c;
  };

  const handleQuickAdd = async () => {
    if (!addDay || !addPlanId || !addTitle.trim()) return;
    await onAddSession(addPlanId, addTitle.trim(), addDay);
    setAddDay(null); setAddTitle(""); setAddPlanId("");
  };

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-xl font-bold text-foreground">{format(currentMonth, "MMMM yyyy")}</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" title="Previous month">‹</button>
          <button onClick={() => setCurrentMonth(new Date())} className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors">Today</button>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" title="Next month">›</button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
          <div key={d} className={`text-center text-[11px] font-semibold uppercase tracking-wider py-2 ${i >= 5 ? "text-muted-foreground/70" : "text-muted-foreground"}`}>{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const sessions = sessionsByDate.get(dateKey) || [];
          const dayTasks = taskByDate.get(dateKey) || [];
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday_ = isSameDay(day, today);
          const weekend = isWeekend(day);

          const cellBg = isToday_ ? "bg-primary/5" : weekend ? "bg-muted/20" : "bg-card";
          const cellBorder = isToday_ ? "border-primary/30" : "border-border";

          return (
            <Popover key={dateKey} open={openDay === dateKey} onOpenChange={(o) => setOpenDay(o ? dateKey : null)}>
              <PopoverTrigger asChild>
                <div
                  className={`group relative min-h-[88px] p-1.5 rounded-lg border ${cellBorder} ${cellBg} text-left transition-all hover:border-primary/40 cursor-pointer ${!isCurrentMonth ? "opacity-40" : ""}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    {isToday_ ? (
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">{format(day, "d")}</span>
                    ) : (
                      <span className="text-[11px] font-semibold text-foreground px-1">{format(day, "d")}</span>
                    )}
                    {plans.length > 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setAddDay(dateKey); setAddPlanId(plans[0]?.id || ""); }}
                        className="opacity-0 group-hover:opacity-100 w-4 h-4 rounded bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-all"
                        title="Add session"
                      >+</button>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {sessions.slice(0, 2).map((s) => {
                      const cat = s.plan?.category || "study";
                      const dot = colorForCategory(cat);
                      return (
                        <button
                          key={s.id}
                          onClick={(e) => { e.stopPropagation(); if (s.plan) onOpenPlan(s.plan); }}
                          className={`w-full flex items-center gap-1 px-1 py-0.5 rounded-sm bg-muted/50 hover:bg-muted transition-colors ${s.is_completed ? "opacity-50" : ""}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${dot} flex-shrink-0`} />
                          <span className={`text-[9px] truncate text-foreground ${s.is_completed ? "line-through" : ""}`}>{s.title}</span>
                        </button>
                      );
                    })}
                    {sessions.length > 2 && <p className="text-[9px] text-muted-foreground px-1">+{sessions.length - 2} more</p>}
                    {dayTasks.length > 0 && (
                      <div className="flex gap-0.5 px-1 pt-0.5">
                        {dayTasks.slice(0, 5).map((t: any) => (
                          <span key={t.id} className={`w-1 h-1 rounded-full ${t.completed ? "bg-success" : "bg-warning"}`} title={t.title} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">{format(day, "EEEE, MMMM d")}</p>
                {sessions.length === 0 && dayTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No sessions or tasks</p>
                ) : (
                  <div className="space-y-1.5 max-h-60 overflow-auto">
                    {sessions.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 p-1.5 rounded-md bg-muted/40">
                        <button onClick={() => onToggleSession(s.id, s.plan_id)} disabled={s.is_completed}
                          className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${s.is_completed ? "bg-success border-success" : "border-muted-foreground/40 hover:border-primary"}`}>
                          {s.is_completed && <Check className="w-2.5 h-2.5 text-success-foreground" />}
                        </button>
                        <span className="text-base">{s.plan?.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-medium truncate ${s.is_completed ? "text-muted-foreground line-through" : "text-foreground"}`}>{s.title}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{s.plan?.title}</p>
                        </div>
                        {s.plan && <button onClick={() => { onOpenPlan(s.plan!); setOpenDay(null); }} className="text-[10px] text-primary hover:underline flex-shrink-0">Open</button>}
                      </div>
                    ))}
                    {dayTasks.map((t: any) => (
                      <div key={t.id} className="flex items-center gap-2 p-1.5 rounded-md bg-muted/40">
                        <span className={`w-2 h-2 rounded-full ${t.completed ? "bg-success" : "bg-warning"}`} />
                        <p className={`text-xs ${t.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>✅ {t.title}</p>
                      </div>
                    ))}
                  </div>
                )}
                {plans.length > 0 && (
                  <button
                    onClick={() => { setAddDay(dateKey); setAddPlanId(plans[0]?.id || ""); setOpenDay(null); }}
                    className="w-full flex items-center justify-center gap-1 mt-2 px-2 py-1.5 rounded-md bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary/20 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add session on this day
                  </button>
                )}
              </PopoverContent>
            </Popover>
          );
        })}
      </div>

      {/* Quick-add modal */}
      <AnimatePresence>
        {addDay && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
            onClick={() => setAddDay(null)}>
            <motion.div initial={{ scale: 0.95, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 8 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Add session — {format(parseISO(addDay), "MMM d")}</p>
                <button onClick={() => setAddDay(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Plan</label>
                <select value={addPlanId} onChange={(e) => setAddPlanId(e.target.value)} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none">
                  {plans.map((p) => <option key={p.id} value={p.id}>{p.emoji} {p.title}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Session title</label>
                <input value={addTitle} onChange={(e) => setAddTitle(e.target.value)} autoFocus placeholder="e.g. Review chapter 5" className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring" onKeyDown={(e) => { if (e.key === "Enter") handleQuickAdd(); }} />
              </div>
              <button onClick={handleQuickAdd} disabled={!addTitle.trim() || !addPlanId} className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40">Add Session</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Plan Card (redesigned, project-style) ──────────────────────────
function PlanCard({ plan, sessions = [], hasToday = false, onClick }: { plan: Plan; sessions?: SessionLite[]; hasToday?: boolean; onClick: () => void }) {
  const style = CATEGORY_STYLES[plan.category] || CATEGORY_STYLES.study;
  const daysLeft = plan.end_date ? differenceInDays(parseISO(plan.end_date), new Date()) : null;
  const totalSessions = sessions.length;
  const doneSessions = sessions.filter((s) => s.is_completed).length;
  const sessionPct = totalSessions > 0 ? Math.round((doneSessions / totalSessions) * 100) : (plan.progress || 0);
  const progress = Math.max(plan.progress || 0, sessionPct);

  // Days-remaining pill styling
  let pill: { text: string; cls: string } | null = null;
  if (daysLeft === null) {
    pill = { text: "No deadline", cls: "bg-muted text-muted-foreground" };
  } else if (daysLeft < 0) {
    pill = { text: `${Math.abs(daysLeft)}d overdue`, cls: "bg-destructive text-destructive-foreground" };
  } else if (daysLeft === 0) {
    pill = { text: "Due today", cls: "bg-destructive/10 text-destructive" };
  } else if (daysLeft <= 6) {
    pill = { text: `${daysLeft}d left`, cls: "bg-destructive/10 text-destructive" };
  } else if (daysLeft <= 14) {
    pill = { text: `${daysLeft}d left`, cls: "bg-warning/10 text-warning" };
  } else {
    pill = { text: `${daysLeft}d left`, cls: "bg-success/10 text-success" };
  }

  // Progress ring math
  const r = 20, c = 2 * Math.PI * r;
  const dash = (progress / 100) * c;

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      onClick={onClick}
      className={`relative cursor-pointer rounded-2xl border ${style.border} bg-gradient-to-br ${style.gradient} hover:shadow-lg transition-shadow overflow-hidden`}
    >
      {/* Colored left border */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${style.text.replace("text-", "bg-")}`} />

      <div className="p-4 pl-5 space-y-3 relative">
        {/* Top row: emoji + title/goal + ring */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <span className="text-[40px] leading-none flex-shrink-0">{plan.emoji}</span>
            <div className="min-w-0 pt-1">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-foreground truncate">{plan.title}</h3>
                {hasToday && <span className="w-2 h-2 rounded-full bg-primary animate-pulse flex-shrink-0" title="Session due today" />}
              </div>
              {plan.goal && <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{plan.goal}</p>}
            </div>
          </div>

          {/* Progress ring */}
          <div className="relative flex-shrink-0">
            <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
              <circle cx="24" cy="24" r={r} stroke="hsl(var(--muted))" strokeWidth="4" fill="none" />
              <circle
                cx="24" cy="24" r={r}
                stroke="hsl(var(--primary))" strokeWidth="4" fill="none"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${c}`}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] font-bold text-foreground">{progress}%</span>
            </div>
          </div>
        </div>

        {/* Days-left pill */}
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${pill.cls} flex items-center gap-1`}>
            {daysLeft !== null && daysLeft < 0 ? <AlertCircle className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
            {pill.text}
          </span>
          {totalSessions > 0 && (
            <span className="text-[10px] text-muted-foreground font-medium">{doneSessions}/{totalSessions} sessions</span>
          )}
        </div>

        {/* Mini progress bar for sessions */}
        {totalSessions > 0 && (
          <div className="h-1 bg-muted/60 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${sessionPct}%` }} />
          </div>
        )}

        {/* Footer row: category badge + chevron */}
        <div className="flex items-center justify-between pt-1">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text} capitalize`}>{plan.category}</span>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Plan Row (List view) ───────────────────────────────────────────
function PlanRow({ plan, sessions = [], overdue = false, onClick }: { plan: Plan; sessions?: SessionLite[]; overdue?: boolean; onClick: () => void }) {
  const style = CATEGORY_STYLES[plan.category] || CATEGORY_STYLES.study;
  const daysLeft = plan.end_date ? differenceInDays(parseISO(plan.end_date), new Date()) : null;
  const totalSessions = sessions.length;
  const doneSessions = sessions.filter((s) => s.is_completed).length;
  const sessionPct = totalSessions > 0 ? Math.round((doneSessions / totalSessions) * 100) : (plan.progress || 0);

  let pillCls = "bg-muted text-muted-foreground", pillText = "No deadline";
  if (daysLeft !== null) {
    if (daysLeft < 0) { pillCls = "bg-destructive text-destructive-foreground"; pillText = `${Math.abs(daysLeft)}d overdue`; }
    else if (daysLeft <= 6) { pillCls = "bg-destructive/10 text-destructive"; pillText = `${daysLeft}d left`; }
    else if (daysLeft <= 14) { pillCls = "bg-warning/10 text-warning"; pillText = `${daysLeft}d left`; }
    else { pillCls = "bg-success/10 text-success"; pillText = `${daysLeft}d left`; }
  }

  return (
    <motion.div whileHover={{ x: 2 }} onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-xl border ${overdue ? "border-destructive/30" : "border-border"} bg-card hover:bg-muted/40 cursor-pointer transition-colors`}>
      <span className="text-2xl flex-shrink-0">{plan.emoji}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground truncate">{plan.title}</p>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text} capitalize flex-shrink-0`}>{plan.category}</span>
        </div>
        {plan.goal && <p className="text-[11px] text-muted-foreground truncate">{plan.goal}</p>}
        <div className="flex items-center gap-2 mt-1.5">
          <div className="h-1 flex-1 bg-muted rounded-full overflow-hidden max-w-[200px]">
            <div className="h-full bg-primary rounded-full" style={{ width: `${sessionPct}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground font-medium">{sessionPct}%</span>
          {totalSessions > 0 && <span className="text-[10px] text-muted-foreground">· {doneSessions}/{totalSessions}</span>}
        </div>
      </div>
      <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${pillCls} flex-shrink-0`}>{pillText}</span>
      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
    </motion.div>
  );
}

// ─── Plan Detail (Professional Redesign) ────────────────────────────
function PlanDetail({ plan, navigate, onBack, onDelete, onUpdate }: { plan: Plan; navigate: ReturnType<typeof useNavigate>; onBack: () => void; onDelete: () => void; onUpdate: (updates: Partial<Plan>) => Promise<void> }) {
  const { data: sessions = [] } = usePlanSessions(plan.id);
  const createSession = useCreateSession();
  const toggleSession = useToggleSession();
  const [showAdd, setShowAdd] = useState(false);
  const [sessionForm, setSessionForm] = useState({ title: "", date: "", note: "" });
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: plan.title, goal: plan.goal || "", description: plan.description || "",
    start_date: plan.start_date || "", end_date: plan.end_date || "", duration: plan.duration || "",
    category: plan.category, emoji: plan.emoji || "📘",
  });
  const [replanOpen, setReplanOpen] = useState(false);
  const [replanInstructions, setReplanInstructions] = useState("");
  const [replanLoading, setReplanLoading] = useState(false);
  const [replanDraft, setReplanDraft] = useState("");
  const style = CATEGORY_STYLES[plan.category] || CATEGORY_STYLES.study;

  const completed = sessions.filter((s) => s.is_completed).length;
  const total = sessions.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const daysLeft = plan.end_date ? differenceInDays(parseISO(plan.end_date), new Date()) : null;
  const totalDays = plan.start_date && plan.end_date ? differenceInDays(parseISO(plan.end_date), parseISO(plan.start_date)) : null;
  const elapsedDays = plan.start_date ? Math.max(0, differenceInDays(new Date(), parseISO(plan.start_date))) : null;
  const timeProgress = totalDays && totalDays > 0 ? Math.min(100, Math.round(((elapsedDays || 0) / totalDays) * 100)) : 0;

  const isOverdue = daysLeft !== null && daysLeft < 0 && plan.status === "active";
  const isDueSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3 && plan.status === "active";

  const addSession = async () => {
    if (!sessionForm.title.trim()) return;
    await createSession.mutateAsync({ plan_id: plan.id, title: sessionForm.title, date: sessionForm.date || null, note: sessionForm.note });
    setSessionForm({ title: "", date: "", note: "" }); setShowAdd(false); toast.success("Session added");
  };

  const saveEdits = async () => {
    await onUpdate({
      title: editForm.title, goal: editForm.goal, description: editForm.description,
      start_date: editForm.start_date || null, end_date: editForm.end_date || null,
      duration: editForm.duration, category: editForm.category, emoji: editForm.emoji,
    });
    setEditing(false);
    toast.success("Plan updated");
  };

  const handleReplan = async () => {
    if (replanLoading) return;
    setReplanLoading(true); setReplanDraft("");
    let content = "";
    try {
      const originalPrompt = plan.goal || plan.title;
      const previousPlan = plan.description || "(no previous plan content)";
      const userChanges = replanInstructions.trim() || "Improve and refine the plan; make it more realistic and actionable.";
      const prompt = `You are an expert study planner. The user has an existing plan and wants to REPLAN it with changes.\n\nORIGINAL GOAL:\n${originalPrompt}\n\nPREVIOUS PLAN:\n${previousPlan}\n\nUSER'S CHANGE REQUESTS:\n${userChanges}\n\nGenerate a COMPLETE NEW plan that:\n- Strictly respects the user's change requests\n- Keeps clear titles, dates, milestones and time allocations\n- Stays within the original timeframe unless the user changed it\n- Is realistic, structured and ready to follow\n\nOutput as clean markdown.`;
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
      });
      if (!resp.ok || !resp.body) throw new Error("AI error");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx); buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try { const p = JSON.parse(json); const c = p.choices?.[0]?.delta?.content; if (c) { content += c; setReplanDraft(content); } }
          catch { buffer = line + "\n" + buffer; break; }
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to replan");
    } finally {
      setReplanLoading(false);
    }
  };

  const acceptReplan = async () => {
    if (!replanDraft.trim()) return;
    await onUpdate({ description: replanDraft, source_type: "ai" });
    toast.success("Plan replanned and saved");
    setReplanOpen(false); setReplanInstructions(""); setReplanDraft("");
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/60 backdrop-blur-sm">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => {
              const remaining = sessions.filter((s) => !s.is_completed).length;
              const prompt = `Review my study plan: ${plan.title}, ${pct}% complete, ${remaining} remaining sessions. Suggest improvements and what I should focus on next.`;
              navigate("/assistant", { state: { prompt } });
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
          >
            <Brain className="w-3.5 h-3.5" /> Ask SOFI to improve this plan
          </button>
          <button onClick={() => setReplanOpen((v) => !v)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-info/10 text-info text-xs font-medium hover:bg-info/20 transition-colors">
            <Wand2 className="w-3.5 h-3.5" /> {replanOpen ? "Close Replan" : "Replan with AI"}
          </button>
          <button onClick={() => setEditing(!editing)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-medium hover:text-foreground transition-colors">
            <Edit3 className="w-3.5 h-3.5" /> {editing ? "Cancel" : "Edit"}
          </button>
          {plan.status === "active" && <button onClick={() => onUpdate({ status: "completed" })} className="px-3 py-1.5 rounded-lg bg-success/10 text-success text-xs font-medium hover:bg-success/20">✓ Complete</button>}
          {plan.status === "completed" && <button onClick={() => onUpdate({ status: "active" })} className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20">Reactivate</button>}
          <button onClick={onDelete} className="px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">
          {/* Hero card */}
          <div className={`relative rounded-2xl border ${isOverdue ? "border-destructive/40" : style.border} overflow-hidden`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${style.gradient} opacity-40`} />
            <div className="relative p-6 space-y-4">
              {editing ? (
                <div className="space-y-3">
                  <div className="flex gap-3 items-start">
                    <div className="flex flex-wrap gap-1 max-w-[120px]">
                      {EMOJI_OPTIONS.map((e) => <button key={e} onClick={() => setEditForm({ ...editForm, emoji: e })} className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${editForm.emoji === e ? "bg-primary/20 ring-1 ring-primary" : "bg-muted/60"}`}>{e}</button>)}
                    </div>
                    <div className="flex-1 space-y-2">
                      <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="w-full bg-background/60 border border-border rounded-lg px-3 py-2 text-lg font-bold text-foreground outline-none focus:ring-1 focus:ring-ring" />
                      <input value={editForm.goal} onChange={(e) => setEditForm({ ...editForm, goal: e.target.value })} placeholder="Goal" className="w-full bg-background/60 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="date" value={editForm.start_date} onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })} className="bg-background/60 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none" />
                    <input type="date" value={editForm.end_date} onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })} className="bg-background/60 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none" />
                    <input value={editForm.duration} onChange={(e) => setEditForm({ ...editForm, duration: e.target.value })} placeholder="Duration" className="bg-background/60 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(CATEGORY_STYLES).map((c) => <button key={c} onClick={() => setEditForm({ ...editForm, category: c })} className={`px-3 py-1 rounded-lg text-xs font-medium capitalize ${editForm.category === c ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground"}`}>{c}</button>)}
                  </div>
                  <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={4} placeholder="Description / AI Plan content..." className="w-full bg-background/60 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none resize-none" />
                  <button onClick={saveEdits} className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 flex items-center justify-center gap-1.5"><Save className="w-4 h-4" /> Save Changes</button>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-4xl">{plan.emoji}</span>
                      <div>
                        <h1 className="text-xl font-bold text-foreground">{plan.title}</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">{plan.goal}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${style.bg} ${style.text} capitalize`}>{plan.category}</span>
                      {isOverdue && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-destructive/10 text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Overdue by {Math.abs(daysLeft!)}d</span>}
                      {isDueSoon && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-warning/10 text-warning flex items-center gap-1"><Bell className="w-3 h-3" /> {daysLeft} days left</span>}
                    </div>
                  </div>

                  {/* Timeline + Progress */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-background/40 rounded-xl p-3 space-y-2">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Timeline</p>
                      <div className="flex items-center gap-2 text-sm">
                        <CalendarIcon className="w-4 h-4 text-primary" />
                        <span className="text-foreground font-medium">
                          {plan.start_date ? format(parseISO(plan.start_date), "MMM d, yyyy") : "No start"}
                          {" → "}
                          {plan.end_date ? format(parseISO(plan.end_date), "MMM d, yyyy") : "No end"}
                        </span>
                      </div>
                      {plan.duration && <p className="text-xs text-muted-foreground">⏱️ Duration: {plan.duration}</p>}
                      {totalDays !== null && totalDays > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-muted-foreground"><span>Time elapsed</span><span>{timeProgress}%</span></div>
                          <div className="h-1.5 bg-muted rounded-full"><div className="h-full bg-info/60 rounded-full transition-all" style={{ width: `${timeProgress}%` }} /></div>
                        </div>
                      )}
                    </div>
                    <div className="bg-background/40 rounded-xl p-3 space-y-2">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Progress</p>
                      <div className="flex items-center gap-3">
                        <div className="relative w-14 h-14">
                          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                            <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" className="text-muted" strokeWidth="4" />
                            <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" className="text-primary" strokeWidth="4" strokeDasharray={`${pct * 1.508} 151`} strokeLinecap="round" />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">{pct}%</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">{completed}/{total}</p>
                          <p className="text-[10px] text-muted-foreground">sessions done</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Replan with AI panel */}
          <AnimatePresence>
            {replanOpen && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="glass-card p-5 space-y-3 border-info/30">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Wand2 className="w-4 h-4 text-info" /> Replan with AI</p>
                    <button onClick={() => { setReplanOpen(false); setReplanDraft(""); setReplanInstructions(""); }} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                  </div>
                  <p className="text-xs text-muted-foreground">Tell the AI what to change. It will rewrite the whole plan keeping your goal in mind.</p>
                  <textarea value={replanInstructions} onChange={(e) => setReplanInstructions(e.target.value)} rows={3} placeholder="e.g. Make it shorter, add daily revision, focus more on chapter 3, exclude weekends..." className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none focus:ring-1 focus:ring-ring" />
                  <div className="flex flex-wrap gap-1.5">
                    {["Make it shorter and more focused", "Add daily checkpoints", "Exclude weekends", "Make it more intensive", "Slow it down — I have less time per day"].map((s) => (
                      <button key={s} onClick={() => setReplanInstructions((v) => v ? `${v}\n${s}` : s)} className="px-2 py-1 rounded-lg text-[10px] font-medium bg-muted/60 text-muted-foreground hover:bg-info/10 hover:text-info transition-colors">{s}</button>
                    ))}
                  </div>
                  <button onClick={handleReplan} disabled={replanLoading} className="w-full py-2 rounded-lg bg-info text-info-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-1.5">
                    {replanLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Replanning...</> : <><RefreshCw className="w-4 h-4" /> Generate New Plan</>}
                  </button>
                  {replanDraft && (
                    <div className="bg-muted/30 border border-border rounded-xl p-4 max-h-80 overflow-auto">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Preview</p>
                      <div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{replanDraft}</ReactMarkdown></div>
                      {!replanLoading && (
                        <div className="flex gap-2 mt-3">
                          <button onClick={acceptReplan} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90"><Save className="w-3 h-3 inline mr-1" /> Replace Current Plan</button>
                          <button onClick={handleReplan} className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-medium hover:text-foreground"><RefreshCw className="w-3 h-3 inline mr-1" /> Regenerate</button>
                          <button onClick={() => setReplanDraft("")} className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-medium hover:text-foreground">Discard</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Description / AI Plan */}
          {plan.description && !editing && (
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {plan.source_type === "ai" ? "🧠 AI-Generated Plan" : "📝 Description"}
                </p>
                <div className="flex gap-1.5">
                  <button onClick={() => setEditing(true)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-muted-foreground text-[10px] font-medium hover:text-foreground transition-colors"><Edit3 className="w-3 h-3" /> Edit</button>
                  <button onClick={() => setReplanOpen(true)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-info/10 text-info text-[10px] font-medium hover:bg-info/20 transition-colors"><Wand2 className="w-3 h-3" /> Replan</button>
                </div>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{plan.description}</ReactMarkdown></div>
            </div>
          )}

          {/* Sessions */}
          <SessionsSection
            plan={plan}
            sessions={sessions as any}
            showAdd={showAdd}
            setShowAdd={setShowAdd}
            sessionForm={sessionForm}
            setSessionForm={setSessionForm}
            addSession={addSession}
            onToggle={async (s) => {
              const willComplete = !s.is_completed;
              await toggleSession.mutateAsync({ id: s.id, is_completed: willComplete, plan_id: plan.id });
              if (willComplete) {
                const awarded = awardXpOnce(`session:${s.id}`, 30);
                toast.success(awarded ? "✅ Done! +30 XP 🎯" : "✅ Done!");
              } else {
                revokeXpKey(`session:${s.id}`);
              }
            }}
            onQuickAddDate={(date) => { setSessionForm({ title: "", date, note: "" }); setShowAdd(true); }}
          />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Sessions Section: Timeline + Week View + Burn-down + Confetti ───
type SessionRow = { id: string; plan_id: string; title: string; date: string | null; is_completed: boolean; note?: string; created_at?: string };

function SessionsSection({
  plan, sessions, showAdd, setShowAdd, sessionForm, setSessionForm, addSession, onToggle, onQuickAddDate,
}: {
  plan: Plan;
  sessions: SessionRow[];
  showAdd: boolean;
  setShowAdd: (v: boolean) => void;
  sessionForm: { title: string; date: string; note: string };
  setSessionForm: (f: { title: string; date: string; note: string }) => void;
  addSession: () => Promise<void>;
  onToggle: (s: SessionRow) => Promise<void>;
  onQuickAddDate: (date: string) => void;
}) {
  const [view, setView] = useState<"timeline" | "week">("timeline");
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [burst, setBurst] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...sessions].sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date);
    });
  }, [sessions]);

  // Group by week
  const weekGroups = useMemo(() => {
    const groups = new Map<string, { label: string; weekStart: Date; items: SessionRow[] }>();
    const undated: SessionRow[] = [];
    sorted.forEach((s) => {
      if (!s.date) { undated.push(s); return; }
      const d = parseISO(s.date);
      const ws = startOfWeek(d, { weekStartsOn: 1 });
      const key = format(ws, "yyyy-MM-dd");
      if (!groups.has(key)) {
        const we = endOfWeek(d, { weekStartsOn: 1 });
        groups.set(key, { label: `${format(ws, "MMM d")}–${format(we, "MMM d")}`, weekStart: ws, items: [] });
      }
      groups.get(key)!.items.push(s);
    });
    const arr = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    return { groups: arr, undated };
  }, [sorted]);

  // Burn-down data
  const burnData = useMemo(() => {
    if (!plan.start_date || !plan.end_date) return null;
    const start = parseISO(plan.start_date);
    const end = parseISO(plan.end_date);
    const days = differenceInDays(end, start);
    if (days <= 0 || sessions.length === 0) return null;
    const sample = Math.max(1, Math.floor(days / 12));
    const points: { date: string; ideal: number; actual: number }[] = [];
    const total = sessions.length;
    const completedTimes = sessions
      .filter((s) => s.is_completed && s.created_at)
      .map((s) => parseISO(s.created_at!))
      .sort((a, b) => a.getTime() - b.getTime());
    for (let i = 0; i <= days; i += sample) {
      const d = addDays(start, i);
      const ideal = Math.max(0, total - (total * (i / days)));
      const completedByThen = completedTimes.filter((t) => t <= d).length;
      const actual = Math.max(0, total - completedByThen);
      points.push({ date: format(d, "MMM d"), ideal: Number(ideal.toFixed(1)), actual });
    }
    return points;
  }, [plan.start_date, plan.end_date, sessions]);

  const handleToggle = async (s: SessionRow) => {
    if (!s.is_completed) setBurst(s.id);
    await onToggle(s);
    if (!s.is_completed) setTimeout(() => setBurst(null), 700);
  };

  const jumpToToday = () => {
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
    if (view === "week") return;
    setTimeout(() => {
      const today = format(new Date(), "yyyy-MM-dd");
      document.getElementById(`session-day-${today}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Sessions / Milestones</p>
          <span className="text-[10px] text-muted-foreground">· {sessions.filter((s) => s.is_completed).length}/{sessions.length}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex bg-muted/40 rounded-lg p-0.5">
            <button onClick={() => setView("timeline")} className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${view === "timeline" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <LayoutList className="w-3 h-3" /> Timeline
            </button>
            <button onClick={() => setView("week")} className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${view === "week" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <CalendarDays className="w-3 h-3" /> Week
            </button>
          </div>
          <button onClick={jumpToToday} className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary/20 transition-colors">Jump to today</button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:opacity-90 transition-opacity"><Plus className="w-3 h-3" /> Add</button>
        </div>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="glass-card p-4 space-y-3">
              <input value={sessionForm.title} onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })} placeholder="Session title" autoFocus className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring" />
              <div className="flex gap-2">
                <input type="date" value={sessionForm.date} onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })} className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none" />
                <button onClick={addSession} disabled={!sessionForm.title.trim()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40">Add</button>
                <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm font-medium">Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {burnData && burnData.length > 1 && view === "timeline" && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold text-foreground flex items-center gap-1.5"><TrendingUp className="w-3 h-3 text-primary" /> Burn-down</p>
            <p className="text-[10px] text-muted-foreground">Ideal vs Actual remaining</p>
          </div>
          <div className="h-[140px] -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={burnData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="actualBurn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={24} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                <Area type="monotone" dataKey="ideal" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeWidth={1.5} fill="none" />
                <Area type="monotone" dataKey="actual" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#actualBurn)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {sessions.length === 0 && (
        <div className="text-center py-10 bg-muted/20 rounded-xl border border-dashed border-border">
          <Target className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No sessions yet</p>
          <p className="text-xs text-muted-foreground mt-0.5">Add milestones to track your progress</p>
        </div>
      )}

      {view === "timeline" && sessions.length > 0 && (
        <div className="space-y-5">
          {weekGroups.groups.map(([key, grp], gi) => (
            <div key={key}>
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-[11px] font-bold text-foreground uppercase tracking-wider">Week {gi + 1}</h4>
                <span className="text-[10px] text-muted-foreground">{grp.label}</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <TimelineList items={grp.items} burst={burst} onToggle={handleToggle} onQuickAddDate={onQuickAddDate} />
            </div>
          ))}
          {weekGroups.undated.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Undated</h4>
                <div className="flex-1 h-px bg-border" />
              </div>
              <TimelineList items={weekGroups.undated} burst={burst} onToggle={handleToggle} onQuickAddDate={onQuickAddDate} />
            </div>
          )}
        </div>
      )}

      {view === "week" && (
        <WeekView
          weekStart={weekStart}
          setWeekStart={setWeekStart}
          sessions={sorted}
          onToggle={handleToggle}
          onAddOnDay={(d) => onQuickAddDate(format(d, "yyyy-MM-dd"))}
          burst={burst}
        />
      )}
    </div>
  );
}

function TimelineList({ items, burst, onToggle, onQuickAddDate }: {
  items: SessionRow[];
  burst: string | null;
  onToggle: (s: SessionRow) => Promise<void>;
  onQuickAddDate: (date: string) => void;
}) {
  return (
    <div className="relative pl-1">
      {items.map((s, idx) => {
        const sd = s.date ? parseISO(s.date) : null;
        const overdue = sd && isPast(sd) && !isToday(sd) && !s.is_completed;
        const today_ = sd && isToday(sd);
        const tomorrow_ = sd && isTomorrow(sd);
        const future = sd && !isPast(sd) && !today_ && !s.is_completed;
        const next = items[idx + 1];
        const lineSolid = s.is_completed || (sd ? isPast(sd) : false);
        const nodeBg = s.is_completed ? "bg-success border-success"
          : today_ ? "bg-primary border-primary"
          : tomorrow_ ? "bg-warning border-warning"
          : overdue ? "bg-destructive border-destructive"
          : "bg-card border-muted-foreground/30";
        const showPulse = today_ && !s.is_completed;

        let midDate: string | null = null;
        if (next && s.date && next.date) {
          const a = parseISO(s.date); const b = parseISO(next.date);
          const mid = new Date((a.getTime() + b.getTime()) / 2);
          midDate = format(mid, "yyyy-MM-dd");
        }

        return (
          <div key={s.id} id={s.date ? `session-day-${s.date}` : undefined} className="relative">
            {idx < items.length - 1 && (
              <div className={`absolute left-[11px] top-7 bottom-[-12px] w-px ${lineSolid ? "bg-border" : "border-l border-dashed border-border"}`} />
            )}
            <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}
              className="flex items-start gap-3 py-2">
              <div className="relative flex-shrink-0 mt-0.5">
                <button
                  onClick={() => onToggle(s)}
                  className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center transition-all ${nodeBg} ${showPulse ? "animate-pulse" : ""}`}
                  title={s.is_completed ? "Mark incomplete" : "Mark complete"}
                >
                  {s.is_completed && <Check className="w-3 h-3 text-success-foreground" />}
                </button>
                {burst === s.id && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    {Array.from({ length: 6 }).map((_, i) => {
                      const angle = (Math.PI * 2 * i) / 6;
                      const dx = Math.cos(angle) * 30;
                      const dy = Math.sin(angle) * 30;
                      const colors = ["bg-primary", "bg-success", "bg-warning", "bg-info", "bg-destructive", "bg-primary"];
                      return (
                        <motion.div key={i}
                          initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                          animate={{ opacity: 0, scale: 0.4, x: dx, y: dy, rotate: 180 }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                          className={`absolute w-1.5 h-1.5 ${colors[i]} rounded-sm`}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
              <div className={`flex-1 min-w-0 rounded-lg px-3 py-2 border transition-all ${
                s.is_completed ? "opacity-60 bg-muted/20 border-border" :
                overdue ? "bg-destructive/5 border-destructive/30" :
                today_ ? "bg-primary/5 border-primary/30" :
                "bg-card border-border"
              }`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-sm font-medium ${s.is_completed ? "text-muted-foreground line-through" : "text-foreground"}`}>{s.title}</p>
                  {!s.is_completed && today_ && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">TODAY</span>}
                  {!s.is_completed && tomorrow_ && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-warning text-warning-foreground">TOMORROW</span>}
                  {overdue && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground flex items-center gap-0.5"><AlertCircle className="w-2.5 h-2.5" /> OVERDUE</span>}
                </div>
                {s.date && <p className="text-[10px] text-muted-foreground mt-0.5">{format(parseISO(s.date), "EEE, MMM d, yyyy")}</p>}
                {s.note && <p className="text-[11px] text-muted-foreground mt-1 italic">{s.note}</p>}
              </div>
            </motion.div>
            {midDate && idx < items.length - 1 && (
              <div className="relative h-1 group">
                <button
                  onClick={() => onQuickAddDate(midDate!)}
                  className="absolute left-[5px] -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-primary hover:text-primary-foreground transition-all"
                  title={`Insert session on ${midDate}`}
                >+</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function WeekView({
  weekStart, setWeekStart, sessions, onToggle, onAddOnDay, burst,
}: {
  weekStart: Date;
  setWeekStart: (d: Date) => void;
  sessions: SessionRow[];
  onToggle: (s: SessionRow) => Promise<void>;
  onAddOnDay: (d: Date) => void;
  burst: string | null;
}) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const byDate = useMemo(() => {
    const m = new Map<string, SessionRow[]>();
    sessions.forEach((s) => { if (s.date) { const a = m.get(s.date) || []; a.push(s); m.set(s.date, a); } });
    return m;
  }, [sessions]);

  const weekLabel = `${format(weekStart, "MMM d")} – ${format(addDays(weekStart, 6), "MMM d, yyyy")}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">{weekLabel}</p>
        <div className="flex items-center gap-1">
          <button onClick={() => setWeekStart(subWeeks(weekStart, 1))} className="w-7 h-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center">‹</button>
          <button onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))} className="px-2 py-1 rounded-md bg-primary/10 text-primary text-[10px] font-semibold hover:bg-primary/20 transition-colors">This week</button>
          <button onClick={() => setWeekStart(addWeeks(weekStart, 1))} className="w-7 h-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center">›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const items = byDate.get(key) || [];
          const today_ = isToday(d);
          return (
            <div key={key} className={`rounded-lg border p-2 min-h-[140px] flex flex-col gap-1.5 transition-colors ${today_ ? "bg-primary/5 border-primary/30" : "bg-card border-border hover:border-primary/20"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-semibold uppercase text-muted-foreground">{format(d, "EEE")}</p>
                  <p className={`text-sm font-bold ${today_ ? "text-primary" : "text-foreground"}`}>{format(d, "d")}</p>
                </div>
                <button onClick={() => onAddOnDay(d)} className="w-5 h-5 rounded bg-muted/60 hover:bg-primary/20 hover:text-primary text-muted-foreground text-[11px] font-bold flex items-center justify-center transition-colors" title="Add session">+</button>
              </div>
              <div className="space-y-1 flex-1 overflow-auto">
                {items.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground/60 italic">—</p>
                ) : items.map((s) => {
                  const sd = parseISO(s.date!);
                  const overdue = isPast(sd) && !isToday(sd) && !s.is_completed;
                  const cls = s.is_completed
                    ? "bg-muted/40 text-muted-foreground line-through"
                    : overdue
                    ? "bg-destructive/15 text-destructive"
                    : "bg-primary/15 text-primary";
                  return (
                    <button key={s.id} onClick={() => onToggle(s)}
                      className={`w-full text-left text-[10px] font-medium px-1.5 py-1 rounded ${cls} hover:opacity-80 transition-opacity truncate`}
                      title={s.is_completed ? "Mark incomplete" : "Mark complete"}>
                      {s.title}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

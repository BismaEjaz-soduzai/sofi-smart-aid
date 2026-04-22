import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  User as UserIcon, Camera, Mail, Lock, Calendar as CalendarIcon, Pencil,
  CheckCircle2, StickyNote, Trophy, Loader2, Flame,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUploadAvatar } from "@/hooks/useProfile";
import { useTasks } from "@/hooks/useTasks";
import { useNotes } from "@/hooks/useNotes";
import { usePlans } from "@/hooks/usePlans";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import PageShell from "@/components/PageShell";
import {
  format, eachDayOfInterval, isSameDay, subDays, startOfDay, parseISO,
} from "date-fns";
import {
  Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

/* ─────────── helpers ─────────── */

function resizeImage(file: File, maxSize = 400): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result as string; };
    reader.onerror = () => reject(new Error("Read failed"));
    img.onload = () => {
      const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas error"));
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Blob failed")), "image/jpeg", 0.9);
    };
    img.onerror = () => reject(new Error("Image load failed"));
    reader.readAsDataURL(file);
  });
}

function computeStreak(completedDates: Date[]): number {
  if (completedDates.length === 0) return 0;
  const set = new Set(completedDates.map((d) => format(d, "yyyy-MM-dd")));
  let streak = 0;
  let cursor = new Date();
  // If today not done, streak starts from yesterday
  if (!set.has(format(cursor, "yyyy-MM-dd"))) cursor = subDays(cursor, 1);
  while (set.has(format(cursor, "yyyy-MM-dd"))) {
    streak++;
    cursor = subDays(cursor, 1);
  }
  return streak;
}

/* ─────────── page ─────────── */

export default function ProfilePage() {
  const { user } = useAuth();
  const uploadAvatar = useUploadAvatar();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: tasks = [] } = useTasks();
  const { data: notes = [] } = useNotes();
  const { data: plans = [] } = usePlans();

  const initialName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";
  const [name, setName] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [savingName, setSavingName] = useState(false);

  useEffect(() => { setName(initialName); }, [initialName]);

  const avatarUrl: string | undefined = user?.user_metadata?.avatar_url;

  const initials = useMemo(() =>
    (name || "U").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2),
    [name]
  );

  const memberSince = user?.created_at ? format(new Date(user.created_at), "MMMM yyyy") : "—";

  /* derived stats */
  const completedTasks = tasks.filter((t) => t.completed);
  const completedDates = completedTasks
    .map((t) => t.completed_at ? new Date(t.completed_at) : null)
    .filter((d): d is Date => !!d);
  const streak = computeStreak(completedDates);
  const completionRate = tasks.length ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
  const avgPerDay = (() => {
    if (completedDates.length === 0) return 0;
    const days = new Set(completedDates.map((d) => format(d, "yyyy-MM-dd"))).size;
    return Math.round((completedTasks.length / Math.max(days, 1)) * 10) / 10;
  })();
  const productiveHour = (() => {
    if (completedDates.length === 0) return null;
    const buckets = new Array(24).fill(0);
    completedDates.forEach((d) => buckets[d.getHours()]++);
    let max = 0, hour = -1;
    buckets.forEach((c, i) => { if (c > max) { max = c; hour = i; } });
    return hour;
  })();

  /* avatar upload */
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    try {
      const blob = await resizeImage(file, 400);
      const path = `${user.id}/avatar.jpg`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, blob, {
        upsert: true, contentType: "image/jpeg",
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
      const { error: updErr } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
      if (updErr) throw updErr;
      toast.success("Profile photo updated");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    }
  };

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === initialName) { setEditing(false); return; }
    setSavingName(true);
    const { error } = await supabase.auth.updateUser({ data: { full_name: trimmed } });
    setSavingName(false);
    setEditing(false);
    if (error) toast.error(error.message);
    else toast.success("Name updated");
  };

  return (
    <PageShell title="Profile" description="Your account and progress" icon={UserIcon}>
      <div className="grid gap-6 lg:grid-cols-3 max-w-6xl">
        {/* ─────────── LEFT ─────────── */}
        <motion.aside
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="relative">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={name}
                    className="w-24 h-24 rounded-full object-cover ring-2 ring-border"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary/50 text-primary-foreground flex items-center justify-center text-2xl font-semibold">
                    {initials}
                  </div>
                )}
                {uploadAvatar.isPending && (
                  <div className="absolute inset-0 rounded-full bg-background/60 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                )}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors inline-flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" /> Change Photo
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
            </div>

            {/* Name */}
            <div className="space-y-2">
              {editing ? (
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setName(initialName); setEditing(false); } }}
                  className="w-full text-center text-base font-semibold bg-muted/40 border border-border rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-ring/30"
                />
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="w-full inline-flex items-center justify-center gap-1.5 text-base font-semibold text-foreground hover:text-primary transition-colors"
                >
                  {name || "Add your name"}
                  <Pencil className="w-3.5 h-3.5 opacity-50" />
                  {savingName && <Loader2 className="w-3 h-3 animate-spin" />}
                </button>
              )}
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="w-3 h-3" /> {user?.email}
              </div>
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                <CalendarIcon className="w-3 h-3" /> Member since {memberSince}
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2">
              <StatBox label="Tasks done" value={completedTasks.length} />
              <StatBox label="Notes" value={notes.length} />
              <StatBox label="Plans" value={plans.length} />
              <StatBox label="Day streak" value={streak} icon={<Flame className="w-3 h-3 text-orange-500" />} />
            </div>
          </div>
        </motion.aside>

        {/* ─────────── RIGHT ─────────── */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="lg:col-span-2"
        >
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="achievements">Achievements</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <OverviewTab
                completedDates={completedDates}
                completionRate={completionRate}
                avgPerDay={avgPerDay}
                productiveHour={productiveHour}
                plansCount={plans.length}
                activePlans={plans.filter((p) => p.status === "active")}
              />
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <ActivityTab tasks={completedTasks} notes={notes} plans={plans} />
            </TabsContent>

            <TabsContent value="achievements" className="mt-4">
              <AchievementsTab
                tasks={tasks}
                notes={notes}
                plans={plans}
                streak={streak}
                completedDates={completedDates}
              />
            </TabsContent>
          </Tabs>
        </motion.section>
      </div>
    </PageShell>
  );
}

/* ─────────── stat box ─────────── */

function StatBox({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/40 border border-border/60 px-3 py-2.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}{label}
      </div>
      <div className="text-xl font-semibold text-foreground mt-0.5">{value}</div>
    </div>
  );
}

/* ─────────── overview tab ─────────── */

function OverviewTab({
  completedDates, completionRate, avgPerDay, productiveHour, plansCount, activePlans,
}: {
  completedDates: Date[];
  completionRate: number;
  avgPerDay: number;
  productiveHour: number | null;
  plansCount: number;
  activePlans: Array<{ id: string; title: string; emoji?: string | null; progress?: number | null; color_tag?: string | null }>;
}) {
  const last7 = eachDayOfInterval({ start: subDays(startOfDay(new Date()), 6), end: new Date() });
  const data = last7.map((d) => ({
    name: format(d, "EEE"),
    count: completedDates.filter((c) => isSameDay(c, d)).length,
  }));

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium">Last 7 days</h4>
          <span className="text-xs text-muted-foreground">Tasks completed</span>
        </div>
        <div style={{ height: 140 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <YAxis hide />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QuickStat label="Completion" value={`${completionRate}%`} />
        <QuickStat label="Avg / day" value={String(avgPerDay)} />
        <QuickStat label="Best hour" value={productiveHour === null ? "—" : `${productiveHour}:00`} />
        <QuickStat label="Plans" value={String(plansCount)} />
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">Active plans</h4>
        {activePlans.length === 0 ? (
          <div className="text-xs text-muted-foreground rounded-lg border border-dashed border-border p-4 text-center">
            No active plans yet
          </div>
        ) : (
          <div className="space-y-2">
            {activePlans.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <ProgressRing value={p.progress ?? 0} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-medium truncate">
                    {p.emoji && <span>{p.emoji}</span>}
                    {p.title}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{p.progress ?? 0}% complete</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}

function ProgressRing({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  return (
    <div className="relative w-12 h-12 shrink-0">
      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="3.5" />
        <circle
          cx="22" cy="22" r={r} fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-foreground">
        {clamped}%
      </div>
    </div>
  );
}

/* ─────────── activity tab ─────────── */

function ActivityTab({
  tasks, notes, plans,
}: {
  tasks: Array<{ id: string; title: string; completed_at: string | null }>;
  notes: Array<{ id: string; title: string; created_at: string }>;
  plans: Array<{ id: string; title: string; created_at: string }>;
}) {
  type Item = { id: string; type: "task" | "note" | "plan"; title: string; date: Date };
  const items: Item[] = [
    ...tasks.filter((t) => t.completed_at).map((t) => ({
      id: `t-${t.id}`, type: "task" as const, title: `Completed: ${t.title}`, date: new Date(t.completed_at!),
    })),
    ...notes.map((n) => ({
      id: `n-${n.id}`, type: "note" as const, title: `Added note: ${n.title}`, date: parseISO(n.created_at),
    })),
    ...plans.map((p) => ({
      id: `p-${p.id}`, type: "plan" as const, title: `Started plan: ${p.title}`, date: parseISO(p.created_at),
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 20);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        No activity yet — start by adding a task or note.
      </div>
    );
  }

  return (
    <ol className="relative border-l border-border ml-3 space-y-4">
      {items.map((it) => {
        const cfg = it.type === "task"
          ? { Icon: CheckCircle2, color: "bg-success/15 text-success" }
          : it.type === "note"
          ? { Icon: StickyNote, color: "bg-info/15 text-info" }
          : { Icon: CalendarIcon, color: "bg-primary/15 text-primary" };
        const Icon = cfg.Icon;
        return (
          <li key={it.id} className="ml-4">
            <span className={`absolute -left-[13px] flex items-center justify-center w-6 h-6 rounded-full ring-4 ring-background ${cfg.color}`}>
              <Icon className="w-3 h-3" />
            </span>
            <div className="rounded-lg border border-border bg-card px-3 py-2">
              <div className="text-sm text-foreground">{it.title}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {format(it.date, "MMM d, yyyy · HH:mm")}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ─────────── achievements tab ─────────── */

interface BadgeDef {
  id: string;
  emoji: string;
  name: string;
  description: string;
  earned: boolean;
}

function AchievementsTab({
  tasks, notes, plans, streak, completedDates,
}: {
  tasks: Array<{ completed: boolean; completed_at: string | null }>;
  notes: Array<unknown>;
  plans: Array<{ status: string }>;
  streak: number;
  completedDates: Date[];
}) {
  const totalCompleted = tasks.filter((t) => t.completed).length;

  // tasks completed in a single day
  const perDay = new Map<string, number>();
  completedDates.forEach((d) => {
    const k = format(d, "yyyy-MM-dd");
    perDay.set(k, (perDay.get(k) || 0) + 1);
  });
  const maxInDay = Math.max(0, ...perDay.values());

  const voiceOpens = (() => {
    try { return parseInt(localStorage.getItem("sofi-voice-opens") || "0", 10); }
    catch { return 0; }
  })();

  const activeDays = (() => {
    try {
      const raw = localStorage.getItem("sofi-active-days");
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.length : 0;
    } catch { return 0; }
  })();

  const badges: BadgeDef[] = [
    { id: "first", emoji: "🥇", name: "First Steps", description: "Complete your first task", earned: totalCompleted >= 1 },
    { id: "roll", emoji: "🔥", name: "On a Roll", description: "7-day completion streak", earned: streak >= 7 },
    { id: "knowledge", emoji: "📚", name: "Knowledge Seeker", description: "Create 10 notes", earned: notes.length >= 10 },
    { id: "planner", emoji: "🗺️", name: "Planner", description: "Create 3 plans", earned: plans.length >= 3 },
    { id: "speed", emoji: "⚡", name: "Speedrunner", description: "Complete 5 tasks in one day", earned: maxInDay >= 5 },
    { id: "over", emoji: "🏆", name: "Overachiever", description: "Complete 25 tasks", earned: totalCompleted >= 25 },
    { id: "grad", emoji: "🎓", name: "Graduate", description: "Finish a full plan", earned: plans.some((p) => p.status === "completed") },
    { id: "consistent", emoji: "🌟", name: "Consistent", description: "14-day completion streak", earned: streak >= 14 },
    { id: "vocal", emoji: "💬", name: "Vocal", description: "Open voice mode 3+ times", earned: voiceOpens >= 3 },
    { id: "committed", emoji: "🚀", name: "Committed", description: "Use SOFI on 7+ different days", earned: activeDays >= 7 },
  ];

  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <h4 className="text-sm font-medium">{earnedCount} of {badges.length} earned</h4>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {badges.map((b) => (
          <div
            key={b.id}
            title={b.description}
            className={`group rounded-xl border p-4 text-center transition-all ${
              b.earned
                ? "border-border bg-card hover:border-primary/40"
                : "border-border/60 bg-muted/20 opacity-50 grayscale"
            }`}
          >
            <div className="text-4xl mb-2 leading-none">{b.emoji}</div>
            <div className="text-xs font-medium text-foreground">{b.name}</div>
            <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2 group-hover:line-clamp-none">
              {b.description}
            </div>
            {b.earned && (
              <Badge variant="outline" className="mt-2 text-[9px] border-success/40 text-success bg-success/10">
                Earned
              </Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

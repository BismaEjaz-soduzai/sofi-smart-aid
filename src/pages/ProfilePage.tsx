import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  User as UserIcon, Camera, Mail, Lock, Calendar as CalendarIcon, Pencil,
  CheckCircle2, StickyNote, Trophy, Loader2, Flame, KeyRound, Save,
  MapPin, Phone, Linkedin, Github, Globe, GraduationCap, BookOpen,
  Target, FileText, BarChart3, Award, Activity as ActivityIcon, Shield,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile, useUpdateProfile, type ProfileUpdate } from "@/hooks/useProfile";
import { useTasks } from "@/hooks/useTasks";
import { useNotes } from "@/hooks/useNotes";
import { usePlans } from "@/hooks/usePlans";
import { useRewards } from "@/hooks/useRewards";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const { data: tasks = [] } = useTasks();
  const { data: notes = [] } = useNotes();
  const { data: plans = [] } = usePlans();
  const rewards = useRewards();

  const initialName =
    profile?.display_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "";

  const avatarUrl: string | undefined =
    profile?.avatar_url || user?.user_metadata?.avatar_url || undefined;

  const initials = useMemo(() =>
    (initialName || "U").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2),
    [initialName]
  );

  const memberSince = user?.created_at ? format(new Date(user.created_at), "MMMM yyyy") : "—";

  /* derived stats */
  const completedTasks = tasks.filter((t) => t.completed);
  const completedDates = completedTasks
    .map((t) => t.completed_at ? new Date(t.completed_at) : null)
    .filter((d): d is Date => !!d);
  const streak = computeStreak(completedDates);
  const completionRate = tasks.length ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
  const activePlans = plans.filter((p) => p.status === "active");

  /* avatar upload */
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setAvatarUploading(true);
    try {
      const blob = await resizeImage(file, 400);
      const path = `${user.id}/avatar.jpg`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, blob, {
        upsert: true, contentType: "image/jpeg",
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
      await updateProfile.mutateAsync({ avatar_url: publicUrl });
      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
    <PageShell title="Profile" description="Your account and progress" icon={UserIcon}>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ─────────── Banner card ─────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card overflow-hidden"
        >
          <div className="h-24 bg-gradient-to-r from-primary/20 via-info/15 to-accent/20" />
          <div className="px-6 pb-6 -mt-12">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                {/* Avatar */}
                <div className="relative">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={initialName}
                      className="w-24 h-24 rounded-2xl object-cover ring-4 ring-card shadow-md"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-primary/50 text-primary-foreground flex items-center justify-center text-2xl font-semibold ring-4 ring-card shadow-md">
                      {initials}
                    </div>
                  )}
                  <button
                    onClick={() => fileRef.current?.click()}
                    aria-label="Change photo"
                    className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:scale-105 transition-transform"
                  >
                    {avatarUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
                </div>

                {/* Name & email */}
                <div className="space-y-0.5 mb-1">
                  <h1 className="text-2xl font-bold text-foreground">{initialName || "Add your name"}</h1>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" /> {user?.email}
                  </p>
                  {profile?.bio && (
                    <p className="text-sm text-foreground/80 mt-2 max-w-md">{profile.bio}</p>
                  )}
                </div>
              </div>

              <div className="text-right text-xs text-muted-foreground sm:mb-2">
                <div>Member since</div>
                <div className="text-base font-semibold text-foreground">{memberSince}</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ─────────── Stats row ─────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard icon={CheckCircle2} label="Tasks Done" value={completedTasks.length} color="text-success" bg="bg-success/10" />
          <StatCard icon={Flame} label="Day Streak" value={streak} color="text-orange-500" bg="bg-orange-500/10" />
          <StatCard icon={Target} label="Active Plans" value={activePlans.length} color="text-primary" bg="bg-primary/10" />
          <StatCard icon={FileText} label="Notes" value={notes.length} color="text-info" bg="bg-info/10" />
          <StatCard icon={BarChart3} label="Task Rate" value={`${completionRate}%`} color="text-accent-foreground" bg="bg-accent/30" />
          <StatCard icon={Award} label="XP Earned" value={rewards.xp} color="text-amber-500" bg="bg-amber-500/10" />
        </div>

        {/* ─────────── Tabs ─────────── */}
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-muted">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="academic">Academic</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="mt-4">
            <BasicInfoTab profile={profile} email={user?.email || ""} updateProfile={updateProfile} />
          </TabsContent>

          <TabsContent value="academic" className="mt-4">
            <AcademicTab profile={profile} updateProfile={updateProfile} />
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <ActivityTab tasks={completedTasks} notes={notes} plans={plans} completedDates={completedDates} />
          </TabsContent>

          <TabsContent value="achievements" className="mt-4">
            <AchievementsTab tasks={tasks} notes={notes} plans={plans} streak={streak} completedDates={completedDates} />
          </TabsContent>

          <TabsContent value="security" className="mt-4">
            <SecurityTab email={user?.email || ""} />
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}

/* ─────────── Stat card ─────────── */
function StatCard({ icon: Icon, label, value, color, bg }: { icon: any; label: string; value: number | string; color: string; bg: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center">
      <div className={`mx-auto w-10 h-10 rounded-lg ${bg} ${color} flex items-center justify-center mb-2`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

/* ─────────── Editable field section wrapper ─────────── */
function EditableSection({
  icon: Icon, title, editing, onEdit, onSave, onCancel, saving, children,
}: {
  icon: any; title: string; editing: boolean;
  onEdit: () => void; onSave: () => void; onCancel: () => void; saving: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" /> {title}
        </h3>
        {editing ? (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={onSave} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
              Save
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={onEdit}>
            <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
          </Button>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Field({
  label, value, placeholder, editing, onChange, icon: Icon, type = "text", multiline,
}: {
  label: string; value: string; placeholder?: string; editing: boolean;
  onChange: (v: string) => void; icon?: any; type?: string; multiline?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />} {label}
      </Label>
      {multiline ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={!editing}
          placeholder={placeholder}
          rows={3}
          className={!editing ? "bg-muted/30" : ""}
        />
      ) : (
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={!editing}
          placeholder={placeholder}
          className={!editing ? "bg-muted/30" : ""}
        />
      )}
    </div>
  );
}

/* ─────────── Basic Info tab ─────────── */
function BasicInfoTab({ profile, email, updateProfile }: { profile: any; email: string; updateProfile: ReturnType<typeof useUpdateProfile> }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    display_name: "", bio: "", location: "", phone: "", linkedin_url: "", github_url: "", website_url: "",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name || "",
        bio: profile.bio || "",
        location: profile.location || "",
        phone: profile.phone || "",
        linkedin_url: profile.linkedin_url || "",
        github_url: profile.github_url || "",
        website_url: profile.website_url || "",
      });
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync(form as ProfileUpdate);
      if (form.display_name) {
        await supabase.auth.updateUser({ data: { full_name: form.display_name } });
      }
      setEditing(false);
    } catch { /* toast handled in hook */ }
  };

  return (
    <EditableSection
      icon={UserIcon} title="Basic Information"
      editing={editing}
      onEdit={() => setEditing(true)}
      onSave={handleSave}
      onCancel={() => { setEditing(false); /* form will reset on profile change */ }}
      saving={updateProfile.isPending}
    >
      <Field label="Display Name" value={form.display_name} editing={editing} onChange={(v) => setForm({ ...form, display_name: v })} placeholder="Your name" />
      <div className="space-y-1.5">
        <Label className="text-xs font-medium flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5 text-muted-foreground" /> Email
        </Label>
        <Input value={email} disabled className="bg-muted/30 font-mono text-xs" />
      </div>
      <Field label="Location" value={form.location} editing={editing} icon={MapPin} onChange={(v) => setForm({ ...form, location: v })} placeholder="City, Country" />
      <Field label="Phone" value={form.phone} editing={editing} icon={Phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="+92 300 0000000" />
      <Field label="LinkedIn URL" value={form.linkedin_url} editing={editing} icon={Linkedin} onChange={(v) => setForm({ ...form, linkedin_url: v })} placeholder="https://linkedin.com/in/yourname" />
      <Field label="GitHub URL" value={form.github_url} editing={editing} icon={Github} onChange={(v) => setForm({ ...form, github_url: v })} placeholder="https://github.com/yourusername" />
      <Field label="Website" value={form.website_url} editing={editing} icon={Globe} onChange={(v) => setForm({ ...form, website_url: v })} placeholder="https://yoursite.com" />
      <div className="sm:col-span-2">
        <Field label="Bio" value={form.bio} editing={editing} multiline onChange={(v) => setForm({ ...form, bio: v })} placeholder="A few words about yourself..." />
      </div>
    </EditableSection>
  );
}

/* ─────────── Academic tab ─────────── */
function AcademicTab({ profile, updateProfile }: { profile: any; updateProfile: ReturnType<typeof useUpdateProfile> }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ institution: "", field_of_study: "", year_of_study: "", student_id: "" });

  useEffect(() => {
    if (profile) {
      setForm({
        institution: profile.institution || "",
        field_of_study: profile.field_of_study || "",
        year_of_study: profile.year_of_study || "",
        student_id: profile.student_id || "",
      });
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync(form as ProfileUpdate);
      setEditing(false);
    } catch { /* */ }
  };

  return (
    <EditableSection
      icon={GraduationCap} title="Academic Information"
      editing={editing}
      onEdit={() => setEditing(true)}
      onSave={handleSave}
      onCancel={() => setEditing(false)}
      saving={updateProfile.isPending}
    >
      <Field label="Institution / School" value={form.institution} editing={editing} icon={BookOpen} onChange={(v) => setForm({ ...form, institution: v })} placeholder="University name" />
      <Field label="Field of Study" value={form.field_of_study} editing={editing} onChange={(v) => setForm({ ...form, field_of_study: v })} placeholder="Computer Science" />
      <Field label="Year / Grade" value={form.year_of_study} editing={editing} onChange={(v) => setForm({ ...form, year_of_study: v })} placeholder="3rd Year / Grade 12" />
      <Field label="Student ID" value={form.student_id} editing={editing} onChange={(v) => setForm({ ...form, student_id: v })} placeholder="Optional" />
    </EditableSection>
  );
}

/* ─────────── Activity tab ─────────── */
function ActivityTab({
  tasks, notes, plans, completedDates,
}: {
  tasks: Array<{ id: string; title: string; completed_at: string | null }>;
  notes: Array<{ id: string; title: string; created_at: string }>;
  plans: Array<{ id: string; title: string; created_at: string }>;
  completedDates: Date[];
}) {
  const last7 = eachDayOfInterval({ start: subDays(startOfDay(new Date()), 6), end: new Date() });
  const data = last7.map((d) => ({
    name: format(d, "EEE"),
    count: completedDates.filter((c) => isSameDay(c, d)).length,
  }));

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

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ActivityIcon className="w-4 h-4 text-primary" /> Last 7 Days
          </h3>
          <span className="text-xs text-muted-foreground">Tasks completed</span>
        </div>
        <div style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <YAxis hide />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
          <CalendarIcon className="w-4 h-4 text-primary" /> Recent Activity
        </h3>
        {items.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">No activity yet — start by adding a task or note.</div>
        ) : (
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
                  <span className={`absolute -left-[13px] flex items-center justify-center w-6 h-6 rounded-full ring-4 ring-card ${cfg.color}`}>
                    <Icon className="w-3 h-3" />
                  </span>
                  <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                    <div className="text-sm text-foreground">{it.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {format(it.date, "MMM d, yyyy · HH:mm")}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

/* ─────────── Achievements tab ─────────── */
interface BadgeDef {
  id: string; emoji: string; name: string; description: string; earned: boolean;
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
  const perDay = new Map<string, number>();
  completedDates.forEach((d) => {
    const k = format(d, "yyyy-MM-dd");
    perDay.set(k, (perDay.get(k) || 0) + 1);
  });
  const maxInDay = Math.max(0, ...perDay.values());

  const voiceOpens = (() => {
    try { return parseInt(localStorage.getItem("sofi-voice-opens") || "0", 10); } catch { return 0; }
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
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" /> Achievements
        </h3>
        <span className="text-xs text-muted-foreground">{earnedCount} of {badges.length} earned</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {badges.map((b) => (
          <div
            key={b.id}
            title={b.description}
            className={`group rounded-xl border p-4 text-center transition-all ${
              b.earned ? "border-border bg-card hover:border-primary/40" : "border-border/60 bg-muted/20 opacity-50 grayscale"
            }`}
          >
            <div className="text-4xl mb-2 leading-none">{b.emoji}</div>
            <div className="text-xs font-medium text-foreground">{b.name}</div>
            <div className="text-[10px] text-muted-foreground mt-1">{b.description}</div>
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

/* ─────────── Security tab ─────────── */
function SecurityTab({ email }: { email: string }) {
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  const changePassword = async () => {
    if (newPwd.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (newPwd !== confirmPwd) { toast.error("Passwords don't match"); return; }
    setPwdLoading(true);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: currentPwd });
      if (signInErr) { toast.error("Current password is incorrect"); return; }
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      toast.success("Password updated");
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch (err: any) {
      toast.error(err.message || "Couldn't update password");
    } finally {
      setPwdLoading(false);
    }
  };

  const sendResetEmail = async () => {
    setResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetting(false);
    if (error) toast.error(error.message);
    else toast.success("Reset link sent to your email");
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Security & Password</h3>
      </div>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="current-pwd" className="text-xs">Current password</Label>
          <Input id="current-pwd" type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="new-pwd" className="text-xs">New password</Label>
            <Input id="new-pwd" type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirm-pwd" className="text-xs">Confirm new password</Label>
            <Input id="confirm-pwd" type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={sendResetEmail} disabled={resetting}>
            {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
            Forgot password? Email me a link
          </Button>
          <Button size="sm" onClick={changePassword} disabled={pwdLoading || !currentPwd || !newPwd}>
            {pwdLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <KeyRound className="w-3.5 h-3.5 mr-1.5" />}
            Update password
          </Button>
        </div>
      </div>
    </div>
  );
}

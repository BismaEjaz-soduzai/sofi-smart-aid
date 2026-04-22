import PageShell from "@/components/PageShell";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Settings as SettingsIcon, Palette, Bell, Sparkles, Shield, Info,
  Sun, Moon, Monitor, Download, Trash2, LogOut, Volume2, MessageSquare,
  Send, FileJson, FileText, Table as TableIcon, Loader2,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Theme = "light" | "dark" | "system";
type Section = "appearance" | "notifications" | "ai" | "privacy" | "about";
type FontSize = "small" | "normal" | "large";
type AiStyle = "concise" | "balanced" | "detailed";

const ACCENTS = [
  { name: "Teal", value: "174 62% 40%" },
  { name: "Blue", value: "210 80% 55%" },
  { name: "Indigo", value: "234 70% 60%" },
  { name: "Purple", value: "270 60% 55%" },
  { name: "Pink", value: "330 75% 60%" },
  { name: "Rose", value: "340 65% 55%" },
  { name: "Red", value: "0 70% 55%" },
  { name: "Orange", value: "24 90% 55%" },
  { name: "Amber", value: "38 92% 50%" },
  { name: "Yellow", value: "48 95% 50%" },
  { name: "Lime", value: "85 65% 45%" },
  { name: "Green", value: "152 60% 42%" },
  { name: "Emerald", value: "160 70% 40%" },
  { name: "Cyan", value: "190 75% 45%" },
  { name: "Slate", value: "215 20% 45%" },
];

const FONT_PX: Record<FontSize, string> = { small: "14px", normal: "16px", large: "18px" };
type Density = "compact" | "comfortable" | "spacious";
const DENSITY_PAD: Record<Density, string> = { compact: "0.85", comfortable: "1", spacious: "1.15" };
type Radius = "sharp" | "default" | "round";
const RADIUS_REM: Record<Radius, string> = { sharp: "0.25rem", default: "0.5rem", round: "1rem" };

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", isDark);
  } else {
    root.classList.toggle("dark", theme === "dark");
  }
}

interface NotifPrefs {
  taskReminders: boolean;
  milestoneReminders: boolean;
  browserEnabled: boolean;
  emailEnabled: boolean;
  dailyReminder: boolean;
  dailyTime: string;
}
const DEFAULT_NOTIFS: NotifPrefs = {
  taskReminders: true,
  milestoneReminders: true,
  browserEnabled: false,
  emailEnabled: true,
  dailyReminder: false,
  dailyTime: "08:00",
};

const SECTIONS: { id: Section; label: string; icon: typeof Palette }[] = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "ai", label: "AI Assistant", icon: Sparkles },
  { id: "privacy", label: "Privacy & Data", icon: Shield },
  { id: "about", label: "About", icon: Info },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [active, setActive] = useState<Section>("appearance");

  // Appearance
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("sofi-theme") as Theme) || "system");
  const [accent, setAccent] = useState<string>(() => localStorage.getItem("sofi-accent") || ACCENTS[0].value);
  const [fontSize, setFontSize] = useState<FontSize>(() => (localStorage.getItem("sofi-font") as FontSize) || "normal");

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("sofi-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty("--primary", accent);
    document.documentElement.style.setProperty("--ring", accent);
    localStorage.setItem("sofi-accent", accent);
  }, [accent]);

  useEffect(() => {
    document.body.style.fontSize = FONT_PX[fontSize];
    localStorage.setItem("sofi-font", fontSize);
  }, [fontSize]);

  return (
    <PageShell title="Settings" description="Configure your SOFI experience" icon={SettingsIcon}>
      <div className="flex flex-col md:flex-row gap-6 max-w-5xl">
        {/* LEFT NAV */}
        <nav className="md:w-[200px] flex-shrink-0 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const isActive = active === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {s.label}
              </button>
            );
          })}
        </nav>

        {/* RIGHT CONTENT */}
        <div className="flex-1 min-w-0 space-y-6">
          {active === "appearance" && (
            <AppearancePanel
              theme={theme} setTheme={setTheme}
              accent={accent} setAccent={setAccent}
              fontSize={fontSize} setFontSize={setFontSize}
            />
          )}
          {active === "notifications" && <NotificationsPanel />}
          {active === "ai" && <AiAssistantPanel />}
          {active === "privacy" && <PrivacyPanel userId={user?.id} />}
          {active === "about" && <AboutPanel />}
        </div>
      </div>
    </PageShell>
  );
}

/* ───────────── Appearance ───────────── */

function AppearancePanel({
  theme, setTheme, accent, setAccent, fontSize, setFontSize,
}: {
  theme: Theme; setTheme: (t: Theme) => void;
  accent: string; setAccent: (a: string) => void;
  fontSize: FontSize; setFontSize: (s: FontSize) => void;
}) {
  return (
    <div className="space-y-8">
      <SectionHeader icon={Palette} title="Appearance" desc="Personalize how SOFI looks" />

      {/* Theme */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Theme</Label>
        <div className="grid grid-cols-3 gap-3">
          {(["light", "dark", "system"] as Theme[]).map((t) => {
            const isActive = theme === t;
            const Icon = t === "light" ? Sun : t === "dark" ? Moon : Monitor;
            return (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`group relative rounded-xl border-2 p-3 text-left transition-all ${
                  isActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                }`}
              >
                <div className={`h-16 rounded-md mb-2 overflow-hidden flex ${
                  t === "dark" ? "bg-zinc-900" : t === "system" ? "bg-gradient-to-r from-white to-zinc-900" : "bg-white"
                }`}>
                  <div className="w-1/3 border-r border-border/30 p-1 space-y-1">
                    <div className={`h-1.5 w-full rounded ${t === "dark" ? "bg-zinc-700" : "bg-zinc-300"}`} />
                    <div className={`h-1.5 w-2/3 rounded ${t === "dark" ? "bg-zinc-700" : "bg-zinc-300"}`} />
                  </div>
                  <div className="flex-1 p-1 space-y-1">
                    <div className="h-2 w-full rounded bg-primary/70" />
                    <div className={`h-1.5 w-3/4 rounded ${t === "dark" ? "bg-zinc-600" : "bg-zinc-400"}`} />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <Icon className="w-3.5 h-3.5" /> {t.charAt(0).toUpperCase() + t.slice(1)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Accent */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Accent color</Label>
        <div className="flex flex-wrap gap-3">
          {ACCENTS.map((c) => {
            const isActive = accent === c.value;
            return (
              <button
                key={c.name}
                onClick={() => setAccent(c.value)}
                aria-label={c.name}
                title={c.name}
                className={`w-9 h-9 rounded-full transition-all ring-offset-2 ring-offset-background ${
                  isActive ? "ring-2 ring-foreground scale-110" : "hover:scale-105"
                }`}
                style={{ backgroundColor: `hsl(${c.value})` }}
              />
            );
          })}
        </div>
      </div>

      {/* Font size */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Font size</Label>
        <div className="inline-flex rounded-lg border border-border p-1 bg-muted/30">
          {(["small", "normal", "large"] as FontSize[]).map((s) => (
            <button
              key={s}
              onClick={() => setFontSize(s)}
              className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
                fontSize === s ? "bg-background text-foreground shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────── Notifications ───────────── */

function NotificationsPanel() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<{
    task_reminders: boolean;
    milestone_reminders: boolean;
    browser_enabled: boolean;
    email_enabled: boolean;
    daily_reminder: boolean;
    daily_time: string;
    reminder_lead_hours: number;
  }>({
    task_reminders: true,
    milestone_reminders: true,
    browser_enabled: false,
    email_enabled: true,
    daily_reminder: false,
    daily_time: "08:00",
    reminder_lead_hours: 24,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setPrefs({
          task_reminders: data.task_reminders,
          milestone_reminders: data.milestone_reminders,
          browser_enabled: data.browser_enabled,
          email_enabled: data.email_enabled,
          daily_reminder: data.daily_reminder,
          daily_time: (data.daily_time as string)?.slice(0, 5) || "08:00",
          reminder_lead_hours: data.reminder_lead_hours,
        });
      }
      setLoading(false);
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || loading) return;
    const t = setTimeout(async () => {
      setSaving(true);
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({ user_id: user.id, ...prefs }, { onConflict: "user_id" });
      setSaving(false);
      if (error) toast.error("Couldn't save preferences");
    }, 500);
    return () => clearTimeout(t);
  }, [prefs, user?.id, loading]);

  const update = <K extends keyof typeof prefs>(k: K, v: typeof prefs[K]) =>
    setPrefs((p) => ({ ...p, [k]: v }));

  const handleBrowserToggle = async (v: boolean) => {
    if (v && typeof Notification !== "undefined") {
      try {
        const result = await Notification.requestPermission();
        setPerm(result);
        if (result !== "granted") {
          toast.error(
            result === "denied"
              ? "Notifications blocked — enable them from your browser's site settings (lock icon → Notifications → Allow)"
              : "Permission not granted"
          );
          update("browser_enabled", false);
          return;
        }
        new Notification("SOFI notifications enabled", {
          body: "You'll receive reminders for tasks and milestones here.",
          icon: "/favicon.ico",
        });
      } catch {
        toast.error("Browser doesn't support notifications");
        update("browser_enabled", false);
        return;
      }
    }
    update("browser_enabled", v);
  };

  const sendTestEmail = async () => {
    if (!user?.id) return;
    toast.info("Triggering reminder check…");
    const { data, error } = await supabase.functions.invoke("send-reminders", {
      body: { test: true, user_id: user.id },
    });
    if (error) toast.error(error.message);
    else toast.success(data?.message || "Reminder run complete");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader icon={Bell} title="Notifications" desc="Choose what SOFI tells you about" />

      <div className="space-y-3 rounded-xl border border-border bg-card divide-y divide-border">
        <Row title="Task due reminders" desc="Get notified when tasks are due">
          <Switch checked={prefs.task_reminders} onCheckedChange={(v) => update("task_reminders", v)} />
        </Row>
        <Row title="Milestone due reminders" desc="Plan & milestone alerts">
          <Switch checked={prefs.milestone_reminders} onCheckedChange={(v) => update("milestone_reminders", v)} />
        </Row>
        <Row
          title="Browser notifications"
          desc={
            <span className="flex items-center gap-2">
              Receive native popups
              <Badge variant={perm === "granted" ? "default" : perm === "denied" ? "destructive" : "secondary"} className="text-[10px]">
                {perm}
              </Badge>
            </span>
          }
        >
          <Switch checked={prefs.browser_enabled} onCheckedChange={handleBrowserToggle} />
        </Row>
        <Row title="Email notifications" desc="Overdue and upcoming items emailed to you">
          <Switch checked={prefs.email_enabled} onCheckedChange={(v) => update("email_enabled", v)} />
        </Row>
        <Row title="Reminder lead time" desc="How far ahead to remind you">
          <Select
            value={String(prefs.reminder_lead_hours)}
            onValueChange={(v) => update("reminder_lead_hours", parseInt(v))}
          >
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 hour</SelectItem>
              <SelectItem value="6">6 hours</SelectItem>
              <SelectItem value="12">12 hours</SelectItem>
              <SelectItem value="24">1 day</SelectItem>
              <SelectItem value="48">2 days</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <Row title="Daily study reminder" desc="A nudge at your chosen time">
          <div className="flex items-center gap-2">
            <Input
              type="time"
              value={prefs.daily_time}
              onChange={(e) => update("daily_time", e.target.value)}
              className="w-28"
              disabled={!prefs.daily_reminder}
            />
            <Switch checked={prefs.daily_reminder} onCheckedChange={(v) => update("daily_reminder", v)} />
          </div>
        </Row>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={sendTestEmail}>
          Run reminders now
        </Button>
        {saving && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Saving…
          </span>
        )}
      </div>
    </div>
  );
}

/* ───────────── AI Assistant ───────────── */

function AiAssistantPanel() {
  const [rate, setRate] = useState<number>(() => parseFloat(localStorage.getItem("sofi-voice-rate") || "1"));
  const [voiceName, setVoiceName] = useState<string>(() => localStorage.getItem("sofi-voice-name") || "");
  const [style, setStyle] = useState<AiStyle>(() => (localStorage.getItem("sofi-ai-style") as AiStyle) || "balanced");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const load = () => {
      const all = window.speechSynthesis?.getVoices() || [];
      setVoices(all.filter((v) => v.lang.toLowerCase().startsWith("en")));
    };
    load();
    window.speechSynthesis?.addEventListener?.("voiceschanged", load);
    return () => window.speechSynthesis?.removeEventListener?.("voiceschanged", load);
  }, []);

  useEffect(() => { localStorage.setItem("sofi-voice-rate", String(rate)); }, [rate]);
  useEffect(() => { if (voiceName) localStorage.setItem("sofi-voice-name", voiceName); }, [voiceName]);
  useEffect(() => { localStorage.setItem("sofi-ai-style", style); }, [style]);

  const testVoice = () => {
    if (!window.speechSynthesis) { toast.error("Speech synthesis not supported"); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance("Hello, I am SOFI, your AI study assistant");
    u.rate = rate;
    const v = voices.find((x) => x.name === voiceName);
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  };

  const clearHistory = () => {
    localStorage.removeItem("sofi-chat-history");
    toast.success("Chat history cleared");
  };

  const speedLabel = rate < 0.85 ? "Slow" : rate > 1.15 ? "Fast" : "Normal";

  return (
    <div className="space-y-6">
      <SectionHeader icon={Sparkles} title="AI Assistant" desc="Tune SOFI's voice and personality" />

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Volume2 className="w-4 h-4" /> Voice speed
          </Label>
          <Badge variant="secondary">{speedLabel} · {rate.toFixed(2)}x</Badge>
        </div>
        <Slider value={[rate]} onValueChange={(v) => setRate(v[0])} min={0.6} max={1.4} step={0.05} />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Slow</span><span>Normal</span><span>Fast</span>
        </div>
        <Button variant="outline" size="sm" onClick={testVoice}>Test voice</Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <Label className="text-sm font-medium">Voice</Label>
        <Select value={voiceName} onValueChange={setVoiceName}>
          <SelectTrigger><SelectValue placeholder="System default" /></SelectTrigger>
          <SelectContent>
            {voices.length === 0 && <SelectItem value="default" disabled>No voices available</SelectItem>}
            {voices.map((v) => (
              <SelectItem key={v.name} value={v.name}>{v.name} ({v.lang})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <Label className="text-sm font-medium">Response style</Label>
        <div className="grid grid-cols-3 gap-2">
          {(["concise", "balanced", "detailed"] as AiStyle[]).map((s) => (
            <button
              key={s}
              onClick={() => setStyle(s)}
              className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                style === s
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <Button variant="outline" onClick={clearHistory} className="gap-2">
        <MessageSquare className="w-4 h-4" /> Clear SOFI chat history
      </Button>
    </div>
  );
}

/* ───────────── Privacy & Data ───────────── */

type ExportFormat = "json" | "csv" | "markdown";

function PrivacyPanel({ userId }: { userId?: string }) {
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [exporting, setExporting] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  const downloadFile = (content: string, mime: string, ext: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sofi-export-${new Date().toISOString().split("T")[0]}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toCSV = (rows: any[]) => {
    if (!rows?.length) return "";
    const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
    const esc = (v: any) => {
      if (v == null) return "";
      const s = typeof v === "object" ? JSON.stringify(v) : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  };

  const toMarkdown = (sections: Record<string, any[]>) => {
    let out = `# SOFI Export\n\n_Exported ${new Date().toLocaleString()}_\n\n`;
    for (const [name, rows] of Object.entries(sections)) {
      out += `## ${name} (${rows?.length || 0})\n\n`;
      if (!rows?.length) { out += "_None_\n\n"; continue; }
      const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
      out += `| ${cols.join(" | ")} |\n| ${cols.map(() => "---").join(" | ")} |\n`;
      for (const r of rows) {
        out += `| ${cols.map((c) => {
          const v = r[c];
          if (v == null) return "";
          const s = typeof v === "object" ? JSON.stringify(v) : String(v);
          return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
        }).join(" | ")} |\n`;
      }
      out += "\n";
    }
    return out;
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      toast.info("Preparing your export…");
      const [tasks, notes, plans, sessions] = await Promise.all([
        supabase.from("tasks").select("*"),
        supabase.from("notes").select("*"),
        supabase.from("plans").select("*"),
        supabase.from("plan_sessions").select("*"),
      ]);
      if (tasks.error || notes.error || plans.error || sessions.error) throw new Error("Export failed");
      const sections = {
        Tasks: tasks.data || [],
        Notes: notes.data || [],
        Plans: plans.data || [],
        "Plan Sessions": sessions.data || [],
      };

      if (format === "json") {
        downloadFile(
          JSON.stringify({ exportedAt: new Date().toISOString(), userId, ...sections }, null, 2),
          "application/json",
          "json"
        );
      } else if (format === "csv") {
        // ZIP-like single multi-section CSV
        const out = Object.entries(sections)
          .map(([name, rows]) => `### ${name}\n${toCSV(rows)}`)
          .join("\n\n");
        downloadFile(out, "text/csv", "csv");
      } else {
        downloadFile(toMarkdown(sections), "text/markdown", "md");
      }
      toast.success("Data exported");
    } catch (e: any) {
      toast.error(e.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const signOutAll = async () => {
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) toast.error(error.message);
    else toast.success("Signed out of all devices");
    setSignOutOpen(false);
  };

  const formatIcon = format === "json" ? FileJson : format === "csv" ? TableIcon : FileText;
  const FormatIcon = formatIcon;

  return (
    <div className="space-y-6">
      <SectionHeader icon={Shield} title="Privacy & Data" desc="Control your data and access" />

      <Card>
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium">Export my data</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Download all your tasks, notes, plans and sessions in your preferred format.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg border border-border p-1 bg-muted/30">
              {([
                { v: "csv" as const, label: "CSV", Icon: TableIcon },
                { v: "markdown" as const, label: "Markdown", Icon: FileText },
                { v: "json" as const, label: "JSON", Icon: FileJson },
              ]).map(({ v, label, Icon }) => (
                <button
                  key={v}
                  onClick={() => setFormat(v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors ${
                    format === v ? "bg-background text-foreground shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
            <Button onClick={handleExport} disabled={exporting} className="gap-2">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export as {format.toUpperCase()}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <DangerDelete
          label="Delete all tasks"
          desc="This will permanently delete all your tasks."
          confirmWord="DELETE"
          onConfirm={async () => {
            if (!userId) return;
            const { error } = await supabase.from("tasks").delete().eq("user_id", userId);
            if (error) toast.error(error.message);
            else toast.success("All tasks deleted");
          }}
        />
      </Card>

      <Card>
        <DangerDelete
          label="Delete all notes"
          desc="This will permanently delete all your notes."
          confirmWord="DELETE"
          onConfirm={async () => {
            if (!userId) return;
            const { error } = await supabase.from("notes").delete().eq("user_id", userId);
            if (error) toast.error(error.message);
            else toast.success("All notes deleted");
          }}
        />
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="text-sm font-medium">Sign out all devices</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              End every active SOFI session across browsers and devices.
            </p>
          </div>
          <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="gap-2 shrink-0">
                <LogOut className="w-4 h-4" /> Sign out all
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sign out of every device?</AlertDialogTitle>
                <AlertDialogDescription>
                  You'll need to sign in again on every browser and device where SOFI is currently open.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={signOutAll}>Sign out everywhere</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Card>
    </div>
  );
}

function DangerDelete({
  label, desc, confirmWord, onConfirm,
}: { label: string; desc: string; confirmWord: string; onConfirm: () => Promise<void> }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const enabled = text === confirmWord;
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h4 className="text-sm font-medium text-destructive">{label}</h4>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <AlertDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setText(""); }}>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" className="gap-2 shrink-0">
            <Trash2 className="w-4 h-4" /> Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{label}?</AlertDialogTitle>
            <AlertDialogDescription>
              {desc} Type <span className="font-mono font-semibold text-foreground">{confirmWord}</span> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={confirmWord} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!enabled}
              onClick={async () => { await onConfirm(); setOpen(false); setText(""); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ───────────── About ───────────── */

function AboutPanel() {
  const stack = ["Supabase", "React", "Tailwind CSS", "Jitsi Meet", "Google Gemini"];
  const whatsNew = [
    "Voice Navigator", "Room Chat", "Analytics", "Planner", "AI Assistant", "Email Notifications",
  ];
  return (
    <div className="space-y-6">
      <SectionHeader icon={Info} title="About" desc="" />

      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">SOFI Smart Aid</h2>
          <Badge variant="secondary">v1.0.0</Badge>
        </div>
        <p className="text-sm text-muted-foreground">Your AI-powered study companion</p>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">Built with</h4>
        <div className="flex flex-wrap gap-2">
          {stack.map((s) => (
            <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">What's new</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          {whatsNew.map((f) => (
            <li key={f} className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-primary" /> {f}
            </li>
          ))}
        </ul>
      </div>

      <FeedbackForm />
    </div>
  );
}

function FeedbackForm() {
  const { user } = useAuth();
  const [category, setCategory] = useState<"bug" | "feature" | "general">("bug");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [recent, setRecent] = useState<any[]>([]);

  const loadRecent = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("feedback_submissions")
      .select("id, category, subject, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3);
    setRecent(data || []);
  };

  useEffect(() => { loadRecent(); }, [user?.id]);

  const submit = async () => {
    if (!user?.id) { toast.error("Please sign in"); return; }
    if (!message.trim()) { toast.error("Add a description"); return; }
    setSending(true);
    const { error } = await supabase.from("feedback_submissions").insert({
      user_id: user.id,
      category,
      subject: subject.trim() || `${category} report`,
      message: message.trim(),
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Thanks for your feedback!");
    setSubject(""); setMessage("");
    loadRecent();
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Feedback</h4>
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex gap-2">
          {(["bug", "feature", "general"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                category === c
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {c === "bug" ? "🐛 Bug" : c === "feature" ? "✨ Feature" : "💬 General"}
            </button>
          ))}
        </div>
        <Input
          placeholder="Subject (optional)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <Textarea
          placeholder={
            category === "bug"
              ? "What went wrong? Include steps to reproduce."
              : category === "feature"
              ? "What would you like SOFI to do?"
              : "Tell us what's on your mind…"
          }
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
        />
        <Button onClick={submit} disabled={sending || !message.trim()} className="gap-2">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send feedback
        </Button>
      </div>

      {recent.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Your recent submissions</p>
          <div className="space-y-1.5">
            {recent.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs rounded-lg border border-border bg-card/50 px-3 py-2">
                <div className="truncate">
                  <span className="font-medium">{r.subject}</span>
                  <span className="text-muted-foreground"> · {r.category}</span>
                </div>
                <Badge variant={r.status === "open" ? "secondary" : "default"} className="text-[10px]">
                  {r.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────── Helpers ───────────── */

function SectionHeader({ icon: Icon, title, desc }: { icon: typeof Palette; title: string; desc: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      {desc && <p className="text-sm text-muted-foreground">{desc}</p>}
    </div>
  );
}

function Row({ title, desc, children }: { title: string; desc: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-card p-4">{children}</div>;
}

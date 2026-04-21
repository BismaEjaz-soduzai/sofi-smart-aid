import PageShell from "@/components/PageShell";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Settings as SettingsIcon, Moon, Sun, Monitor, User, Bell, Shield,
  Download, Trash2, LogOut, ChevronRight, Globe, Clock, BookOpen,
  Volume2, VolumeX, Eye, EyeOff, Save, Camera, Palette, Type,
  Contrast,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

type Theme = "light" | "dark" | "system";

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") {
    root.classList.toggle("dark", getSystemTheme() === "dark");
  } else {
    root.classList.toggle("dark", theme === "dark");
  }
}

type SettingsSection = "appearance" | "profile" | "notifications" | "privacy" | "data" | "about";

const ACCENT_COLORS = [
  { name: "Teal", value: "174 62% 40%", dark: "174 62% 48%" },
  { name: "Blue", value: "210 80% 55%", dark: "210 75% 58%" },
  { name: "Purple", value: "270 60% 55%", dark: "270 55% 60%" },
  { name: "Rose", value: "340 65% 55%", dark: "340 60% 58%" },
  { name: "Amber", value: "38 92% 50%", dark: "38 85% 55%" },
  { name: "Green", value: "152 60% 42%", dark: "152 55% 45%" },
];

const FONT_SIZES = [
  { value: "small", label: "Small" },
  { value: "normal", label: "Normal" },
  { value: "large", label: "Large" },
];

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<SettingsSection>("appearance");

  const [theme, setTheme] = useState<Theme>(() =>
    (localStorage.getItem("sofi-theme") as Theme) || "system"
  );

  const [displayName, setDisplayName] = useState(user?.user_metadata?.full_name || "");
  const [saving, setSaving] = useState(false);

  const [prefs, setPrefs] = useState(() => {
    const saved = localStorage.getItem("sofi-prefs");
    return saved ? JSON.parse(saved) : {
      soundEnabled: true,
      voiceEnabled: true,
      taskReminders: true,
      planReminders: true,
      weeklyDigest: false,
      showCompletedTasks: true,
      defaultPriority: "medium",
      defaultCategory: "personal",
      focusDuration: 25,
      breakDuration: 5,
      language: "en",
      timeFormat: "12h",
      accentColor: 0,
      fontSize: "normal",
      highContrast: false,
      reducedMotion: false,
      compactMode: false,
    };
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("sofi-theme", theme);
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => { if (theme === "system") applyTheme("system"); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  // Apply accent color
  useEffect(() => {
    const accent = ACCENT_COLORS[prefs.accentColor] || ACCENT_COLORS[0];
    const isDark = document.documentElement.classList.contains("dark");
    document.documentElement.style.setProperty("--primary", isDark ? accent.dark : accent.value);
    document.documentElement.style.setProperty("--ring", isDark ? accent.dark : accent.value);
  }, [prefs.accentColor, theme]);

  // Apply font size
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("text-sm", "text-base", "text-lg");
    if (prefs.fontSize === "small") root.style.fontSize = "14px";
    else if (prefs.fontSize === "large") root.style.fontSize = "18px";
    else root.style.fontSize = "16px";
  }, [prefs.fontSize]);

  // Apply high contrast
  useEffect(() => {
    document.documentElement.classList.toggle("high-contrast", prefs.highContrast);
  }, [prefs.highContrast]);

  const updatePref = (key: string, value: any) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    localStorage.setItem("sofi-prefs", JSON.stringify(next));
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ data: { full_name: displayName } });
    setSaving(false);
    if (error) toast.error("Failed to update profile");
    else toast.success("Profile updated!");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const handleDeleteAccount = () => {
    toast.info("Account deletion requires confirmation. Contact support.");
  };

  const handleExportData = async () => {
    try {
      toast.info("Preparing your data export...");
      const [tasksRes, notesRes, plansRes] = await Promise.all([
        supabase.from("tasks").select("*"),
        supabase.from("notes").select("*"),
        supabase.from("plans").select("*"),
      ]);
      if (tasksRes.error || notesRes.error || plansRes.error) {
        throw new Error("Failed to fetch data");
      }
      const data = {
        exportDate: new Date().toISOString(),
        user: { id: user?.id, email: user?.email },
        tasks: tasksRes.data || [],
        notes: notesRes.data || [],
        plans: plansRes.data || [],
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sofi-data-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Data exported successfully!");
    } catch (e: any) {
      toast.error(e.message || "Export failed");
    }
  };

  const initials = (displayName || user?.email?.split("@")[0] || "U")
    .split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  const themes: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  const sections: { id: SettingsSection; label: string; icon: typeof User }[] = [
    { id: "profile", label: "Profile", icon: User },
    { id: "appearance", label: "Appearance", icon: Sun },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "privacy", label: "Privacy & Security", icon: Shield },
    { id: "data", label: "Data & Storage", icon: Download },
    { id: "about", label: "About SOFI", icon: BookOpen },
  ];

  return (
    <PageShell title="Settings" description="Configure your SOFI experience" icon={SettingsIcon}>
      <div className="flex gap-6 max-w-4xl">
        <div className="w-48 flex-shrink-0 hidden md:block space-y-1">
          {sections.map((s) => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${activeSection === s.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
              <s.icon className="w-4 h-4" /> {s.label}
            </button>
          ))}
          <Separator className="my-3" />
          <button onClick={handleSignOut} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/5 transition-colors">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>

        <div className="flex-1 space-y-6 min-w-0">
          <div className="flex gap-2 overflow-x-auto md:hidden pb-2">
            {sections.map((s) => (
              <button key={s.id} onClick={() => setActiveSection(s.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activeSection === s.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {s.label}
              </button>
            ))}
          </div>

          {activeSection === "profile" && (
            <div className="space-y-5">
              <SectionCard title="Your Profile">
                <div className="flex items-center gap-4 mb-5">
                  <div className="relative">
                    <Avatar className="w-16 h-16"><AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">{initials}</AvatarFallback></Avatar>
                    <button className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center"><Camera className="w-3 h-3" /></button>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{displayName || "Set your name"}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Display Name</label><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" className="h-9" /></div>
                  <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label><Input value={user?.email || ""} disabled className="h-9 opacity-60" /></div>
                  <Button onClick={handleSaveProfile} disabled={saving} size="sm" className="mt-2"><Save className="w-3.5 h-3.5 mr-1.5" />{saving ? "Saving..." : "Save Changes"}</Button>
                </div>
              </SectionCard>
              <SectionCard title="Defaults">
                <SettingRow label="Default Task Priority" description="New tasks will use this priority">
                  <select value={prefs.defaultPriority} onChange={(e) => updatePref("defaultPriority", e.target.value)} className="text-xs bg-muted rounded-lg px-2.5 py-1.5 border border-border text-foreground">
                    <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                  </select>
                </SettingRow>
                <SettingRow label="Default Category" description="New tasks default category">
                  <select value={prefs.defaultCategory} onChange={(e) => updatePref("defaultCategory", e.target.value)} className="text-xs bg-muted rounded-lg px-2.5 py-1.5 border border-border text-foreground">
                    {["personal", "study", "work", "assignment", "exam", "fyp"].map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </SettingRow>
              </SectionCard>
            </div>
          )}

          {activeSection === "appearance" && (
            <div className="space-y-5">
              <SectionCard title="Theme">
                <div className="flex gap-3">
                  {themes.map((t) => (
                    <button key={t.value} onClick={() => setTheme(t.value)}
                      className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${theme === t.value ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"}`}>
                      <t.icon className={`w-5 h-5 ${theme === t.value ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`text-xs font-medium ${theme === t.value ? "text-primary" : "text-muted-foreground"}`}>{t.label}</span>
                    </button>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Accent Color">
                <div className="flex gap-3 flex-wrap">
                  {ACCENT_COLORS.map((c, i) => (
                    <button key={c.name} onClick={() => updatePref("accentColor", i)}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all ${prefs.accentColor === i ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}>
                      <div className="w-8 h-8 rounded-full" style={{ background: `hsl(${c.value})` }} />
                      <span className="text-[10px] font-medium text-muted-foreground">{c.name}</span>
                    </button>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Display">
                <SettingRow label="Font Size" description="Adjust the text size across the app">
                  <div className="flex gap-1.5">
                    {FONT_SIZES.map((f) => (
                      <button key={f.value} onClick={() => updatePref("fontSize", f.value)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${prefs.fontSize === f.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </SettingRow>
                <SettingRow label="High Contrast" description="Increase contrast for better readability">
                  <Switch checked={prefs.highContrast} onCheckedChange={(v) => updatePref("highContrast", v)} />
                </SettingRow>
                <SettingRow label="Reduced Motion" description="Minimize animations throughout the app">
                  <Switch checked={prefs.reducedMotion} onCheckedChange={(v) => updatePref("reducedMotion", v)} />
                </SettingRow>
                <SettingRow label="Compact Mode" description="Tighter spacing for more content on screen">
                  <Switch checked={prefs.compactMode} onCheckedChange={(v) => updatePref("compactMode", v)} />
                </SettingRow>
                <SettingRow label="Time Format" description="Choose 12h or 24h clock">
                  <select value={prefs.timeFormat} onChange={(e) => updatePref("timeFormat", e.target.value)} className="text-xs bg-muted rounded-lg px-2.5 py-1.5 border border-border text-foreground">
                    <option value="12h">12-hour</option><option value="24h">24-hour</option>
                  </select>
                </SettingRow>
                <SettingRow label="Show Completed Tasks" description="Display completed tasks in task list">
                  <Switch checked={prefs.showCompletedTasks} onCheckedChange={(v) => updatePref("showCompletedTasks", v)} />
                </SettingRow>
              </SectionCard>
            </div>
          )}

          {activeSection === "notifications" && (
            <SectionCard title="Notification Preferences">
              <SettingRow label="Task Reminders" description="Get notified before task deadlines">
                <Switch checked={prefs.taskReminders} onCheckedChange={(v) => updatePref("taskReminders", v)} />
              </SettingRow>
              <SettingRow label="Plan Reminders" description="Reminders for upcoming plan sessions">
                <Switch checked={prefs.planReminders} onCheckedChange={(v) => updatePref("planReminders", v)} />
              </SettingRow>
              <SettingRow label="Weekly Digest" description="Receive a weekly productivity summary">
                <Switch checked={prefs.weeklyDigest} onCheckedChange={(v) => updatePref("weeklyDigest", v)} />
              </SettingRow>
              <SettingRow label="Sound Effects" description="Play sounds for notifications and actions">
                <Switch checked={prefs.soundEnabled} onCheckedChange={(v) => updatePref("soundEnabled", v)} />
              </SettingRow>
              <SettingRow label="Voice Feedback" description="SOFI reads responses aloud">
                <Switch checked={prefs.voiceEnabled} onCheckedChange={(v) => updatePref("voiceEnabled", v)} />
              </SettingRow>
              <SettingRow label="Browser Notifications" description="Receive notifications even when the app is in the background">
                <Button variant="outline" size="sm" onClick={() => {
                  if ("Notification" in window) {
                    Notification.requestPermission().then((p) => {
                      if (p === "granted") toast.success("Browser notifications enabled!");
                      else toast.info("Notifications permission denied");
                    });
                  } else { toast.error("Browser notifications not supported"); }
                }}>Enable</Button>
              </SettingRow>
            </SectionCard>
          )}

          {activeSection === "privacy" && (
            <div className="space-y-5">
              <SectionCard title="Security">
                <SettingRow label="Change Password" description="Update your account password">
                  <Button variant="outline" size="sm" onClick={() => {
                    supabase.auth.resetPasswordForEmail(user?.email || "", { redirectTo: `${window.location.origin}/reset-password` });
                    toast.success("Password reset email sent!");
                  }}>Reset</Button>
                </SettingRow>
              </SectionCard>
              <SectionCard title="Focus Settings">
                <SettingRow label="Focus Duration" description="Default focus session length (minutes)">
                  <select value={prefs.focusDuration} onChange={(e) => updatePref("focusDuration", Number(e.target.value))} className="text-xs bg-muted rounded-lg px-2.5 py-1.5 border border-border text-foreground">
                    {[15, 25, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
                  </select>
                </SettingRow>
                <SettingRow label="Break Duration" description="Default break length (minutes)">
                  <select value={prefs.breakDuration} onChange={(e) => updatePref("breakDuration", Number(e.target.value))} className="text-xs bg-muted rounded-lg px-2.5 py-1.5 border border-border text-foreground">
                    {[3, 5, 10, 15].map((m) => <option key={m} value={m}>{m} min</option>)}
                  </select>
                </SettingRow>
              </SectionCard>
            </div>
          )}

          {activeSection === "data" && (
            <div className="space-y-5">
              <SectionCard title="Your Data">
                <SettingRow label="Export All Data" description="Download your tasks, notes, and plans as JSON">
                  <Button variant="outline" size="sm" onClick={handleExportData}><Download className="w-3.5 h-3.5 mr-1.5" />Export</Button>
                </SettingRow>
              </SectionCard>
              <SectionCard title="Danger Zone" danger>
                <SettingRow label="Delete Account" description="Permanently delete your account and all data">
                  <Button variant="destructive" size="sm" onClick={handleDeleteAccount}><Trash2 className="w-3.5 h-3.5 mr-1.5" />Delete</Button>
                </SettingRow>
              </SectionCard>
            </div>
          )}

          {activeSection === "about" && (
            <SectionCard title="About SOFI">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><span className="text-lg">🤖</span></div>
                  <div><p className="text-sm font-semibold text-foreground">SOFI</p><p className="text-xs text-muted-foreground">Your AI Study & Productivity Assistant</p></div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-muted-foreground">Version</span><p className="font-medium text-foreground">2.0.0</p></div>
                  <div><span className="text-muted-foreground">Build</span><p className="font-medium text-foreground">2026.04</p></div>
                  <div><span className="text-muted-foreground">Platform</span><p className="font-medium text-foreground">Web App</p></div>
                  <div><span className="text-muted-foreground">AI Engine</span><p className="font-medium text-foreground">Gemini 2.5</p></div>
                </div>
              </div>
            </SectionCard>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function SectionCard({ title, children, danger }: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <div className={`rounded-xl border p-5 space-y-4 ${danger ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"}`}>
      <h3 className={`text-sm font-semibold ${danger ? "text-destructive" : "text-foreground"}`}>{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="min-w-0"><p className="text-sm font-medium text-foreground">{label}</p><p className="text-xs text-muted-foreground">{description}</p></div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

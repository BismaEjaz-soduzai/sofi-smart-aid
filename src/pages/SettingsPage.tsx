import PageShell from "@/components/PageShell";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Settings as SettingsIcon, Moon, Sun, Monitor, User, Bell, Shield, 
  Download, Trash2, LogOut, ChevronRight, Globe, Clock, BookOpen,
  Volume2, VolumeX, Eye, EyeOff, Save, Camera
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

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<SettingsSection>("appearance");

  // Theme
  const [theme, setTheme] = useState<Theme>(() =>
    (localStorage.getItem("sofi-theme") as Theme) || "system"
  );

  // Profile
  const [displayName, setDisplayName] = useState(user?.user_metadata?.full_name || "");
  const [saving, setSaving] = useState(false);

  // Preferences (localStorage-based)
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

  const updatePref = (key: string, value: any) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    localStorage.setItem("sofi-prefs", JSON.stringify(next));
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: displayName },
    });
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

  const handleExportData = () => {
    toast.success("Data export started. You'll be notified when ready.");
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
        {/* Sidebar nav */}
        <div className="w-48 flex-shrink-0 hidden md:block space-y-1">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeSection === s.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <s.icon className="w-4 h-4" />
              {s.label}
            </button>
          ))}
          <Separator className="my-3" />
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/5 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6 min-w-0">
          {/* Mobile section selector */}
          <div className="flex gap-2 overflow-x-auto md:hidden pb-2">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  activeSection === s.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Profile */}
          {activeSection === "profile" && (
            <div className="space-y-5">
              <SectionCard title="Your Profile">
                <div className="flex items-center gap-4 mb-5">
                  <div className="relative">
                    <Avatar className="w-16 h-16">
                      <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <button className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Camera className="w-3 h-3" />
                    </button>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{displayName || "Set your name"}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Display Name</label>
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your name"
                      className="h-9"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
                    <Input value={user?.email || ""} disabled className="h-9 opacity-60" />
                  </div>
                  <Button onClick={handleSaveProfile} disabled={saving} size="sm" className="mt-2">
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </SectionCard>

              <SectionCard title="Defaults">
                <SettingRow label="Default Task Priority" description="New tasks will use this priority">
                  <select
                    value={prefs.defaultPriority}
                    onChange={(e) => updatePref("defaultPriority", e.target.value)}
                    className="text-xs bg-muted rounded-lg px-2.5 py-1.5 border border-border text-foreground"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </SettingRow>
                <SettingRow label="Default Category" description="New tasks default category">
                  <select
                    value={prefs.defaultCategory}
                    onChange={(e) => updatePref("defaultCategory", e.target.value)}
                    className="text-xs bg-muted rounded-lg px-2.5 py-1.5 border border-border text-foreground"
                  >
                    {["personal", "study", "work", "assignment", "exam", "fyp"].map((c) => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                </SettingRow>
              </SectionCard>
            </div>
          )}

          {/* Appearance */}
          {activeSection === "appearance" && (
            <div className="space-y-5">
              <SectionCard title="Theme">
                <div className="flex gap-3">
                  {themes.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setTheme(t.value)}
                      className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                        theme === t.value
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:border-primary/30"
                      }`}
                    >
                      <t.icon className={`w-5 h-5 ${theme === t.value ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`text-xs font-medium ${theme === t.value ? "text-primary" : "text-muted-foreground"}`}>
                        {t.label}
                      </span>
                    </button>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Display">
                <SettingRow label="Time Format" description="Choose 12h or 24h clock">
                  <select
                    value={prefs.timeFormat}
                    onChange={(e) => updatePref("timeFormat", e.target.value)}
                    className="text-xs bg-muted rounded-lg px-2.5 py-1.5 border border-border text-foreground"
                  >
                    <option value="12h">12-hour</option>
                    <option value="24h">24-hour</option>
                  </select>
                </SettingRow>
                <SettingRow label="Language" description="Interface language">
                  <select
                    value={prefs.language}
                    onChange={(e) => updatePref("language", e.target.value)}
                    className="text-xs bg-muted rounded-lg px-2.5 py-1.5 border border-border text-foreground"
                  >
                    <option value="en">English</option>
                    <option value="ur">Urdu</option>
                    <option value="ar">Arabic</option>
                  </select>
                </SettingRow>
                <SettingRow label="Show Completed Tasks" description="Display completed tasks in task list">
                  <Switch checked={prefs.showCompletedTasks} onCheckedChange={(v) => updatePref("showCompletedTasks", v)} />
                </SettingRow>
              </SectionCard>
            </div>
          )}

          {/* Notifications */}
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
            </SectionCard>
          )}

          {/* Privacy */}
          {activeSection === "privacy" && (
            <div className="space-y-5">
              <SectionCard title="Security">
                <SettingRow label="Change Password" description="Update your account password">
                  <Button variant="outline" size="sm" onClick={() => {
                    supabase.auth.resetPasswordForEmail(user?.email || "", {
                      redirectTo: `${window.location.origin}/reset-password`,
                    });
                    toast.success("Password reset email sent!");
                  }}>
                    Reset
                  </Button>
                </SettingRow>
              </SectionCard>

              <SectionCard title="Focus Settings">
                <SettingRow label="Focus Duration" description="Default focus session length (minutes)">
                  <select
                    value={prefs.focusDuration}
                    onChange={(e) => updatePref("focusDuration", Number(e.target.value))}
                    className="text-xs bg-muted rounded-lg px-2.5 py-1.5 border border-border text-foreground"
                  >
                    {[15, 25, 30, 45, 60].map((m) => (
                      <option key={m} value={m}>{m} min</option>
                    ))}
                  </select>
                </SettingRow>
                <SettingRow label="Break Duration" description="Default break length (minutes)">
                  <select
                    value={prefs.breakDuration}
                    onChange={(e) => updatePref("breakDuration", Number(e.target.value))}
                    className="text-xs bg-muted rounded-lg px-2.5 py-1.5 border border-border text-foreground"
                  >
                    {[3, 5, 10, 15].map((m) => (
                      <option key={m} value={m}>{m} min</option>
                    ))}
                  </select>
                </SettingRow>
              </SectionCard>
            </div>
          )}

          {/* Data & Storage */}
          {activeSection === "data" && (
            <div className="space-y-5">
              <SectionCard title="Your Data">
                <SettingRow label="Export All Data" description="Download your tasks, notes, and plans as JSON">
                  <Button variant="outline" size="sm" onClick={handleExportData}>
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Export
                  </Button>
                </SettingRow>
              </SectionCard>

              <SectionCard title="Danger Zone" danger>
                <SettingRow label="Delete Account" description="Permanently delete your account and all data">
                  <Button variant="destructive" size="sm" onClick={handleDeleteAccount}>
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Delete
                  </Button>
                </SettingRow>
              </SectionCard>
            </div>
          )}

          {/* About */}
          {activeSection === "about" && (
            <SectionCard title="About SOFI">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <span className="text-lg">🤖</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">SOFI</p>
                    <p className="text-xs text-muted-foreground">Your AI Study & Productivity Assistant</p>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-muted-foreground">Version</span><p className="font-medium text-foreground">1.0.0</p></div>
                  <div><span className="text-muted-foreground">Build</span><p className="font-medium text-foreground">2026.03</p></div>
                  <div><span className="text-muted-foreground">Platform</span><p className="font-medium text-foreground">Web (Desktop)</p></div>
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
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

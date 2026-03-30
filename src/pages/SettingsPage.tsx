import PageShell from "@/components/PageShell";
import { Settings as SettingsIcon, Moon, Sun, Monitor } from "lucide-react";
import { useState, useEffect } from "react";

type Theme = "light" | "dark" | "system";

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") {
    const sys = getSystemTheme();
    root.classList.toggle("dark", sys === "dark");
  } else {
    root.classList.toggle("dark", theme === "dark");
  }
}

export default function SettingsPage() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("sofi-theme") as Theme) || "system";
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("sofi-theme", theme);
  }, [theme]);

  // Listen for system theme changes when in system mode
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => { if (theme === "system") applyTheme("system"); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const themes: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  return (
    <PageShell title="Settings" description="Configure your SOFI experience" icon={SettingsIcon}>
      <div className="space-y-6 max-w-2xl">
        {/* Appearance */}
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Appearance</h3>
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
                <span className={`text-xs font-medium ${theme === t.value ? "text-primary" : "text-muted-foreground"}`}>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Other sections */}
        {["Profile", "Notifications", "Integrations", "Privacy"].map((section) => (
          <div key={section} className="glass-card-hover p-5 flex items-center justify-between cursor-pointer">
            <span className="text-sm font-medium text-foreground">{section}</span>
            <span className="text-xs text-muted-foreground">→</span>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

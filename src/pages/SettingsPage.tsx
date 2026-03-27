import PageShell from "@/components/PageShell";
import { Settings as SettingsIcon } from "lucide-react";

export default function SettingsPage() {
  return (
    <PageShell title="Settings" description="Configure your SOFI experience" icon={SettingsIcon}>
      <div className="space-y-4">
        {["Profile", "Appearance", "Notifications", "Integrations", "Privacy"].map((section) => (
          <div key={section} className="glass-card-hover p-5 flex items-center justify-between cursor-pointer">
            <span className="text-sm font-medium text-foreground">{section}</span>
            <span className="text-xs text-muted-foreground">→</span>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

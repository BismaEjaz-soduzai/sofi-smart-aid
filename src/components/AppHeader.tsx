import { useLocation, useNavigate } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useRef, useEffect } from "react";
import { Menu, ChevronDown, User, LogOut, Settings } from "lucide-react";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationCenter } from "@/components/NotificationCenter";
import { GlobalVoiceButton } from "@/components/GlobalVoiceButton";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/organizer": "Organizer",
  "/planner": "Planner",
  "/workspace": "Smart Workspace",
  "/assistant": "SOFI Assistant",
  "/settings": "Settings",
  "/profile": "Profile",
  "/chat": "Study Chat",
  "/analytics": "Study Analytics",
};

export function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const pageTitle = pageTitles[location.pathname] || "SOFI";

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <header className="h-14 flex items-center justify-between border-b border-border px-4 lg:px-6 bg-card/60 backdrop-blur-xl sticky top-0 z-20">
      <div className="flex items-center gap-3 min-w-0">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors lg:hidden">
          <Menu className="w-4 h-4" />
        </SidebarTrigger>
        <h2 className="text-sm font-semibold text-foreground tracking-tight truncate">{pageTitle}</h2>
      </div>

      <div className="flex items-center gap-1.5">
        <GlobalSearch />
        <GlobalVoiceButton />
        <NotificationCenter />
        <div className="w-px h-5 bg-border mx-1" />

        <div ref={profileRef} className="relative">
          <button onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-muted/50 transition-colors">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-semibold text-primary">{initials}</span>
            </div>
            <span className="text-sm text-foreground font-medium hidden sm:block max-w-[100px] truncate">{displayName}</span>
            <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${profileOpen ? "rotate-180" : ""}`} />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-border bg-card shadow-lg py-1.5 animate-fade-in z-50">
              <div className="px-3 py-2 border-b border-border mb-1">
                <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <DropdownItem icon={User} label="Profile" onClick={() => { setProfileOpen(false); navigate("/profile"); }} />
              <DropdownItem icon={Settings} label="Settings" onClick={() => { setProfileOpen(false); navigate("/settings"); }} />
              <div className="border-t border-border mt-1 pt-1">
                <DropdownItem icon={LogOut} label="Sign Out" onClick={handleSignOut} destructive />
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function DropdownItem({ icon: Icon, label, onClick, destructive }: { icon: any; label: string; onClick: () => void; destructive?: boolean }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${destructive ? "text-destructive hover:bg-destructive/5" : "text-foreground hover:bg-muted/50"}`}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

import {
  LayoutDashboard,
  CheckSquare,
  StickyNote,
  Calendar,
  BookOpen,
  Sparkles,
  MessageSquare,
  User,
  ChevronLeft,
  LogOut,
  Settings,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const mainNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Notes", url: "/notes", icon: StickyNote },
  { title: "Planner", url: "/planner", icon: Calendar },
];

const workspaceNav = [
  { title: "Smart Workspace", url: "/workspace", icon: BookOpen },
  { title: "SOFI Assistant", url: "/assistant", icon: Sparkles },
  { title: "Study Chat", url: "/chat", icon: MessageSquare },
];

const accountNav = [
  { title: "Profile", url: "/profile", icon: User },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-sm">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex items-center justify-between flex-1 min-w-0">
              <div>
                <h1 className="text-base font-semibold text-foreground tracking-tight">SOFI</h1>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Smart Assistant</p>
              </div>
              <button onClick={toggleSidebar} className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 mt-1">
        <NavGroup label="Main" items={mainNav} collapsed={collapsed} isActive={isActive} />
        <NavGroup label="AI & Study" items={workspaceNav} collapsed={collapsed} isActive={isActive} />
      </SidebarContent>

      <SidebarFooter className="p-2 space-y-0.5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/settings" end className="hover:bg-sidebar-accent/50 transition-colors" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                <Settings className="w-4 h-4 mr-2 flex-shrink-0" />
                {!collapsed && <span>Settings</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <button onClick={handleSignOut} className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors">
                <LogOut className="w-4 h-4 mr-0 flex-shrink-0" />
                {!collapsed && <span>Sign Out</span>}
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function NavGroup({ label, items, collapsed, isActive }: { label: string; items: { title: string; url: string; icon: any }[]; collapsed: boolean; isActive: (path: string) => boolean }) {
  return (
    <SidebarGroup>
      {!collapsed && (
        <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium px-2 mb-1">{label}</SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <NavLink to={item.url} end className="hover:bg-sidebar-accent/50 transition-all duration-150" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                  <item.icon className="w-4 h-4 mr-2 flex-shrink-0" />
                  {!collapsed && <span className="truncate text-[13px]">{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

import {
  LayoutDashboard,
  CheckSquare,
  Bell,
  StickyNote,
  Calendar,
  BookOpen,
  Upload,
  Timer,
  GraduationCap,
  MessageCircle,
  Settings,
  Sparkles,
  ChevronLeft,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
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
  { title: "Reminders", url: "/reminders", icon: Bell },
  { title: "Notes", url: "/notes", icon: StickyNote },
  { title: "Planner", url: "/planner", icon: Calendar },
];

const studyNav = [
  { title: "Study Companion", url: "/study", icon: BookOpen },
  { title: "Learning Hub", url: "/learning", icon: Upload },
  { title: "Assignments", url: "/assignments", icon: GraduationCap },
];

const toolsNav = [
  { title: "Focus Mode", url: "/focus", icon: Timer },
  { title: "AI Assistant", url: "/assistant", icon: MessageCircle },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex items-center justify-between flex-1 min-w-0">
              <div>
                <h1 className="text-base font-semibold text-foreground tracking-tight">SOFI</h1>
                <p className="text-[10px] text-muted-foreground leading-none">Smart Assistant</p>
              </div>
              <button onClick={toggleSidebar} className="text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <NavGroup label="Main" items={mainNav} collapsed={collapsed} isActive={isActive} />
        <NavGroup label="Study" items={studyNav} collapsed={collapsed} isActive={isActive} />
        <NavGroup label="Tools" items={toolsNav} collapsed={collapsed} isActive={isActive} />
      </SidebarContent>

      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink
                to="/settings"
                end
                className="hover:bg-sidebar-accent/50"
                activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              >
                <Settings className="w-4 h-4 mr-2" />
                {!collapsed && <span>Settings</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function NavGroup({
  label,
  items,
  collapsed,
  isActive,
}: {
  label: string;
  items: { title: string; url: string; icon: any }[];
  collapsed: boolean;
  isActive: (path: string) => boolean;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-medium">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <NavLink
                  to={item.url}
                  end
                  className="hover:bg-sidebar-accent/50 transition-colors"
                  activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                >
                  <item.icon className="w-4 h-4 mr-2 flex-shrink-0" />
                  {!collapsed && <span className="truncate">{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

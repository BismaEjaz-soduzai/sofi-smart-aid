import { motion } from "framer-motion";
import {
  CheckSquare, StickyNote, Calendar, Sparkles, TrendingUp,
  Timer, MessageCircle, BookOpen, AlertTriangle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useTasks } from "@/hooks/useTasks";
import { useNotes } from "@/hooks/useNotes";
import { usePlans } from "@/hooks/usePlans";
import { format, isPast, isToday, isTomorrow, parseISO } from "date-fns";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export default function Dashboard() {
  const { data: tasks = [] } = useTasks();
  const { data: notes = [] } = useNotes();
  const { data: plans = [] } = usePlans();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const pendingTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);
  const overdueTasks = pendingTasks.filter((t) => t.due_date && isPast(new Date(t.due_date + "T23:59:59")) && !isToday(parseISO(t.due_date)));
  const todayTasks = pendingTasks.filter((t) => t.due_date && isToday(parseISO(t.due_date)));
  const upcomingTasks = pendingTasks.filter((t) => t.due_date && !isPast(new Date(t.due_date + "T23:59:59")) && !isToday(parseISO(t.due_date))).slice(0, 3);
  const activePlans = plans.filter((p) => p.status === "active");
  const recentNotes = notes.slice(0, 3);

  const quickActions = [
    { label: "Tasks", icon: CheckSquare, href: "/tasks", count: pendingTasks.length, color: "text-primary" },
    { label: "Notes", icon: StickyNote, href: "/notes", count: notes.length, color: "text-info" },
    { label: "Plans", icon: Calendar, href: "/planner", count: activePlans.length, color: "text-success" },
    { label: "Workspace", icon: BookOpen, href: "/workspace", count: 0, color: "text-warning" },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      {/* Hero */}
      <motion.div variants={item} className="space-y-1">
        <h1 className="text-2xl lg:text-3xl font-semibold text-foreground tracking-tight">{greeting} 👋</h1>
        <p className="text-muted-foreground">
          {pendingTasks.length > 0 ? `You have ${pendingTasks.length} pending task${pendingTasks.length > 1 ? "s" : ""}.` : "You're all caught up!"}
          {overdueTasks.length > 0 && ` ${overdueTasks.length} overdue.`}
        </p>
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {quickActions.map((action) => (
          <Link key={action.label} to={action.href}>
            <div className="glass-card-hover p-4 flex flex-col gap-3 group cursor-pointer">
              <div className="flex items-center justify-between">
                <action.icon className={`w-5 h-5 ${action.color}`} />
                <span className="text-2xl font-semibold text-foreground">{action.count}</span>
              </div>
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{action.label}</span>
            </div>
          </Link>
        ))}
      </motion.div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Today's Focus */}
        <motion.div variants={item} className="lg:col-span-2 glass-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="font-medium text-foreground">Today's Focus</h2>
          </div>
          {overdueTasks.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-xs font-medium">
              <AlertTriangle className="w-3.5 h-3.5" /> {overdueTasks.length} overdue task{overdueTasks.length > 1 ? "s" : ""}
            </div>
          )}
          <div className="space-y-2">
            {todayTasks.length > 0 ? todayTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <div className={`w-4 h-4 rounded border-2 flex-shrink-0 ${task.completed ? "bg-primary border-primary" : "border-primary/40"}`} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-foreground truncate block">{task.title}</span>
                  {task.due_time && <span className="text-[10px] text-muted-foreground">{task.due_time}</span>}
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${task.priority === "high" ? "bg-destructive/10 text-destructive" : task.priority === "medium" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"}`}>{task.priority}</span>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No tasks due today. Enjoy your day! 🌟</p>
            )}
          </div>
          {upcomingTasks.length > 0 && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2">Coming up</p>
              {upcomingTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between py-1.5 text-xs">
                  <span className="text-foreground truncate">{task.title}</span>
                  <span className="text-muted-foreground ml-2 flex-shrink-0">{task.due_date && format(parseISO(task.due_date), "MMM d")}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* SOFI + Notes */}
        <div className="space-y-6">
          <motion.div variants={item} className="glass-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="font-medium text-foreground">SOFI Assistant</h2>
            </div>
            <p className="text-sm text-muted-foreground">Ask me anything about your schedule, assignments, or study materials.</p>
            <Link to="/assistant" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
              <MessageCircle className="w-4 h-4" /> Start Chat
            </Link>
          </motion.div>

          <motion.div variants={item} className="glass-card p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-info" />
                <h2 className="font-medium text-foreground">Recent Notes</h2>
              </div>
              <Link to="/notes" className="text-xs text-primary hover:underline">View all</Link>
            </div>
            {recentNotes.length > 0 ? recentNotes.map((note) => (
              <div key={note.id} className="p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <p className="text-sm font-medium text-foreground truncate">{note.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(note.updated_at), "MMM d")}</p>
              </div>
            )) : <p className="text-xs text-muted-foreground">No notes yet</p>}
          </motion.div>
        </div>
      </div>

      {/* Progress */}
      <motion.div variants={item} className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-primary" />
            <h2 className="font-medium text-foreground">Focus Session</h2>
          </div>
          <div className="text-center py-6">
            <div className="text-4xl font-light text-foreground tracking-tight font-mono">25:00</div>
            <p className="text-sm text-muted-foreground mt-2">Ready to focus</p>
          </div>
          <Link to="/assistant" className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors">
            Start Focus Mode
          </Link>
        </div>

        <div className="glass-card p-6 space-y-4">
          <h2 className="font-medium text-foreground">Weekly Progress</h2>
          <div className="space-y-3">
            {[
              { label: "Tasks Completed", value: completedTasks.length, max: Math.max(tasks.length, 1) },
              { label: "Active Plans", value: activePlans.length, max: Math.max(plans.length, 1) },
              { label: "Notes Created", value: notes.length, max: Math.max(notes.length, 1) },
            ].map((stat) => (
              <div key={stat.label} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{stat.label}</span>
                  <span className="text-foreground font-medium">{stat.value}/{stat.max}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${(stat.value / stat.max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

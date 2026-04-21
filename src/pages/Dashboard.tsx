import { motion } from "framer-motion";
import {
  CheckSquare, StickyNote, Calendar, Sparkles, TrendingUp,
  Timer, MessageCircle, BookOpen, AlertTriangle, Zap, Target,
  ArrowRight, Flame, Pause, Play, RotateCcw, Trophy, Star,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useTasks } from "@/hooks/useTasks";
import { useNotes } from "@/hooks/useNotes";
import { usePlans } from "@/hooks/usePlans";
import { useFocusTimer } from "@/contexts/FocusTimerContext";
import { useRewards } from "@/hooks/useRewards";
import { useDailyActivity } from "@/hooks/useStudySessions";
import { format, isPast, isToday, isTomorrow, parseISO } from "date-fns";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const MOTIVATIONAL_QUOTES = [
  "Small progress is still progress. Keep going! 🚀",
  "Your future self will thank you. Start now! 💪",
  "Consistency beats perfection. You've got this! 🌟",
  "Every expert was once a beginner. Keep learning! 📚",
  "The best time to start is now! ⚡",
];

export default function Dashboard() {
  const { data: tasks = [] } = useTasks();
  const { data: notes = [] } = useNotes();
  const { data: plans = [] } = usePlans();
  const { seconds, running, setRunning, reset, duration, sessionType } = useFocusTimer();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const quote = MOTIVATIONAL_QUOTES[new Date().getDay() % MOTIVATIONAL_QUOTES.length];

  const pendingTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);
  const overdueTasks = pendingTasks.filter((t) => t.due_date && isPast(new Date(t.due_date + "T23:59:59")) && !isToday(parseISO(t.due_date)));
  const todayTasks = pendingTasks.filter((t) => t.due_date && isToday(parseISO(t.due_date)));
  const upcomingTasks = pendingTasks.filter((t) => t.due_date && !isPast(new Date(t.due_date + "T23:59:59")) && !isToday(parseISO(t.due_date))).slice(0, 3);
  const activePlans = plans.filter((p) => p.status === "active");
  const recentNotes = notes.slice(0, 3);

  const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
  const streak = completedTasks.length; // simplified streak

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      {/* Hero with motivational quote */}
      <motion.div variants={item} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-accent/20 to-info/10 border border-primary/10 p-6 lg:p-8">
        <div className="relative z-10">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">{greeting} 👋</h1>
          <p className="text-muted-foreground mt-1 max-w-xl">
            {pendingTasks.length > 0 ? `You have ${pendingTasks.length} pending task${pendingTasks.length > 1 ? "s" : ""}.` : "You're all caught up!"}
            {overdueTasks.length > 0 && <span className="text-destructive font-medium"> {overdueTasks.length} overdue.</span>}
          </p>
          <p className="text-sm text-primary/80 mt-3 italic flex items-center gap-2"><Flame className="w-4 h-4" /> {quote}</p>
        </div>
        <div className="absolute top-4 right-4 w-24 h-24 rounded-full bg-primary/5 blur-2xl" />
      </motion.div>

      {/* Stats row */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Pending Tasks", value: pendingTasks.length, icon: CheckSquare, color: "text-primary", bg: "bg-primary/10", href: "/organizer" },
          { label: "Completion Rate", value: `${completionRate}%`, icon: Target, color: "text-success", bg: "bg-success/10", href: "/organizer" },
          { label: "Active Plans", value: activePlans.length, icon: Calendar, color: "text-info", bg: "bg-info/10", href: "/planner" },
          { label: "Total Notes", value: notes.length, icon: StickyNote, color: "text-warning", bg: "bg-warning/10", href: "/organizer" },
        ].map((stat) => (
          <Link key={stat.label} to={stat.href}>
            <div className="glass-card-hover p-4 flex items-center gap-3 group">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <span className="text-2xl font-bold text-foreground">{stat.value}</span>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </Link>
        ))}
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Today's Focus */}
        <motion.div variants={item} className="lg:col-span-2 glass-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-foreground">Today's Focus</h2>
            </div>
            <Link to="/organizer" className="text-xs text-primary hover:underline flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
          </div>
          {overdueTasks.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-destructive/10 text-destructive text-xs font-medium">
              <AlertTriangle className="w-4 h-4" /> {overdueTasks.length} overdue task{overdueTasks.length > 1 ? "s" : ""} — take action!
            </div>
          )}
          <div className="space-y-2">
            {todayTasks.length > 0 ? todayTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${task.completed ? "bg-primary border-primary" : "border-primary/40"}`}>
                  {task.completed && <CheckSquare className="w-3 h-3 text-primary-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-foreground truncate block font-medium">{task.title}</span>
                  {task.due_time && <span className="text-[10px] text-muted-foreground">{task.due_time}</span>}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${task.priority === "high" ? "bg-destructive/10 text-destructive" : task.priority === "medium" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"}`}>{task.priority}</span>
              </div>
            )) : (
              <div className="py-6 text-center">
                <Zap className="w-8 h-8 text-primary/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No tasks due today. Enjoy your day! 🌟</p>
              </div>
            )}
          </div>
          {upcomingTasks.length > 0 && (
            <div className="pt-3 border-t border-border">
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
          <motion.div variants={item} className="glass-card p-6 space-y-4 bg-gradient-to-br from-primary/5 to-transparent">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-foreground">SOFI Assistant</h2>
            </div>
            <p className="text-sm text-muted-foreground">Ask me anything about your schedule, assignments, or study materials.</p>
            <Link to="/assistant" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity w-full justify-center">
              <MessageCircle className="w-4 h-4" /> Start Chat
            </Link>
          </motion.div>

          <motion.div variants={item} className="glass-card p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-info" />
                <h2 className="font-semibold text-foreground">Recent Notes</h2>
              </div>
              <Link to="/organizer" className="text-xs text-primary hover:underline">View all</Link>
            </div>
            {recentNotes.length > 0 ? recentNotes.map((note) => (
              <div key={note.id} className="p-2.5 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                <p className="text-sm font-medium text-foreground truncate">{note.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(note.updated_at), "MMM d")}</p>
              </div>
            )) : <p className="text-xs text-muted-foreground">No notes yet</p>}
          </motion.div>
        </div>
      </div>

      {/* Bottom row */}
      <motion.div variants={item} className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-foreground">Quick Focus</h2>
            </div>
            {running && <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success font-medium animate-pulse">LIVE</span>}
          </div>
          <div className="text-center py-2">
            <div className="text-4xl font-light text-foreground tracking-tight font-mono">
              {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {running ? `${sessionType} in progress` : "Ready to focus"}
            </p>
            {running && (
              <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-1000"
                  style={{ width: `${((duration * 60 - seconds) / (duration * 60)) * 100}%` }}
                />
              </div>
            )}
          </div>
          {running ? (
            <div className="flex gap-2">
              <button
                onClick={() => setRunning(false)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-warning/10 text-warning text-sm font-medium hover:bg-warning/20 transition-colors"
              >
                <Pause className="w-4 h-4" /> Pause
              </button>
              <button
                onClick={reset}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <Link
                to="/assistant?section=focus"
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Open
              </Link>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setRunning(true)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Play className="w-4 h-4" /> Start
              </button>
              <Link
                to="/assistant?section=focus"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
              >
                Focus Mode
              </Link>
            </div>
          )}
        </div>

        <div className="glass-card p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Weekly Progress</h2>
          <div className="space-y-3">
            {[
              { label: "Tasks Completed", value: completedTasks.length, max: Math.max(tasks.length, 1), color: "bg-primary" },
              { label: "Active Plans", value: activePlans.length, max: Math.max(plans.length, 1), color: "bg-info" },
              { label: "Notes Created", value: notes.length, max: Math.max(notes.length, 1), color: "bg-warning" },
            ].map((stat) => (
              <div key={stat.label} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{stat.label}</span>
                  <span className="text-foreground font-medium">{stat.value}/{stat.max}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${stat.color} rounded-full transition-all duration-500`} style={{ width: `${(stat.value / stat.max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

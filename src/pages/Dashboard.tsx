import { motion } from "framer-motion";
import {
  CheckSquare,
  Bell,
  StickyNote,
  Calendar,
  Timer,
  MessageCircle,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";

const quickActions = [
  { label: "Tasks", icon: CheckSquare, href: "/tasks", count: 5, color: "text-primary" },
  { label: "Reminders", icon: Bell, href: "/reminders", count: 3, color: "text-warning" },
  { label: "Notes", icon: StickyNote, href: "/notes", count: 12, color: "text-info" },
  { label: "Planner", icon: Calendar, href: "/planner", count: 2, color: "text-success" },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export default function Dashboard() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8"
    >
      {/* Hero */}
      <motion.div variants={item} className="space-y-1">
        <h1 className="text-2xl lg:text-3xl font-semibold text-foreground tracking-tight">
          {greeting} 👋
        </h1>
        <p className="text-muted-foreground">Here's your productivity overview for today.</p>
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
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                {action.label}
              </span>
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
          <div className="space-y-3">
            {["Complete React project", "Review lecture notes", "Submit assignment"].map((task, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <div className="w-4 h-4 rounded border-2 border-primary/40 flex-shrink-0" />
                <span className="text-sm text-foreground">{task}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* AI Assistant Card */}
        <motion.div variants={item} className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="font-medium text-foreground">SOFI Assistant</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Ask me anything about your schedule, assignments, or study materials.
          </p>
          <Link
            to="/assistant"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <MessageCircle className="w-4 h-4" />
            Start Chat
          </Link>
        </motion.div>
      </div>

      {/* Focus & Stats */}
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
          <Link
            to="/focus"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
          >
            Start Focus Mode
          </Link>
        </div>

        <div className="glass-card p-6 space-y-4">
          <h2 className="font-medium text-foreground">Weekly Progress</h2>
          <div className="space-y-3">
            {[
              { label: "Tasks Completed", value: 12, max: 20 },
              { label: "Focus Hours", value: 8, max: 15 },
              { label: "Notes Created", value: 5, max: 10 },
            ].map((stat) => (
              <div key={stat.label} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{stat.label}</span>
                  <span className="text-foreground font-medium">{stat.value}/{stat.max}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${(stat.value / stat.max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

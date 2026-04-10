import { motion } from "framer-motion";
import { Sparkles, ArrowRight, CheckSquare, Calendar, MessageCircle, BookOpen, Zap, Brain } from "lucide-react";
import { Link } from "react-router-dom";

const features = [
  { icon: CheckSquare, title: "Task Management", desc: "Organize your tasks with smart reminders" },
  { icon: Calendar, title: "Study Planner", desc: "AI-powered study plans with calendar view" },
  { icon: Brain, title: "SOFI AI Assistant", desc: "Chat, voice, and document analysis" },
  { icon: MessageCircle, title: "Study Chat", desc: "Collaborate with friends in real-time" },
  { icon: BookOpen, title: "Smart Workspace", desc: "Upload materials and generate study content" },
  { icon: Zap, title: "Focus Mode", desc: "Pomodoro timer for productive sessions" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="flex items-center justify-center px-6 pt-16 pb-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center space-y-8 max-w-2xl">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto shadow-lg">
            <Sparkles className="w-8 h-8 text-primary-foreground" />
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground tracking-tight">SOFI</h1>
            <p className="text-lg lg:text-xl text-muted-foreground">Your smart AI assistant for productivity & study</p>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
            Manage tasks, plan your schedule, take notes, collaborate with friends, and chat with an AI companion — all in one powerful platform.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/signup" className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity shadow-lg">
              Get Started Free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/login" className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-secondary text-secondary-foreground font-medium text-sm hover:bg-secondary/80 transition-colors">
              Sign In
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Features */}
      <div className="max-w-4xl mx-auto px-6 pb-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6 }}>
          <h2 className="text-center text-lg font-semibold text-foreground mb-8">Everything you need to excel</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => (
              <div key={f.title} className="glass-card p-5 space-y-3 hover:shadow-lg transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{f.title}</h3>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

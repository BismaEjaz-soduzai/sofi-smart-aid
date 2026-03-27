import { motion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center space-y-8 max-w-lg"
      >
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto">
          <Sparkles className="w-8 h-8 text-primary-foreground" />
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-semibold text-foreground tracking-tight">SOFI</h1>
          <p className="text-lg text-muted-foreground">
            Your smart AI assistant for productivity and study.
          </p>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
          Manage tasks, plan your schedule, take notes, track assignments, and chat with an AI companion — all in one place.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-secondary text-secondary-foreground font-medium text-sm hover:bg-secondary/80 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

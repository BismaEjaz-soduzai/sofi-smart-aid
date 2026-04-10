import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Brain, TrendingUp, AlertTriangle, Target, Loader2,
  BookOpen, CheckCircle2, Clock, ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface StudyInsight {
  type: "warning" | "suggestion" | "strength" | "goal";
  title: string;
  description: string;
  action?: string;
}

const ADVISOR_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-advisor`;

export default function AdaptiveInsights({ onAskSofi }: { onAskSofi: (prompt: string) => void }) {
  const { user } = useAuth();
  const [insights, setInsights] = useState<StudyInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchInsights = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const resp = await fetch(ADVISOR_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ user_id: user.id }),
      });

      if (!resp.ok) throw new Error("Failed to get insights");
      const data = await resp.json();
      setInsights(data.insights || []);
      setHasLoaded(true);
    } catch (e) {
      console.error("Insights error:", e);
      // Fallback static insights
      setInsights([
        { type: "suggestion", title: "Start a study session", description: "Use the Focus Zone to stay productive today." },
        { type: "goal", title: "Set your goals", description: "Add tasks and plans to get personalized study recommendations." },
      ]);
      setHasLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && !hasLoaded) fetchInsights();
  }, [user]);

  const iconMap = {
    warning: <AlertTriangle className="w-4 h-4 text-warning" />,
    suggestion: <Target className="w-4 h-4 text-primary" />,
    strength: <CheckCircle2 className="w-4 h-4 text-success" />,
    goal: <TrendingUp className="w-4 h-4 text-accent-foreground" />,
  };

  const bgMap = {
    warning: "border-warning/20 bg-warning/5",
    suggestion: "border-primary/20 bg-primary/5",
    strength: "border-success/20 bg-success/5",
    goal: "border-accent/20 bg-accent/10",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Study Insights</h3>
        </div>
        <button
          onClick={fetchInsights}
          disabled={loading}
          className="text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Refresh"}
        </button>
      </div>

      {loading && !hasLoaded ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {insights.map((insight, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`p-3 rounded-xl border ${bgMap[insight.type]} cursor-pointer hover:shadow-sm transition-shadow`}
              onClick={() => {
                if (insight.action) onAskSofi(insight.action);
              }}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5">{iconMap[insight.type]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">{insight.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{insight.description}</p>
                </div>
                {insight.action && <ArrowRight className="w-3 h-3 text-muted-foreground mt-1 flex-shrink-0" />}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

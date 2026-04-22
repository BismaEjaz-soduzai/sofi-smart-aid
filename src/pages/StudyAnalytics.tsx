import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import {
  subDays, isSameDay, eachDayOfInterval, isAfter, startOfDay, format,
} from "date-fns";
import {
  Trophy, Flame, CheckCircle2, AlertTriangle, TrendingUp, Clock,
  Sparkles, Target, BookOpen, Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTasks } from "@/hooks/useTasks";
import { useNotes } from "@/hooks/useNotes";
import { usePlans } from "@/hooks/usePlans";
import { useStudySessions } from "@/hooks/useStudySessions";
import AdaptiveInsights from "@/components/sofi/AdaptiveInsights";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(38, 92%, 50%)",
  "hsl(152, 60%, 42%)",
  "hsl(0, 72%, 55%)",
  "hsl(262, 60%, 55%)",
  "hsl(210, 70%, 55%)",
];

export default function StudyAnalytics() {
  const navigate = useNavigate();
  const { data: tasks = [] } = useTasks();
  const { data: notes = [] } = useNotes();
  const { data: plans = [] } = usePlans();
  const { data: sessions = [] } = useStudySessions();

  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const completed = tasks.filter((t: any) => t.completed);
    const completionRate = tasks.length ? (completed.length / tasks.length) * 100 : 0;

    // streak: consecutive days backwards with at least one completed_at
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = subDays(today, i);
      const hit = completed.some((t: any) => t.completed_at && isSameDay(new Date(t.completed_at), d));
      if (hit) streak++;
      else if (i > 0) break;
      else break;
    }

    const overdue = tasks.filter((t: any) =>
      !t.completed && t.due_date && isAfter(today, new Date(t.due_date))
    ).length;

    const activePlans = plans.filter((p: any) => p.status === "active");

    // last 7 / 30 days
    const last7 = eachDayOfInterval({ start: subDays(today, 6), end: today });
    const last30 = eachDayOfInterval({ start: subDays(today, 29), end: today });

    const weekly = last7.map((d) => ({
      day: format(d, "EEE"),
      Completed: completed.filter((t: any) => t.completed_at && isSameDay(new Date(t.completed_at), d)).length,
      Created: tasks.filter((t: any) => isSameDay(new Date(t.created_at), d)).length,
    }));

    // Focus minutes per day from completed study_sessions
    const focusByDay = last7.map((d) => {
      const mins = sessions
        .filter((s: any) => s.completed && isSameDay(new Date(s.created_at), d))
        .reduce((acc: number, s: any) => acc + (s.session_duration || 0), 0);
      return { day: format(d, "EEE"), Minutes: mins, Hours: +(mins / 60).toFixed(2) };
    });
    const totalFocusMinWeek = focusByDay.reduce((a, b) => a + b.Minutes, 0);
    const todayFocusMin = sessions
      .filter((s: any) => s.completed && isSameDay(new Date(s.created_at), today))
      .reduce((acc: number, s: any) => acc + (s.session_duration || 0), 0);

    let cum = 0;
    const monthly = last30.map((d, i) => {
      const daily = completed.filter((t: any) => t.completed_at && isSameDay(new Date(t.completed_at), d)).length;
      cum += daily;
      return { date: format(d, "MMM d"), Daily: daily, Cumulative: cum, idx: i };
    }).filter((_, i) => i % 3 === 0 || i === last30.length - 1);

    const completedLast7 = weekly.reduce((a, b) => a + b.Completed, 0);
    const notesLast7 = notes.filter((n: any) =>
      last7.some((d) => isSameDay(new Date(n.created_at), d))
    ).length;
    const avgPlanProgress = activePlans.length
      ? activePlans.reduce((a: number, p: any) => a + (p.progress || 0), 0) / activePlans.length
      : 0;

    const radar = [
      { axis: "Tasks Done", value: Math.min(100, completedLast7 * 10) },
      { axis: "Notes", value: Math.min(100, notesLast7 * 15) },
      { axis: "Streak", value: Math.min(100, streak * 14) },
      { axis: "Plan Progress", value: Math.round(avgPlanProgress) },
      { axis: "Active Plans", value: Math.min(100, activePlans.length * 25) },
      { axis: "Completion %", value: Math.round(completionRate) },
    ];

    const priority = [
      { name: "High", value: tasks.filter((t: any) => t.priority === "high").length },
      { name: "Medium", value: tasks.filter((t: any) => t.priority === "medium").length },
      { name: "Low", value: tasks.filter((t: any) => t.priority === "low").length },
    ].filter((p) => p.value > 0);

    // peak hour
    const hourCounts: Record<number, number> = {};
    completed.forEach((t: any) => {
      if (t.completed_at) {
        const h = new Date(t.completed_at).getHours();
        hourCounts[h] = (hourCounts[h] || 0) + 1;
      }
    });
    const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const peakHourLabel = peakHour ? `${peakHour}:00` : "—";

    const avgPerDay = (completedLast7 / 7).toFixed(1);

    // best streak (scan history)
    let best = 0, run = 0;
    const allDays = eachDayOfInterval({ start: subDays(today, 89), end: today });
    allDays.forEach((d) => {
      const hit = completed.some((t: any) => t.completed_at && isSameDay(new Date(t.completed_at), d));
      if (hit) { run++; best = Math.max(best, run); } else run = 0;
    });

    // heatmap 28 days
    const heatmap = eachDayOfInterval({ start: subDays(today, 27), end: today }).map((d) => ({
      date: d,
      count: completed.filter((t: any) => t.completed_at && isSameDay(new Date(t.completed_at), d)).length,
      isToday: isSameDay(d, today),
    }));

    // AI score 0-100
    const score = Math.round(
      completionRate * 0.4 +
      Math.min(20, streak * 4) +
      Math.min(20, notes.length * 2) +
      Math.min(20, activePlans.length * 5)
    );
    const label = score >= 75 ? "Excellent" : score >= 50 ? "Good" : score >= 25 ? "Building" : "Just Starting";
    const scoreColor = score >= 75 ? "text-success" : score >= 50 ? "text-success" : score >= 25 ? "text-warning" : "text-destructive";

    return {
      total: tasks.length, completedCount: completed.length, completionRate, streak, overdue,
      activePlans, weekly, monthly, radar, priority, peakHourLabel, avgPerDay, best, heatmap,
      score, label, scoreColor, notesCount: notes.length,
      focusByDay, totalFocusMinWeek, todayFocusMin,
    };
  }, [tasks, notes, plans, sessions]);

  const intensityClass = (c: number) => {
    if (c === 0) return "bg-muted/40 border border-border/50";
    if (c <= 1) return "bg-primary/25";
    if (c <= 3) return "bg-primary/55";
    return "bg-primary";
  };

  const heatmapTotal = stats.heatmap.reduce((a, b) => a + b.count, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6"
    >
      {/* Header + AI Score */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <Activity className="w-5 h-5 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Study Analytics</h1>
            <p className="text-sm text-muted-foreground">Your productivity, visualized.</p>
          </div>
        </div>
        <Card className="px-5 py-3 flex items-center gap-4">
          <Sparkles className="w-5 h-5 text-primary" />
          <div className="text-right">
            <div className={`text-3xl font-bold leading-none ${stats.scoreColor}`}>{stats.score}</div>
            <div className="text-xs text-muted-foreground mt-1">AI Score · {stats.label}</div>
          </div>
        </Card>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={CheckCircle2} label="Tasks Completed" value={stats.completedCount} sub={`of ${stats.total} total`} />
        <StatCard icon={TrendingUp} label="Completion Rate" value={`${Math.round(stats.completionRate)}%`} />
        <StatCard icon={Flame} label="Day Streak" value={stats.streak} sub="consecutive days" />
        <StatCard
          icon={Clock}
          label="Focus Today"
          value={`${Math.floor(stats.todayFocusMin / 60)}h ${stats.todayFocusMin % 60}m`}
          sub={`${(stats.totalFocusMinWeek / 60).toFixed(1)}h this week`}
        />
        <StatCard icon={AlertTriangle} label="Overdue" value={stats.overdue} destructive={stats.overdue > 0} />
      </div>

      {/* Focus time per day chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Focus Time · Last 7 Days</span>
            <span className="text-xs font-normal text-muted-foreground">
              Total: {(stats.totalFocusMinWeek / 60).toFixed(1)}h
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.focusByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} unit="m" />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                formatter={(v: any) => [`${v} min (${(Number(v) / 60).toFixed(2)}h)`, "Focus"]}
              />
              <Bar dataKey="Minutes" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Last 7 Days</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stats.weekly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Completed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Created" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Last 30 Days</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={stats.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Cumulative" stroke="hsl(152, 60%, 42%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Daily" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Radar / Pie / Quick stats */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Performance Radar</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={stats.radar}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Priority Split</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={stats.priority} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={{ fontSize: 11 }}>
                  {stats.priority.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Quick Stats</CardTitle></CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <QuickRow icon={Trophy} label="Best streak" value={`${stats.best} days`} />
            <QuickRow icon={Clock} label="Peak hour" value={stats.peakHourLabel} />
            <QuickRow icon={BookOpen} label="Notes written" value={stats.notesCount} />
            <QuickRow icon={Target} label="Active plans" value={stats.activePlans.length} />
            <QuickRow icon={TrendingUp} label="Avg tasks/day (7d)" value={stats.avgPerDay} />
            <QuickRow icon={AlertTriangle} label="Overdue" value={stats.overdue} />
          </CardContent>
        </Card>
      </div>

      {/* Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Activity Heatmap · Last 28 Days</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Each square is a day — darker means more tasks completed. Hover to see the date and count.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1.5">
            {stats.heatmap.map((cell, i) => (
              <div
                key={i}
                title={`${format(cell.date, "MMM d")} · ${cell.count} completed`}
                className={`aspect-square rounded-md ${intensityClass(cell.count)} ${cell.isToday ? "ring-2 ring-primary" : ""}`}
              />
            ))}
          </div>
          {heatmapTotal === 0 ? (
            <p className="text-[11px] text-muted-foreground mt-3 italic">
              No completed tasks in the last 28 days yet — finish a task to light up your first square 🟩
            </p>
          ) : (
            <div className="flex items-center gap-2 mt-3 text-[11px] text-muted-foreground">
              <span>Less</span>
              <div className="w-3 h-3 rounded-sm bg-muted/40 border border-border/50" />
              <div className="w-3 h-3 rounded-sm bg-primary/25" />
              <div className="w-3 h-3 rounded-sm bg-primary/55" />
              <div className="w-3 h-3 rounded-sm bg-primary" />
              <span>More · {heatmapTotal} completed in 28 days</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Study Insights — purpose explained */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Study Insights
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            AI-generated observations about your study patterns — strengths to keep, weak spots to fix, and
            personalized next steps. Click any insight to ask SOFI for a deeper plan.
          </p>
        </CardHeader>
        <CardContent>
          <AdaptiveInsights onAskSofi={(prompt) => navigate("/assistant", { state: { prompt } })} />
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StatCard({ icon: Icon, label, value, sub, destructive }: any) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Icon className={`w-4 h-4 ${destructive ? "text-destructive" : "text-muted-foreground"}`} />
        </div>
        <div className={`text-2xl font-bold ${destructive ? "text-destructive" : "text-foreground"}`}>{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function QuickRow({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
      </div>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

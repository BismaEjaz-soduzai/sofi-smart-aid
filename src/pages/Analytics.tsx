import { useState } from "react";
import { motion } from "framer-motion";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, Clock, Target, Brain, Trophy,
  Plus, BarChart3, PieChart as PieChartIcon, Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  usePerformanceMetrics, useAddPerformanceMetric,
  useStudySessions, useUserGoals, useAddUserGoal, useUpdateGoalProgress,
} from "@/hooks/useAnalytics";
import { useTasks } from "@/hooks/useTasks";

const COLORS = [
  "hsl(174, 62%, 40%)", "hsl(38, 92%, 50%)", "hsl(262, 60%, 55%)",
  "hsl(0, 72%, 55%)", "hsl(152, 60%, 42%)", "hsl(210, 70%, 55%)",
];

export default function Analytics() {
  const { data: metrics = [] } = usePerformanceMetrics();
  const { data: sessions = [] } = useStudySessions();
  const { data: goals = [] } = useUserGoals();
  const { data: tasks = [] } = useTasks();
  const addMetric = useAddPerformanceMetric();
  const addGoal = useAddUserGoal();
  const updateGoal = useUpdateGoalProgress();

  const [metricForm, setMetricForm] = useState({ subject: "", score: "", total_marks: "" });
  const [goalForm, setGoalForm] = useState({ goal_title: "", target_value: "100", deadline: "" });

  // Derived stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const totalStudyMinutes = sessions.reduce((sum, s) => sum + (s.session_duration || 0), 0);
  const totalStudyHours = (totalStudyMinutes / 60).toFixed(1);

  const avgAccuracy = metrics.length > 0
    ? Math.round(metrics.reduce((sum, m) => sum + Number(m.accuracy || 0), 0) / metrics.length)
    : 0;

  // Subject-wise scores for bar chart
  const subjectScores = Object.entries(
    metrics.reduce<Record<string, { total: number; count: number }>>((acc, m) => {
      acc[m.subject] = acc[m.subject] || { total: 0, count: 0 };
      acc[m.subject].total += Number(m.accuracy || 0);
      acc[m.subject].count += 1;
      return acc;
    }, {})
  ).map(([subject, { total, count }]) => ({ subject, accuracy: Math.round(total / count) }));

  // Progress over time (last 7 entries)
  const progressOverTime = metrics.slice(0, 14).reverse().map((m) => ({
    date: new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    accuracy: Number(m.accuracy || 0),
    subject: m.subject,
  }));

  // Time distribution by subject
  const timeDistribution = Object.entries(
    sessions.reduce<Record<string, number>>((acc, s) => {
      acc[s.subject] = (acc[s.subject] || 0) + (s.session_duration || 0);
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  // Weak areas
  const weakAreas = subjectScores
    .filter((s) => s.accuracy < 70)
    .sort((a, b) => a.accuracy - b.accuracy);

  const handleAddMetric = () => {
    if (!metricForm.subject || !metricForm.score || !metricForm.total_marks) return;
    addMetric.mutate(
      { subject: metricForm.subject, score: Number(metricForm.score), total_marks: Number(metricForm.total_marks) },
      { onSuccess: () => { setMetricForm({ subject: "", score: "", total_marks: "" }); toast.success("Score added!"); } }
    );
  };

  const handleAddGoal = () => {
    if (!goalForm.goal_title) return;
    addGoal.mutate(
      { goal_title: goalForm.goal_title, target_value: Number(goalForm.target_value), deadline: goalForm.deadline || undefined },
      { onSuccess: () => { setGoalForm({ goal_title: "", target_value: "100", deadline: "" }); toast.success("Goal created!"); } }
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">Track your study performance and progress</p>
        </div>
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-1" /> Add Score</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Performance Score</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <Input placeholder="Subject" value={metricForm.subject} onChange={(e) => setMetricForm((p) => ({ ...p, subject: e.target.value }))} />
                <div className="flex gap-2">
                  <Input placeholder="Score" type="number" value={metricForm.score} onChange={(e) => setMetricForm((p) => ({ ...p, score: e.target.value }))} />
                  <Input placeholder="Total Marks" type="number" value={metricForm.total_marks} onChange={(e) => setMetricForm((p) => ({ ...p, total_marks: e.target.value }))} />
                </div>
                <Button onClick={handleAddMetric} className="w-full" disabled={addMetric.isPending}>Save Score</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm"><Target className="w-4 h-4 mr-1" /> New Goal</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Goal</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <Input placeholder="Goal title" value={goalForm.goal_title} onChange={(e) => setGoalForm((p) => ({ ...p, goal_title: e.target.value }))} />
                <Input placeholder="Target value" type="number" value={goalForm.target_value} onChange={(e) => setGoalForm((p) => ({ ...p, target_value: e.target.value }))} />
                <Input placeholder="Deadline" type="date" value={goalForm.deadline} onChange={(e) => setGoalForm((p) => ({ ...p, deadline: e.target.value }))} />
                <Button onClick={handleAddGoal} className="w-full" disabled={addGoal.isPending}>Create Goal</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Trophy} label="Completion Rate" value={`${completionRate}%`} sub={`${completedTasks}/${totalTasks} tasks`} color="text-primary" />
        <StatCard icon={Clock} label="Study Time" value={`${totalStudyHours}h`} sub={`${sessions.length} sessions`} color="text-warning" />
        <StatCard icon={Brain} label="Avg Accuracy" value={`${avgAccuracy}%`} sub={`${metrics.length} tests`} color="text-accent-foreground" />
        <StatCard icon={Target} label="Active Goals" value={String(goals.length)} sub={`${goals.filter((g) => Number(g.current_progress) >= Number(g.target_value)).length} completed`} color="text-success" />
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Progress over time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><Activity className="w-4 h-4" /> Progress Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {progressOverTime.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={progressOverTime}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="accuracy" stroke="hsl(174, 62%, 40%)" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyChart label="Add scores to see progress trends" />}
          </CardContent>
        </Card>

        {/* Subject-wise scores */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Subject-Wise Accuracy</CardTitle>
          </CardHeader>
          <CardContent>
            {subjectScores.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={subjectScores}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="subject" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="accuracy" radius={[6, 6, 0, 0]}>
                    {subjectScores.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart label="Add scores to see subject breakdown" />}
          </CardContent>
        </Card>

        {/* Time distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><PieChartIcon className="w-4 h-4" /> Time Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {timeDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={timeDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}m`}>
                    {timeDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyChart label="Complete focus sessions to see distribution" />}
          </CardContent>
        </Card>

        {/* Weak areas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><TrendingDown className="w-4 h-4 text-destructive" /> Areas to Improve</CardTitle>
          </CardHeader>
          <CardContent>
            {weakAreas.length > 0 ? (
              <div className="space-y-3">
                {weakAreas.map((area) => (
                  <div key={area.subject} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{area.subject}</span>
                    <div className="flex items-center gap-2">
                      <Progress value={area.accuracy} className="w-24 h-2" />
                      <span className="text-xs text-muted-foreground w-10 text-right">{area.accuracy}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {metrics.length === 0 ? "Add scores to identify weak areas" : "🎉 All subjects above 70%!"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Goals */}
      {goals.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><Target className="w-4 h-4" /> Your Goals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {goals.map((goal) => {
                const pct = Math.min(100, Math.round((Number(goal.current_progress) / Number(goal.target_value)) * 100));
                return (
                  <div key={goal.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{goal.goal_title}</span>
                      <div className="flex items-center gap-2">
                        {goal.deadline && <span className="text-xs text-muted-foreground">Due: {new Date(goal.deadline).toLocaleDateString()}</span>}
                        <span className="text-xs font-semibold">{pct}%</span>
                      </div>
                    </div>
                    <Progress value={pct} className="h-2" />
                    <div className="flex gap-1">
                      {[25, 50, 75, 100].map((val) => (
                        <Button key={val} variant="ghost" size="sm" className="h-6 text-[10px] px-2"
                          onClick={() => updateGoal.mutate({ id: goal.id, current_progress: (Number(goal.target_value) * val) / 100 })}>
                          {val}%
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string; sub: string; color: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-muted flex items-center justify-center ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-bold">{value}</p>
              <p className="text-[10px] text-muted-foreground">{sub}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return <div className="flex items-center justify-center h-[250px] text-sm text-muted-foreground">{label}</div>;
}

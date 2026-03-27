import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Brain,
  CheckCircle2,
  Calendar,
  StickyNote,
  Bell,
  Upload,
  MessageCircle,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Lightbulb,
  Target,
} from "lucide-react";

const screens = [
  {
    title: "Meet SOFI",
    subtitle:
      "Your AI voice assistant for study, planning, productivity, and smart organization.",
    icons: [
      { Icon: Sparkles, x: "10%", y: "15%", size: 28, delay: 0.2 },
      { Icon: Brain, x: "75%", y: "10%", size: 24, delay: 0.4 },
      { Icon: Target, x: "85%", y: "65%", size: 20, delay: 0.6 },
      { Icon: Lightbulb, x: "5%", y: "70%", size: 22, delay: 0.5 },
    ],
    hero: Sparkles,
    gradient: "from-primary/20 via-primary/5 to-transparent",
  },
  {
    title: "Stay Organized Effortlessly",
    subtitle:
      "Manage tasks, reminders, notes, schedules, and deadlines all in one place.",
    icons: [
      { Icon: CheckCircle2, x: "8%", y: "20%", size: 22, delay: 0.2 },
      { Icon: Calendar, x: "80%", y: "12%", size: 24, delay: 0.35 },
      { Icon: StickyNote, x: "82%", y: "68%", size: 20, delay: 0.5 },
      { Icon: Bell, x: "12%", y: "72%", size: 22, delay: 0.45 },
    ],
    hero: CheckCircle2,
    gradient: "from-success/20 via-success/5 to-transparent",
  },
  {
    title: "Learn Smarter with AI",
    subtitle:
      "Upload study material, ask questions, get summaries, and plan your learning with SOFI.",
    icons: [
      { Icon: Upload, x: "10%", y: "18%", size: 22, delay: 0.2 },
      { Icon: BookOpen, x: "78%", y: "14%", size: 24, delay: 0.4 },
      { Icon: MessageCircle, x: "84%", y: "70%", size: 20, delay: 0.55 },
      { Icon: Lightbulb, x: "8%", y: "68%", size: 22, delay: 0.35 },
    ],
    hero: Brain,
    gradient: "from-info/20 via-info/5 to-transparent",
  },
];

export default function Onboarding() {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const navigate = useNavigate();
  const screen = screens[current];
  const isLast = current === screens.length - 1;

  const go = (next: number) => {
    setDirection(next > current ? 1 : -1);
    setCurrent(next);
  };

  const variants = {
    enter: (d: number) => ({ x: d * 60, opacity: 0, scale: 0.97 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (d: number) => ({ x: d * -60, opacity: 0, scale: 0.97 }),
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Skip */}
      <button
        onClick={() => navigate("/login")}
        className="absolute top-6 right-6 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium tracking-wide z-10"
      >
        Skip
      </button>

      {/* Card */}
      <div className="w-full max-w-md flex flex-col items-center">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full"
          >
            <div className="glass-card p-8 space-y-8 relative overflow-hidden">
              {/* Background gradient blob */}
              <div
                className={`absolute -top-20 -right-20 w-60 h-60 rounded-full bg-gradient-to-br ${screen.gradient} blur-3xl pointer-events-none`}
              />

              {/* Floating icons */}
              <div className="relative h-48 w-full">
                {/* Center hero icon */}
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                    <screen.hero className="w-10 h-10 text-primary" />
                  </div>
                </motion.div>

                {/* Orbiting icons */}
                {screen.icons.map(({ Icon, x, y, size, delay }, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 0.6 }}
                    transition={{ delay, type: "spring", stiffness: 180 }}
                    className="absolute"
                    style={{ left: x, top: y }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-card border border-border/60 flex items-center justify-center shadow-sm">
                      <Icon
                        className="text-muted-foreground"
                        size={size}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Text */}
              <div className="text-center space-y-3 relative z-10">
                <h2 className="text-2xl font-semibold text-foreground tracking-tight">
                  {screen.title}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  {screen.subtitle}
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Dots */}
        <div className="flex items-center gap-2 mt-8">
          {screens.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              className="p-0.5"
            >
              <div
                className={`rounded-full transition-all duration-300 ${
                  i === current
                    ? "w-6 h-2 bg-primary"
                    : "w-2 h-2 bg-muted-foreground/25 hover:bg-muted-foreground/40"
                }`}
              />
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3 mt-8 w-full">
          {current > 0 && (
            <motion.button
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => go(current - 1)}
              className="px-5 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </motion.button>
          )}

          <button
            onClick={() =>
              isLast ? navigate("/login") : go(current + 1)
            }
            className="flex-1 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            {isLast ? "Get Started" : "Next"}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

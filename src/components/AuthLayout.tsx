import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[42%] bg-primary relative overflow-hidden flex-col justify-between p-10">
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-primary-foreground/5 blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-primary-foreground/5 blur-3xl translate-y-1/3 -translate-x-1/4" />

        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-foreground/15 flex items-center justify-center backdrop-blur-sm">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-primary-foreground tracking-tight">
              SOFI
            </span>
          </Link>
        </div>

        <div className="relative z-10 space-y-5">
          <h2 className="text-3xl xl:text-4xl font-semibold text-primary-foreground leading-tight tracking-tight">
            Your AI Study &<br />Productivity Assistant
          </h2>
          <p className="text-primary-foreground/70 text-sm leading-relaxed max-w-sm">
            Manage tasks, plan your schedule, take notes, track assignments, and chat with an AI companion — all in one place.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 pt-2">
            {["Tasks", "Notes", "Planner", "AI Chat", "Focus Mode"].map((f) => (
              <span
                key={f}
                className="px-3 py-1 rounded-full bg-primary-foreground/10 text-primary-foreground/80 text-xs font-medium backdrop-blur-sm"
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-primary-foreground/40 text-xs">
          © {new Date().getFullYear()} SOFI. All rights reserved.
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[400px]">{children}</div>
      </div>
    </div>
  );
}

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface PageShellProps {
  title: string;
  description: string;
  icon: LucideIcon;
  children?: React.ReactNode;
}

export default function PageShell({ title, description, icon: Icon, children }: PageShellProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
          <Icon className="w-5 h-5 text-accent-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children || (
        <div className="glass-card p-12 text-center space-y-3">
          <Icon className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground text-sm">This module is coming soon.</p>
        </div>
      )}
    </motion.div>
  );
}

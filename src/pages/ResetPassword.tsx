import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Lock, Sparkles, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AuthLayout from "@/components/AuthLayout";
import { Field } from "@/pages/Login";
import PasswordStrengthMeter from "@/components/PasswordStrengthMeter";
import { toast } from "sonner";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [recovered, setRecovered] = useState(false);

  const isRecoveryLink = useMemo(() => {
    const hash = window.location.hash || "";
    return hash.includes("type=recovery") || hash.includes("access_token=");
  }, []);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;

      if (data.session) {
        setRecovered(true);
        setReady(true);
        return;
      }

      if (!isRecoveryLink) {
        setReady(true);
        return;
      }

      const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        if (!active) return;
        if (event === "PASSWORD_RECOVERY" || session) {
          setRecovered(true);
          setReady(true);
        }
      });

      setTimeout(() => {
        if (!active) return;
        setReady(true);
      }, 1200);

      return () => authListener.subscription.unsubscribe();
    };

    const cleanupPromise = bootstrap();

    return () => {
      active = false;
      cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, [isRecoveryLink]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!password) e.password = "Password is required";
    else if (password.length < 8) e.password = "Must be at least 8 characters";
    if (password !== confirm) e.confirm = "Passwords don't match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password updated successfully! Please sign in.");
      await supabase.auth.signOut();
      navigate("/login");
    }
  };

  return (
    <AuthLayout>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="space-y-8"
      >
        <div className="lg:hidden flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-base font-semibold text-foreground tracking-tight">SOFI</span>
        </div>

        {!ready ? (
          <div className="py-10 flex flex-col items-center gap-3 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Preparing secure password reset…</p>
          </div>
        ) : !recovered ? (
          <div className="space-y-4 text-center py-4">
            <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-accent-foreground" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-foreground tracking-tight">Reset link required</h1>
              <p className="text-sm text-muted-foreground">Open the password reset link from your email, then set your new password here.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/forgot-password")}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Request Reset Email
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-foreground tracking-tight">Set new password</h1>
              <p className="text-sm text-muted-foreground">Enter your new password below.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Field label="New Password" type="password" value={password} onChange={setPassword} placeholder="Min. 8 characters" error={errors.password} icon={<Lock className="w-4 h-4" />} />
                <PasswordStrengthMeter password={password} />
              </div>
              <Field label="Confirm Password" type="password" value={confirm} onChange={setConfirm} placeholder="Re-enter password" error={errors.confirm} icon={<Lock className="w-4 h-4" />} />

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Update Password <ArrowRight className="w-3.5 h-3.5" /></>}
              </button>
            </form>
          </>
        )}
      </motion.div>
    </AuthLayout>
  );
}

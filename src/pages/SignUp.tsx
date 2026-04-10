import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, User, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { lovable } from "@/integrations/lovable/index";
import AuthLayout from "@/components/AuthLayout";
import { Field, SocialButton, GoogleIcon } from "@/pages/Login";
import { toast } from "sonner";

export default function SignUp() {
  const navigate = useNavigate();
  const { signUpWithEmail } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const set = (key: string) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Full name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email";
    if (!form.password) e.password = "Password is required";
    else if (form.password.length < 8) e.password = "Must be at least 8 characters";
    if (form.password !== form.confirm) e.confirm = "Passwords don't match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    const { error } = await signUpWithEmail(form.email, form.password, form.name);
    setLoading(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success("Check your email to confirm your account!");
      navigate("/login");
    }
  };

  return (
    <AuthLayout>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="space-y-7"
      >
        <div className="lg:hidden flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-base font-semibold text-foreground tracking-tight">SOFI</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Create your account</h1>
          <p className="text-sm text-muted-foreground">Start your productivity journey with SOFI</p>
        </div>

        <div className="space-y-2.5">
          <SocialButton icon={<GoogleIcon />} label="Continue with Google" onClick={async () => {
            const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
            if (result.error) { toast.error("Google sign-in failed"); return; }
            if (result.redirected) return;
            navigate("/dashboard");
          }} />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or continue with email</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <Field label="Full Name" type="text" value={form.name} onChange={set("name")} placeholder="Your name" error={errors.name} icon={<User className="w-4 h-4" />} />
          <Field label="Email" type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" error={errors.email} icon={<Mail className="w-4 h-4" />} />
          <Field
            label="Password"
            type={showPw ? "text" : "password"}
            value={form.password}
            onChange={set("password")}
            placeholder="Min. 8 characters"
            error={errors.password}
            icon={<Lock className="w-4 h-4" />}
            trailing={
              <button type="button" onClick={() => setShowPw(!showPw)} className="text-muted-foreground hover:text-foreground transition-colors">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />
          <Field
            label="Confirm Password"
            type={showConfirm ? "text" : "password"}
            value={form.confirm}
            onChange={set("confirm")}
            placeholder="Re-enter password"
            error={errors.confirm}
            icon={<Lock className="w-4 h-4" />}
            trailing={
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="text-muted-foreground hover:text-foreground transition-colors">
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 mt-1"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create Account <ArrowRight className="w-3.5 h-3.5" /></>}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Log in
          </Link>
        </p>
      </motion.div>
    </AuthLayout>
  );
}

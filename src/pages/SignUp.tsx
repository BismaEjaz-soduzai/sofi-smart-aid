import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, User, Sparkles, ArrowRight } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { Field, SocialButton, GoogleIcon, AppleIcon } from "@/pages/Login";

export default function SignUp() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) navigate("/dashboard");
  };

  return (
    <AuthLayout>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="space-y-7"
      >
        {/* Mobile logo */}
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
          <SocialButton icon={<GoogleIcon />} label="Continue with Google" />
          <SocialButton icon={<AppleIcon />} label="Continue with Apple" />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
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
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity mt-1"
          >
            Create Account
            <ArrowRight className="w-3.5 h-3.5" />
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

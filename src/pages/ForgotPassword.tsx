import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, Sparkles, Send, CheckCircle2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { Field } from "@/pages/Login";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError("Email is required"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Enter a valid email"); return; }
    setError("");
    setSent(true);
  };

  return (
    <AuthLayout>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="space-y-8"
      >
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-base font-semibold text-foreground tracking-tight">SOFI</span>
        </div>

        <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to login
        </Link>

        {!sent ? (
          <>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-foreground tracking-tight">Reset password</h1>
              <p className="text-sm text-muted-foreground">
                Enter the email associated with your account and we'll send you a reset link.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <Field
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                error={error}
                icon={<Mail className="w-4 h-4" />}
              />

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Send Reset Link
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-4 py-6"
          >
            <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-accent-foreground" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">Check your email</h2>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                We've sent a password reset link to <span className="font-medium text-foreground">{email}</span>
              </p>
            </div>
            <button
              onClick={() => setSent(false)}
              className="text-sm text-primary font-medium hover:underline"
            >
              Didn't receive it? Try again
            </button>
          </motion.div>
        )}
      </motion.div>
    </AuthLayout>
  );
}

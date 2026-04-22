import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, user, loading, signOut } = useAuth();
  const emailUnconfirmed =
    !!user && user.app_metadata?.provider === "email" && !user.email_confirmed_at;

  useEffect(() => {
    if (emailUnconfirmed) {
      toast.warning("Please verify your email before accessing SOFI.");
      void signOut();
    }
  }, [emailUnconfirmed, signOut]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  if (emailUnconfirmed) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

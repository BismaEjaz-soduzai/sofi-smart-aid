import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { FocusTimerProvider } from "@/contexts/FocusTimerContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import { DeadlineNotifier } from "@/components/DeadlineNotifier";
import { NoteReminderNotifier } from "@/components/NoteReminderNotifier";
import { ReminderScheduler } from "@/components/ReminderScheduler";
import FloatingFocusTimer from "@/components/FloatingFocusTimer";
import Onboarding from "@/pages/Onboarding";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import SignUp from "@/pages/SignUp";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import Organizer from "@/pages/Organizer";
import Planner from "@/pages/Planner";
import SmartWorkspace from "@/pages/SmartWorkspace";
import SofiAssistant from "@/pages/SofiAssistant";
import SettingsPage from "@/pages/SettingsPage";
import ProfilePage from "@/pages/ProfilePage";
import ChatRooms from "@/pages/ChatRooms";
import StudyAnalytics from "@/pages/StudyAnalytics";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <FocusTimerProvider>
            <Routes>
              <Route path="/" element={<Onboarding />} />
              <Route path="/welcome" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route element={<ProtectedRoute><><ReminderScheduler /><AppLayout /></></ProtectedRoute>}>
                <Route path="/dashboard" element={<><DeadlineNotifier /><NoteReminderNotifier /><Dashboard /></>} />
                <Route path="/organizer" element={<Organizer />} />
                <Route path="/tasks" element={<Navigate to="/organizer" replace />} />
                <Route path="/notes" element={<Navigate to="/organizer" replace />} />
                <Route path="/planner" element={<Planner />} />
                <Route path="/workspace" element={<SmartWorkspace />} />
                <Route path="/assistant" element={<SofiAssistant />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/chat" element={<ChatRooms />} />
                <Route path="/analytics" element={<StudyAnalytics />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
            <FloatingFocusTimer />
          </FocusTimerProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;


-- Plans table
CREATE TABLE public.plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  goal TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'study',
  emoji TEXT DEFAULT '📘',
  color_tag TEXT DEFAULT 'blue',
  start_date DATE,
  end_date DATE,
  duration TEXT DEFAULT '',
  description TEXT DEFAULT '',
  progress INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  source_type TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Plan sessions table
CREATE TABLE public.plan_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date DATE,
  start_time TIME,
  end_time TIME,
  note TEXT DEFAULT '',
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_sessions ENABLE ROW LEVEL SECURITY;

-- Plans RLS policies
CREATE POLICY "Users can view their own plans" ON public.plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own plans" ON public.plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own plans" ON public.plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own plans" ON public.plans FOR DELETE USING (auth.uid() = user_id);

-- Plan sessions RLS - users can manage sessions of their own plans
CREATE POLICY "Users can view sessions of their plans" ON public.plan_sessions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.plans WHERE plans.id = plan_sessions.plan_id AND plans.user_id = auth.uid())
);
CREATE POLICY "Users can create sessions for their plans" ON public.plan_sessions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.plans WHERE plans.id = plan_sessions.plan_id AND plans.user_id = auth.uid())
);
CREATE POLICY "Users can update sessions of their plans" ON public.plan_sessions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.plans WHERE plans.id = plan_sessions.plan_id AND plans.user_id = auth.uid())
);
CREATE POLICY "Users can delete sessions of their plans" ON public.plan_sessions FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.plans WHERE plans.id = plan_sessions.plan_id AND plans.user_id = auth.uid())
);

-- Updated_at trigger for plans
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

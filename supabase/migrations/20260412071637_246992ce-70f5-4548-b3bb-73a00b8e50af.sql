
-- Create workspace_rooms table for subject folders
CREATE TABLE public.workspace_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '📁',
  color TEXT NOT NULL DEFAULT 'blue',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.workspace_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rooms" ON public.workspace_rooms FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own rooms" ON public.workspace_rooms FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own rooms" ON public.workspace_rooms FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own rooms" ON public.workspace_rooms FOR DELETE USING (auth.uid() = user_id);

-- Add room_id to study_files (nullable, null = unorganized)
ALTER TABLE public.study_files ADD COLUMN room_id UUID REFERENCES public.workspace_rooms(id) ON DELETE SET NULL;

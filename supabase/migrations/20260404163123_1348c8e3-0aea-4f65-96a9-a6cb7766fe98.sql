
-- Create message reactions table
CREATE TABLE public.message_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Enable RLS
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Members can view reactions in their rooms
CREATE POLICY "Members can view reactions"
  ON public.message_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_messages cm
      JOIN public.chat_members mem ON mem.room_id = cm.room_id
      WHERE cm.id = message_reactions.message_id
      AND mem.user_id = auth.uid()
    )
  );

-- Users can add reactions
CREATE POLICY "Users can add reactions"
  ON public.message_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can remove their own reactions
CREATE POLICY "Users can remove their reactions"
  ON public.message_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- Enable realtime for reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;

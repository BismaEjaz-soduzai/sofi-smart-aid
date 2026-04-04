
-- Add edited_at column to track message edits
ALTER TABLE public.chat_messages ADD COLUMN edited_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

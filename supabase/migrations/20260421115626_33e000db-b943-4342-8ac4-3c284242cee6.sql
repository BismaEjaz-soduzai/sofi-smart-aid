ALTER TABLE public.notes
ADD COLUMN IF NOT EXISTS reminder_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_notes_reminder_at ON public.notes(reminder_at) WHERE reminder_at IS NOT NULL;
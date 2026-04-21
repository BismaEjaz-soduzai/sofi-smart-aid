-- Pinboard links table for workspace rooms
CREATE TABLE IF NOT EXISTS public.room_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.workspace_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_room_links_room_id ON public.room_links(room_id);

ALTER TABLE public.room_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Room members can view links"
ON public.room_links
FOR SELECT
TO authenticated
USING (public.is_workspace_room_member(room_id, auth.uid()));

CREATE POLICY "Room members can add links"
ON public.room_links
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.is_workspace_room_member(room_id, auth.uid())
);

CREATE POLICY "Authors can delete their links"
ON public.room_links
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authors can update their links"
ON public.room_links
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

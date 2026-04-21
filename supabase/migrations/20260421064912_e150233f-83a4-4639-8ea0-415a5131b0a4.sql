CREATE TABLE IF NOT EXISTS public.workspace_room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.workspace_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);

ALTER TABLE public.workspace_room_members ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.workspace_rooms
ADD COLUMN IF NOT EXISTS invite_code TEXT;

UPDATE public.workspace_rooms
SET invite_code = UPPER(substr(md5(random()::text), 1, 8))
WHERE invite_code IS NULL OR btrim(invite_code) = '';

ALTER TABLE public.workspace_rooms
ALTER COLUMN invite_code SET DEFAULT UPPER(substr(md5(random()::text), 1, 8));

CREATE UNIQUE INDEX IF NOT EXISTS workspace_rooms_invite_code_key
ON public.workspace_rooms(invite_code);

CREATE OR REPLACE FUNCTION public.is_workspace_room_member(_room_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_rooms wr
    LEFT JOIN public.workspace_room_members wrm ON wrm.room_id = wr.id
    WHERE wr.id = _room_id
      AND (
        wr.user_id = _user_id
        OR wrm.user_id = _user_id
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.join_workspace_room_by_code(_invite_code TEXT)
RETURNS public.workspace_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_room public.workspace_rooms;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF _invite_code IS NULL OR btrim(_invite_code) = '' THEN
    RAISE EXCEPTION 'Invite code is required';
  END IF;

  SELECT *
  INTO target_room
  FROM public.workspace_rooms
  WHERE invite_code = UPPER(REPLACE(btrim(_invite_code), '-', ''))
  LIMIT 1;

  IF target_room.id IS NULL THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  INSERT INTO public.workspace_room_members (room_id, user_id)
  VALUES (target_room.id, auth.uid())
  ON CONFLICT (room_id, user_id) DO NOTHING;

  RETURN target_room;
END;
$$;

DROP POLICY IF EXISTS "Users can view their own rooms" ON public.workspace_rooms;
DROP POLICY IF EXISTS "Users can update their own rooms" ON public.workspace_rooms;
DROP POLICY IF EXISTS "Users can delete their own rooms" ON public.workspace_rooms;
DROP POLICY IF EXISTS "Users can create their own rooms" ON public.workspace_rooms;

CREATE POLICY "Workspace room owners and members can view rooms"
ON public.workspace_rooms
FOR SELECT
TO authenticated
USING (public.is_workspace_room_member(id, auth.uid()));

CREATE POLICY "Users can create their own workspace rooms"
ON public.workspace_rooms
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Workspace room owners can update rooms"
ON public.workspace_rooms
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Workspace room owners can delete rooms"
ON public.workspace_rooms
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert" ON public.room_messages;
DROP POLICY IF EXISTS "view" ON public.room_messages;
DROP POLICY IF EXISTS "delete" ON public.room_messages;

CREATE POLICY "Workspace room members can view messages"
ON public.room_messages
FOR SELECT
TO authenticated
USING (public.is_workspace_room_member(room_id, auth.uid()));

CREATE POLICY "Workspace room members can send messages"
ON public.room_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.is_workspace_room_member(room_id, auth.uid())
);

CREATE POLICY "Users can delete their own workspace messages"
ON public.room_messages
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own files" ON public.study_files;
DROP POLICY IF EXISTS "Users can insert their own files" ON public.study_files;
DROP POLICY IF EXISTS "Users can update their own files" ON public.study_files;
DROP POLICY IF EXISTS "Users can delete their own files" ON public.study_files;

CREATE POLICY "Users can view own or shared room files"
ON public.study_files
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR (
    room_id IS NOT NULL
    AND public.is_workspace_room_member(room_id, auth.uid())
  )
);

CREATE POLICY "Users can upload their own files"
ON public.study_files
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    room_id IS NULL
    OR public.is_workspace_room_member(room_id, auth.uid())
  )
);

CREATE POLICY "Users can update their own files"
ON public.study_files
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (
    room_id IS NULL
    OR public.is_workspace_room_member(room_id, auth.uid())
  )
);

CREATE POLICY "Users can delete their own files"
ON public.study_files
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can view joined workspace memberships"
ON public.workspace_room_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_workspace_room_member(room_id, auth.uid()));

CREATE POLICY "Users can join workspace rooms"
ON public.workspace_room_members
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_workspace_room_member(room_id, auth.uid()));

CREATE POLICY "Users can leave their own workspace memberships"
ON public.workspace_room_members
FOR DELETE
TO authenticated
USING (user_id = auth.uid());
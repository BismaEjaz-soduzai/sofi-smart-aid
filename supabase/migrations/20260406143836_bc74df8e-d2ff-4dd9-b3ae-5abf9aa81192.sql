DROP POLICY IF EXISTS "Members can view rooms" ON public.chat_rooms;
CREATE POLICY "Members or creators can view rooms"
ON public.chat_rooms
FOR SELECT
TO authenticated
USING (
  auth.uid() = created_by
  OR EXISTS (
    SELECT 1
    FROM public.chat_members
    WHERE chat_members.room_id = chat_rooms.id
      AND chat_members.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Members can update read_by" ON public.chat_messages;
CREATE POLICY "Members can mark messages as read"
ON public.chat_messages
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.chat_members
    WHERE chat_members.room_id = chat_messages.room_id
      AND chat_members.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.chat_members
    WHERE chat_members.room_id = chat_messages.room_id
      AND chat_members.user_id = auth.uid()
  )
);

CREATE POLICY "Users can edit their own messages"
ON public.chat_messages
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.mark_message_read(_message_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _user_id IS NULL OR _user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.chat_messages cm
    JOIN public.chat_members mem ON mem.room_id = cm.room_id
    WHERE cm.id = _message_id
      AND mem.user_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Not a room member';
  END IF;

  UPDATE public.chat_messages
  SET read_by = array_append(read_by, _user_id)
  WHERE id = _message_id
    AND NOT (_user_id = ANY(read_by));
END;
$function$;
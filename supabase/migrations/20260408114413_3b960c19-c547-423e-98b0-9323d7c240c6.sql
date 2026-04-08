CREATE OR REPLACE FUNCTION public.is_chat_room_member(_room_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_members
    WHERE room_id = _room_id
      AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_chat_message(_message_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_messages cm
    JOIN public.chat_members mem ON mem.room_id = cm.room_id
    WHERE cm.id = _message_id
      AND mem.user_id = _user_id
  );
$$;

DROP POLICY IF EXISTS "Members can view members" ON public.chat_members;
CREATE POLICY "Members can view members"
ON public.chat_members
FOR SELECT
TO authenticated
USING (public.is_chat_room_member(room_id, auth.uid()));

DROP POLICY IF EXISTS "Members or creators can view rooms" ON public.chat_rooms;
CREATE POLICY "Members or creators can view rooms"
ON public.chat_rooms
FOR SELECT
TO authenticated
USING (
  auth.uid() = created_by
  OR public.is_chat_room_member(id, auth.uid())
);

DROP POLICY IF EXISTS "Members can view messages" ON public.chat_messages;
CREATE POLICY "Members can view messages"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (public.is_chat_room_member(room_id, auth.uid()));

DROP POLICY IF EXISTS "Members can send messages" ON public.chat_messages;
CREATE POLICY "Members can send messages"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.is_chat_room_member(room_id, auth.uid())
);

DROP POLICY IF EXISTS "Members can mark messages as read" ON public.chat_messages;
CREATE POLICY "Members can mark messages as read"
ON public.chat_messages
FOR UPDATE
TO authenticated
USING (public.is_chat_room_member(room_id, auth.uid()))
WITH CHECK (public.is_chat_room_member(room_id, auth.uid()));

DROP POLICY IF EXISTS "Members can view reactions" ON public.message_reactions;
CREATE POLICY "Members can view reactions"
ON public.message_reactions
FOR SELECT
TO authenticated
USING (public.can_access_chat_message(message_id, auth.uid()));

DROP POLICY IF EXISTS "Users can add reactions" ON public.message_reactions;
CREATE POLICY "Users can add reactions"
ON public.message_reactions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.can_access_chat_message(message_id, auth.uid())
);
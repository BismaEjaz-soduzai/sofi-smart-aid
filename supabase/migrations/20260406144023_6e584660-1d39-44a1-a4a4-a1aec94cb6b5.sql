CREATE OR REPLACE FUNCTION public.create_chat_room(_name text, _display_name text DEFAULT NULL)
RETURNS public.chat_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_room public.chat_rooms;
  safe_display_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF _name IS NULL OR btrim(_name) = '' THEN
    RAISE EXCEPTION 'Room name is required';
  END IF;

  safe_display_name := NULLIF(btrim(COALESCE(_display_name, '')), '');

  INSERT INTO public.chat_rooms (name, created_by)
  VALUES (btrim(_name), auth.uid())
  RETURNING * INTO new_room;

  INSERT INTO public.chat_members (room_id, user_id, display_name)
  VALUES (
    new_room.id,
    auth.uid(),
    COALESCE(safe_display_name, 'User')
  );

  RETURN new_room;
END;
$function$;

CREATE OR REPLACE FUNCTION public.join_chat_room_by_invite(_invite_code text, _display_name text DEFAULT NULL)
RETURNS public.chat_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_room public.chat_rooms;
  current_members integer;
  safe_display_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF _invite_code IS NULL OR btrim(_invite_code) = '' THEN
    RAISE EXCEPTION 'Invite code is required';
  END IF;

  SELECT *
  INTO target_room
  FROM public.chat_rooms
  WHERE invite_code = btrim(_invite_code)
  LIMIT 1;

  IF target_room.id IS NULL THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.chat_members
    WHERE room_id = target_room.id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Already a member';
  END IF;

  SELECT count(*)::integer
  INTO current_members
  FROM public.chat_members
  WHERE room_id = target_room.id;

  IF current_members >= target_room.max_members THEN
    RAISE EXCEPTION 'Room is full';
  END IF;

  safe_display_name := NULLIF(btrim(COALESCE(_display_name, '')), '');

  INSERT INTO public.chat_members (room_id, user_id, display_name)
  VALUES (
    target_room.id,
    auth.uid(),
    COALESCE(safe_display_name, 'User')
  );

  RETURN target_room;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_chat_room(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_chat_room_by_invite(text, text) TO authenticated;
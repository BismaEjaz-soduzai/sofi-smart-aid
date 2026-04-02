
CREATE OR REPLACE FUNCTION public.mark_message_read(_message_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_messages
  SET read_by = array_append(read_by, _user_id)
  WHERE id = _message_id
  AND NOT (_user_id = ANY(read_by));
END;
$$;

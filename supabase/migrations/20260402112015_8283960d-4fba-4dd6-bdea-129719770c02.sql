
-- Add read_by column to chat_messages for read receipts
ALTER TABLE public.chat_messages ADD COLUMN read_by uuid[] NOT NULL DEFAULT '{}';

-- Allow members to update read_by on messages in their rooms
CREATE POLICY "Members can update read_by"
ON public.chat_messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM chat_members
    WHERE chat_members.room_id = chat_messages.room_id
    AND chat_members.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM chat_members
    WHERE chat_members.room_id = chat_messages.room_id
    AND chat_members.user_id = auth.uid()
  )
);

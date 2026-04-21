-- Allow workspace room members to upload to rooms/<roomId>/... in study-files
CREATE POLICY "Room members can upload to room folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'study-files'
  AND (storage.foldername(name))[1] = 'rooms'
  AND public.is_workspace_room_member(((storage.foldername(name))[2])::uuid, auth.uid())
);

-- Allow workspace room members to read files under rooms/<roomId>/...
CREATE POLICY "Room members can view room folder files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'study-files'
  AND (storage.foldername(name))[1] = 'rooms'
  AND public.is_workspace_room_member(((storage.foldername(name))[2])::uuid, auth.uid())
);

-- Allow room owners to delete files in their room folder
CREATE POLICY "Room owners can delete room folder files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'study-files'
  AND (storage.foldername(name))[1] = 'rooms'
  AND EXISTS (
    SELECT 1 FROM public.workspace_rooms wr
    WHERE wr.id = ((storage.foldername(name))[2])::uuid
      AND wr.user_id = auth.uid()
  )
);
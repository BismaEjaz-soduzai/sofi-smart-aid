DROP POLICY IF EXISTS "Workspace room members can view room files in storage" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own study files in storage" ON storage.objects;

CREATE POLICY "Users can view their own study files in storage"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'study-files'
  AND auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Workspace room members can view room files in storage"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'study-files'
  AND EXISTS (
    SELECT 1
    FROM public.study_files sf
    WHERE sf.file_path = name
      AND sf.room_id IS NOT NULL
      AND public.is_workspace_room_member(sf.room_id, auth.uid())
  )
);
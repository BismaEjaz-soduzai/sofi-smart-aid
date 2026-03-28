
-- Study files table
CREATE TABLE public.study_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  file_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.study_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own files" ON public.study_files FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own files" ON public.study_files FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own files" ON public.study_files FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_study_files_updated_at BEFORE UPDATE ON public.study_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Study interactions table
CREATE TABLE public.study_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_prompt TEXT NOT NULL,
  assistant_response TEXT NOT NULL DEFAULT '',
  related_file_id UUID REFERENCES public.study_files(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.study_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own interactions" ON public.study_interactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own interactions" ON public.study_interactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own interactions" ON public.study_interactions FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket for study files
INSERT INTO storage.buckets (id, name, public) VALUES ('study-files', 'study-files', false);

CREATE POLICY "Users can upload study files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'study-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view their study files" ON storage.objects FOR SELECT USING (bucket_id = 'study-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their study files" ON storage.objects FOR DELETE USING (bucket_id = 'study-files' AND auth.uid()::text = (storage.foldername(name))[1]);

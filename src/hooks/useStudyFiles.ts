import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface StudyFile {
  id: string;
  user_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_path: string;
  created_at: string;
  updated_at: string;
}

export function useStudyFiles() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const filesQuery = useQuery({
    queryKey: ["study-files", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_files")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as StudyFile[];
    },
    enabled: !!user,
  });

  const uploadFile = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Not authenticated");
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("study-files")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const ext = file.name.split(".").pop()?.toLowerCase() || "unknown";
      const typeMap: Record<string, string> = {
        pdf: "PDF", docx: "DOCX", doc: "DOCX",
        ppt: "PPT", pptx: "PPTX", txt: "TXT",
      };

      const { error: dbError } = await supabase.from("study_files").insert({
        user_id: user.id,
        file_name: file.name,
        file_type: typeMap[ext] || ext.toUpperCase(),
        file_size: file.size,
        file_path: filePath,
      });
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-files"] });
      toast.success("File uploaded successfully");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Upload failed");
    },
  });

  const deleteFile = useMutation({
    mutationFn: async (file: StudyFile) => {
      const { error: storageErr } = await supabase.storage
        .from("study-files")
        .remove([file.file_path]);
      if (storageErr) throw storageErr;

      const { error: dbErr } = await supabase
        .from("study_files")
        .delete()
        .eq("id", file.id);
      if (dbErr) throw dbErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-files"] });
      toast.success("File deleted");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Delete failed");
    },
  });

  return { files: filesQuery.data || [], isLoading: filesQuery.isLoading, uploadFile, deleteFile };
}

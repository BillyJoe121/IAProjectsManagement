-- Briefs are private project records. This is additive and safe to deploy before the UI.
BEGIN;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS brief_file_name TEXT,
  ADD COLUMN IF NOT EXISTS brief_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS brief_uploaded_at TIMESTAMPTZ;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('project-briefs', 'project-briefs', false, 15000000, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS project_briefs_read ON storage.objects;
DROP POLICY IF EXISTS project_briefs_insert_monitor ON storage.objects;
DROP POLICY IF EXISTS project_briefs_delete_monitor ON storage.objects;
CREATE POLICY project_briefs_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-briefs' AND public.can_access_project((storage.foldername(name))[1]::uuid));
CREATE POLICY project_briefs_insert_monitor ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-briefs' AND public.is_superuser() AND owner_id = auth.uid()::text);
CREATE POLICY project_briefs_delete_monitor ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-briefs' AND public.is_superuser());

COMMIT;

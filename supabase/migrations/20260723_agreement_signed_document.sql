-- Signed agreement working copies.
-- When a client emails back a signed agreement, we upload that PDF and attach
-- it to the agreement for quick reference. The emailed, signed original
-- remains the legal source of truth; this is only a working copy.

-- Nullable in-bucket object path of the uploaded signed PDF.
ALTER TABLE public.agreements
  ADD COLUMN IF NOT EXISTS signed_document_path text;

-- Private, PDF-only, 10 MB bucket for the signed copies.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('signed-documents', 'signed-documents', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Mirror the app's uniform table policy (for all to authenticated): any
-- logged-in HQ user gets full access to this bucket; the anon role gets none.
DROP POLICY IF EXISTS "signed_documents_all_authenticated" ON storage.objects;
CREATE POLICY "signed_documents_all_authenticated"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'signed-documents')
  WITH CHECK (bucket_id = 'signed-documents');

/*
# Browser Screenshots Storage Bucket

## Summary
Creates a private (restricted) storage bucket for browser screenshots.
Screenshots are used for diagnostics during LinkedIn browser automation.

## Security
- Bucket is private (not public) — access requires signed URLs
- Files are workspace-scoped via path convention: {workspace_id}/{filename}
- RLS policies on storage.objects restrict access to workspace members
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'browser-screenshots',
  'browser-screenshots',
  false,
  5242880,  -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: only workspace members can access their workspace's screenshots
DROP POLICY IF EXISTS "browser_screenshots_read_own" ON storage.objects;
CREATE POLICY "browser_screenshots_read_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'browser-screenshots'
    AND is_workspace_member((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "browser_screenshots_insert_own" ON storage.objects;
CREATE POLICY "browser_screenshots_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'browser-screenshots'
    AND is_workspace_member((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "browser_screenshots_delete_own" ON storage.objects;
CREATE POLICY "browser_screenshots_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'browser-screenshots'
    AND is_workspace_member((storage.foldername(name))[1]::uuid)
  );
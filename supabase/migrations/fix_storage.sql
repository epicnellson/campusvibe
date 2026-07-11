-- Create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-id-verification',
  'student-id-verification',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can upload their own student ID"
  ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own student ID"
  ON storage.objects;
DROP POLICY IF EXISTS "Service role can read all student IDs"
  ON storage.objects;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload their own student ID"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'student-id-verification' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to view/update their own uploads
CREATE POLICY "Users can view their own student ID"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'student-id-verification' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update/replace their own uploads
CREATE POLICY "Users can update their own student ID"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'student-id-verification' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

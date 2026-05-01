
-- Add photo_url column to facility_reports
ALTER TABLE public.facility_reports
ADD COLUMN IF NOT EXISTS photo_url text;

-- Create public bucket for report photos (5 MB limit, image mime types)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'report-photos',
  'report-photos',
  true,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS policies for report-photos
DROP POLICY IF EXISTS "Anyone can view report photos" ON storage.objects;
CREATE POLICY "Anyone can view report photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'report-photos');

DROP POLICY IF EXISTS "Anyone can upload report photos" ON storage.objects;
CREATE POLICY "Anyone can upload report photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'report-photos');

DROP POLICY IF EXISTS "Admins can delete report photos" ON storage.objects;
CREATE POLICY "Admins can delete report photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'report-photos' AND public.has_role(auth.uid(), 'admin'));

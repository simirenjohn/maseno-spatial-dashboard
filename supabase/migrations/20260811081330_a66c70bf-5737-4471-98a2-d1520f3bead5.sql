-- 1. Profiles: no public read
DROP POLICY IF EXISTS "Profiles viewable by everyone" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. facility_reports: keep anonymous submissions but validate them
ALTER TABLE public.facility_reports
  ADD CONSTRAINT facility_reports_facility_name_len
    CHECK (char_length(trim(facility_name)) BETWEEN 1 AND 200),
  ADD CONSTRAINT facility_reports_facility_type_len
    CHECK (char_length(trim(facility_type)) BETWEEN 1 AND 100),
  ADD CONSTRAINT facility_reports_issue_type_len
    CHECK (char_length(trim(issue_type)) BETWEEN 1 AND 100),
  ADD CONSTRAINT facility_reports_description_len
    CHECK (description IS NULL OR char_length(description) <= 2000),
  ADD CONSTRAINT facility_reports_reporter_name_len
    CHECK (reporter_name IS NULL OR char_length(reporter_name) <= 100),
  ADD CONSTRAINT facility_reports_status_allowed
    CHECK (status IN ('Pending', 'In Progress', 'Resolved', 'Rejected')),
  ADD CONSTRAINT facility_reports_photo_url_len
    CHECK (photo_url IS NULL OR char_length(photo_url) <= 1000);

-- 3. Lock down SECURITY DEFINER trigger functions from API roles
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- 4. Storage: restrict anonymous uploads to an images-only prefix
DROP POLICY IF EXISTS "Anyone can upload report photos" ON storage.objects;
CREATE POLICY "Report photo uploads restricted to reports folder"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'report-photos'
    AND (storage.foldername(name))[1] = 'reports'
    AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp', 'heic')
  );

-- Drop the overly permissive update policy
DROP POLICY "Anyone can update report status" ON public.facility_reports;

-- Only admins can update reports
CREATE POLICY "Admins can update reports"
  ON public.facility_reports FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

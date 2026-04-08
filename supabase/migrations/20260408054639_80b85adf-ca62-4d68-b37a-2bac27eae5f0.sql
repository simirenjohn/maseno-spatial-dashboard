
-- Create facility_reports table
CREATE TABLE public.facility_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_name TEXT NOT NULL,
  facility_type TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  description TEXT DEFAULT '',
  reporter_name TEXT DEFAULT 'Anonymous',
  status TEXT NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.facility_reports ENABLE ROW LEVEL SECURITY;

-- Anyone can insert reports (no auth required for campus users)
CREATE POLICY "Anyone can submit reports" ON public.facility_reports FOR INSERT WITH CHECK (true);

-- Only authenticated admins can view/update reports (we'll use admin role later)
CREATE POLICY "Anyone can view reports" ON public.facility_reports FOR SELECT USING (true);

CREATE POLICY "Anyone can update report status" ON public.facility_reports FOR UPDATE USING (true);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_facility_reports_updated_at
  BEFORE UPDATE ON public.facility_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

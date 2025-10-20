-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'staff');

-- Create status enum
CREATE TYPE public.signage_status AS ENUM ('current', 'expiring_soon', 'overdue', 'empty', 'planned');

-- Create priority enum
CREATE TYPE public.priority_level AS ENUM ('critical', 'high', 'medium', 'low');

-- Create content category enum
CREATE TYPE public.content_category AS ENUM ('evergreen', 'event_based', 'seasonal', 'partnership', 'theming', 'marketing');

-- Create orientation enum
CREATE TYPE public.orientation_type AS ENUM ('portrait', 'landscape', 'square');

-- Create image type enum
CREATE TYPE public.image_type AS ENUM ('before', 'after', 'current', 'reference');

-- Create field type enum
CREATE TYPE public.field_type AS ENUM ('text', 'longtext', 'dropdown', 'date', 'url', 'number', 'checkbox', 'multiselect', 'image');

-- Create action type enum
CREATE TYPE public.action_type AS ENUM ('created', 'updated', 'deleted', 'status_changed', 'image_uploaded', 'assigned');

-- Create venues table
CREATE TABLE public.venues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  timezone TEXT DEFAULT 'Australia/Melbourne',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role public.app_role NOT NULL DEFAULT 'staff',
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create campaigns table
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Create signage_spots table
CREATE TABLE public.signage_spots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id UUID NOT NULL REFERENCES public.venues(id),
  location_name TEXT NOT NULL,
  status public.signage_status DEFAULT 'empty',
  priority_level public.priority_level DEFAULT 'medium',
  content_category public.content_category,
  width_cm NUMERIC,
  height_cm NUMERIC,
  depth_cm NUMERIC,
  specs_notes TEXT,
  material_type TEXT,
  mounting_type TEXT,
  orientation public.orientation_type,
  current_image_url TEXT,
  install_date DATE,
  last_update_date DATE,
  expiry_date DATE,
  expiry_behavior TEXT DEFAULT 'auto_6_months',
  assigned_user_id UUID REFERENCES public.profiles(id),
  supplier_vendor TEXT,
  creative_brief TEXT,
  recommendations TEXT,
  notes TEXT,
  legacy_drive_link TEXT,
  qr_code_data TEXT,
  is_opportunity BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id)
);

-- Create signage_campaigns junction table
CREATE TABLE public.signage_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  signage_spot_id UUID NOT NULL REFERENCES public.signage_spots(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(signage_spot_id, campaign_id)
);

-- Create photo_history table
CREATE TABLE public.photo_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  signage_spot_id UUID NOT NULL REFERENCES public.signage_spots(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  uploaded_by UUID REFERENCES public.profiles(id),
  caption TEXT,
  image_type public.image_type DEFAULT 'current'
);

-- Create custom_fields table
CREATE TABLE public.custom_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type public.field_type NOT NULL,
  field_options JSONB,
  is_required BOOLEAN DEFAULT false,
  is_visible BOOLEAN DEFAULT true,
  applies_to_venues TEXT[],
  applies_to_categories TEXT[],
  field_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Create signage_custom_values table
CREATE TABLE public.signage_custom_values (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  signage_spot_id UUID NOT NULL REFERENCES public.signage_spots(id) ON DELETE CASCADE,
  custom_field_id UUID NOT NULL REFERENCES public.custom_fields(id) ON DELETE CASCADE,
  value JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(signage_spot_id, custom_field_id)
);

-- Create activity_log table
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id),
  signage_spot_id UUID REFERENCES public.signage_spots(id),
  action_type public.action_type NOT NULL,
  action_details JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create alert_settings table
CREATE TABLE public.alert_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_type TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  slack_webhook_url TEXT,
  email_recipients TEXT[],
  alert_triggers JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_signage_venue ON public.signage_spots(venue_id);
CREATE INDEX idx_signage_status ON public.signage_spots(status);
CREATE INDEX idx_signage_assigned ON public.signage_spots(assigned_user_id);
CREATE INDEX idx_photo_spot ON public.photo_history(signage_spot_id);
CREATE INDEX idx_activity_user ON public.activity_log(user_id);
CREATE INDEX idx_activity_spot ON public.activity_log(signage_spot_id);
CREATE INDEX idx_campaign_junction ON public.signage_campaigns(campaign_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_venues_updated_at BEFORE UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_signage_spots_updated_at BEFORE UPDATE ON public.signage_spots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_alert_settings_updated_at BEFORE UPDATE ON public.alert_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'staff')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable Row Level Security
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signage_spots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signage_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signage_custom_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- RLS Policies for venues (FIXED - INSERT uses WITH CHECK, not USING)
CREATE POLICY "All authenticated users can view venues" ON public.venues FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert venues" ON public.venues FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can update venues" ON public.venues FOR UPDATE TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can delete venues" ON public.venues FOR DELETE TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- RLS Policies for signage_spots (FIXED)
CREATE POLICY "All authenticated users can view signage spots" ON public.signage_spots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers and admins can create signage spots" ON public.signage_spots FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));
CREATE POLICY "Staff can update assigned spots" ON public.signage_spots FOR UPDATE TO authenticated 
  USING (assigned_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));
CREATE POLICY "Admins can delete signage spots" ON public.signage_spots FOR DELETE TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- RLS Policies for campaigns (FIXED)
CREATE POLICY "All authenticated users can view campaigns" ON public.campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers and admins can insert campaigns" ON public.campaigns FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));
CREATE POLICY "Managers and admins can update campaigns" ON public.campaigns FOR UPDATE TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));
CREATE POLICY "Managers and admins can delete campaigns" ON public.campaigns FOR DELETE TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));

-- RLS Policies for photo_history (FIXED)
CREATE POLICY "All authenticated users can view photos" ON public.photo_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "All authenticated users can upload photos" ON public.photo_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Managers and admins can delete photos" ON public.photo_history FOR DELETE TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));

-- RLS Policies for custom_fields (FIXED)
CREATE POLICY "All authenticated users can view custom fields" ON public.custom_fields FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert custom fields" ON public.custom_fields FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can update custom fields" ON public.custom_fields FOR UPDATE TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can delete custom fields" ON public.custom_fields FOR DELETE TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- RLS Policies for signage_custom_values (FIXED)
CREATE POLICY "All authenticated users can view custom values" ON public.signage_custom_values FOR SELECT TO authenticated USING (true);
CREATE POLICY "All authenticated users can insert custom values" ON public.signage_custom_values FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "All authenticated users can update custom values" ON public.signage_custom_values FOR UPDATE TO authenticated USING (true);
CREATE POLICY "All authenticated users can delete custom values" ON public.signage_custom_values FOR DELETE TO authenticated USING (true);

-- RLS Policies for activity_log (FIXED)
CREATE POLICY "All authenticated users can view activity log" ON public.activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "All authenticated users can create activity log" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (true);

-- RLS Policies for alert_settings (FIXED)
CREATE POLICY "All authenticated users can view alert settings" ON public.alert_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert alert settings" ON public.alert_settings FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can update alert settings" ON public.alert_settings FOR UPDATE TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can delete alert settings" ON public.alert_settings FOR DELETE TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- RLS for junction tables (FIXED)
CREATE POLICY "All authenticated users can view signage campaigns" ON public.signage_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert signage campaigns" ON public.signage_campaigns FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));
CREATE POLICY "Managers can update signage campaigns" ON public.signage_campaigns FOR UPDATE TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));
CREATE POLICY "Managers can delete signage campaigns" ON public.signage_campaigns FOR DELETE TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));

-- Insert default venues
INSERT INTO public.venues (name, address, timezone) VALUES 
  ('Melbourne', 'Melbourne CBD, Victoria', 'Australia/Melbourne'),
  ('Sydney', 'Sydney CBD, NSW', 'Australia/Sydney');

-- Create storage bucket for signage images
INSERT INTO storage.buckets (id, name, public) VALUES ('signage', 'signage', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload signage images" 
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'signage');

CREATE POLICY "Public can view signage images" 
ON storage.objects FOR SELECT TO public 
USING (bucket_id = 'signage');

CREATE POLICY "Managers can delete signage images" 
ON storage.objects FOR DELETE TO authenticated 
USING (
  bucket_id = 'signage' AND 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);
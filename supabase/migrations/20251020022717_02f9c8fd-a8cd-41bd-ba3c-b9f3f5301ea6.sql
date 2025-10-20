-- Create user_roles table for secure role management
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents infinite recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS policy: Users can view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- RLS policy: Only admins can manage roles
CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Update handle_new_user to also create user_roles entry
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role app_role;
BEGIN
  -- Get role from user metadata, default to 'staff'
  user_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'staff');
  
  -- Insert profile
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    user_role
  );
  
  -- Insert user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role);
  
  RETURN NEW;
END;
$$;

-- Migrate existing profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, role
FROM public.profiles
WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Update all RLS policies to use has_role function instead of direct profile queries

-- Activity log policies
DROP POLICY IF EXISTS "All authenticated users can create activity log" ON public.activity_log;
DROP POLICY IF EXISTS "All authenticated users can view activity log" ON public.activity_log;

CREATE POLICY "All authenticated users can create activity log"
ON public.activity_log FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "All authenticated users can view activity log"
ON public.activity_log FOR SELECT
TO authenticated
USING (true);

-- Alert settings policies
DROP POLICY IF EXISTS "Admins can delete alert settings" ON public.alert_settings;
DROP POLICY IF EXISTS "Admins can insert alert settings" ON public.alert_settings;
DROP POLICY IF EXISTS "Admins can update alert settings" ON public.alert_settings;

CREATE POLICY "Admins can delete alert settings"
ON public.alert_settings FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert alert settings"
ON public.alert_settings FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update alert settings"
ON public.alert_settings FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Campaigns policies
DROP POLICY IF EXISTS "Managers and admins can delete campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Managers and admins can insert campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Managers and admins can update campaigns" ON public.campaigns;

CREATE POLICY "Managers and admins can delete campaigns"
ON public.campaigns FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers and admins can insert campaigns"
ON public.campaigns FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers and admins can update campaigns"
ON public.campaigns FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Custom fields policies
DROP POLICY IF EXISTS "Admins can delete custom fields" ON public.custom_fields;
DROP POLICY IF EXISTS "Admins can insert custom fields" ON public.custom_fields;
DROP POLICY IF EXISTS "Admins can update custom fields" ON public.custom_fields;

CREATE POLICY "Admins can delete custom fields"
ON public.custom_fields FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert custom fields"
ON public.custom_fields FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update custom fields"
ON public.custom_fields FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Photo history policies
DROP POLICY IF EXISTS "Managers and admins can delete photos" ON public.photo_history;

CREATE POLICY "Managers and admins can delete photos"
ON public.photo_history FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Signage campaigns policies
DROP POLICY IF EXISTS "Managers can delete signage campaigns" ON public.signage_campaigns;
DROP POLICY IF EXISTS "Managers can insert signage campaigns" ON public.signage_campaigns;
DROP POLICY IF EXISTS "Managers can update signage campaigns" ON public.signage_campaigns;

CREATE POLICY "Managers can delete signage campaigns"
ON public.signage_campaigns FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers can insert signage campaigns"
ON public.signage_campaigns FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers can update signage campaigns"
ON public.signage_campaigns FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Signage spots policies
DROP POLICY IF EXISTS "Admins can delete signage spots" ON public.signage_spots;
DROP POLICY IF EXISTS "Managers and admins can create signage spots" ON public.signage_spots;
DROP POLICY IF EXISTS "Staff can update assigned spots" ON public.signage_spots;

CREATE POLICY "Admins can delete signage spots"
ON public.signage_spots FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers and admins can create signage spots"
ON public.signage_spots FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Staff can update assigned spots"
ON public.signage_spots FOR UPDATE
TO authenticated
USING (
  assigned_user_id = auth.uid() OR 
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'manager')
);

-- Venues policies
DROP POLICY IF EXISTS "Admins can delete venues" ON public.venues;
DROP POLICY IF EXISTS "Admins can insert venues" ON public.venues;
DROP POLICY IF EXISTS "Admins can update venues" ON public.venues;

CREATE POLICY "Admins can delete venues"
ON public.venues FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert venues"
ON public.venues FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update venues"
ON public.venues FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
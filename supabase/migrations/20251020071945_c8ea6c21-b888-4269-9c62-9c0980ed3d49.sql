-- Security Fix 1: Restrict profiles table access
-- Only allow users to view their own profile, or allow admins/managers to view all
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;

CREATE POLICY "Users can view own profile"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins and managers can view all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- Security Fix 2: Restrict alert_settings to admins only
DROP POLICY IF EXISTS "All authenticated users can view alert settings" ON alert_settings;

CREATE POLICY "Only admins can view alert settings"
ON alert_settings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Security Fix 3: Add UPDATE policy for photo_history
-- Allow managers/admins to update, or the uploader to update their own photos
CREATE POLICY "Users can update own photos, managers can update all"
ON photo_history
FOR UPDATE
TO authenticated
USING (
  uploaded_by = auth.uid() OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role)
)
WITH CHECK (
  uploaded_by = auth.uid() OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role)
);

-- Security Fix 4: Restrict campaign budget visibility
-- Create a view that excludes budget info for regular staff
CREATE OR REPLACE VIEW campaigns_public AS
SELECT 
  id,
  name,
  description,
  start_date,
  end_date,
  created_by,
  created_at,
  is_active,
  groups,
  tags,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    ) THEN budget_allocated
    ELSE NULL
  END as budget_allocated,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    ) THEN budget_notes
    ELSE NULL
  END as budget_notes
FROM campaigns;

-- Grant access to the view
GRANT SELECT ON campaigns_public TO authenticated;

-- Note: The campaigns table RLS policies remain as-is for direct access
-- Frontend code should use campaigns_public view for regular staff
-- and campaigns table for admins/managers
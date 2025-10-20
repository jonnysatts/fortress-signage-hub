-- Add tags to signage_spots
ALTER TABLE signage_spots 
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Create signage_groups table for predefined groups
CREATE TABLE IF NOT EXISTS signage_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  color text DEFAULT '#6B7280',
  icon text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE signage_groups ENABLE ROW LEVEL SECURITY;

-- RLS Policies for signage_groups
CREATE POLICY "All authenticated users can view groups"
ON signage_groups FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert groups"
ON signage_groups FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can update groups"
ON signage_groups FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can delete groups"
ON signage_groups FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Create junction table for signage spots to groups (many-to-many)
CREATE TABLE IF NOT EXISTS signage_spot_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signage_spot_id uuid NOT NULL REFERENCES signage_spots(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES signage_groups(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(signage_spot_id, group_id)
);

-- Enable RLS
ALTER TABLE signage_spot_groups ENABLE ROW LEVEL SECURITY;

-- RLS Policies for signage_spot_groups
CREATE POLICY "All authenticated users can view spot groups"
ON signage_spot_groups FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Staff can manage spot groups for assigned spots"
ON signage_spot_groups FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM signage_spots s
    WHERE s.id = signage_spot_groups.signage_spot_id
    AND (
      s.assigned_user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM signage_spots s
    WHERE s.id = signage_spot_groups.signage_spot_id
    AND (
      s.assigned_user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
      )
    )
  )
);

-- Insert default groups
INSERT INTO signage_groups (name, description, color, icon) VALUES
('Posters', 'Standard poster frames', '#3B82F6', 'Frame'),
('Lightboxes', 'Illuminated signage displays', '#F59E0B', 'Lightbulb'),
('Digital Screens', 'Electronic display screens', '#8B5CF6', 'Monitor'),
('Window Graphics', 'Window and glass displays', '#10B981', 'Glasses'),
('Floor Decals', 'Floor-mounted graphics', '#EF4444', 'MapPin'),
('Hanging Banners', 'Suspended signage', '#EC4899', 'Flag')
ON CONFLICT (name) DO NOTHING;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_signage_spots_tags ON signage_spots USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_signage_spot_groups_spot ON signage_spot_groups(signage_spot_id);
CREATE INDEX IF NOT EXISTS idx_signage_spot_groups_group ON signage_spot_groups(group_id);
-- Create floor_plans table
CREATE TABLE floor_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue TEXT NOT NULL,
  level TEXT NOT NULL,
  display_name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add floor plan marker columns to signage_spots
ALTER TABLE signage_spots 
ADD COLUMN floor_plan_id UUID REFERENCES floor_plans(id),
ADD COLUMN marker_x DECIMAL(5,2),
ADD COLUMN marker_y DECIMAL(5,2),
ADD COLUMN marker_type TEXT DEFAULT 'circle',
ADD COLUMN marker_size INTEGER DEFAULT 30,
ADD COLUMN marker_rotation INTEGER DEFAULT 0,
ADD COLUMN show_on_map BOOLEAN DEFAULT true;

-- Enable RLS on floor_plans
ALTER TABLE floor_plans ENABLE ROW LEVEL SECURITY;

-- Floor plans are viewable by all authenticated users
CREATE POLICY "Floor plans are viewable by authenticated users"
ON floor_plans FOR SELECT
TO authenticated
USING (true);

-- Only admins can insert floor plans
CREATE POLICY "Admins can insert floor plans"
ON floor_plans FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- Only admins can update floor plans
CREATE POLICY "Admins can update floor plans"
ON floor_plans FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- Only admins can delete floor plans
CREATE POLICY "Admins can delete floor plans"
ON floor_plans FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- Create storage bucket for floor plans
INSERT INTO storage.buckets (id, name, public)
VALUES ('floor-plans', 'floor-plans', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for floor plan images
CREATE POLICY "Floor plan images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'floor-plans');

CREATE POLICY "Admins can upload floor plan images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'floor-plans' 
  AND (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  ))
);

CREATE POLICY "Admins can update floor plan images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'floor-plans'
  AND (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  ))
);

CREATE POLICY "Admins can delete floor plan images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'floor-plans'
  AND (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  ))
);

-- Add trigger for updated_at on floor_plans
CREATE TRIGGER update_floor_plans_updated_at
BEFORE UPDATE ON floor_plans
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
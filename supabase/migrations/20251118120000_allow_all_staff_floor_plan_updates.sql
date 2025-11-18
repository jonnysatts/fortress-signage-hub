-- Allow all authenticated users to update floor plan marker positions
-- This fixes the "failed to save Marker" error when placing spots on floor plans

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Staff can update signage spots" ON public.signage_spots;
DROP POLICY IF EXISTS "Staff can update assigned spots" ON public.signage_spots;

-- Create new policy that allows all authenticated users to update spots
-- This is necessary for collaborative floor plan marker placement
CREATE POLICY "Staff can update signage spots"
ON public.signage_spots FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

COMMENT ON POLICY "Staff can update signage spots" ON public.signage_spots IS
'Allows all authenticated users to update signage spots, including floor plan marker placement. This enables collaborative floor plan management where any team member can place and update markers.';

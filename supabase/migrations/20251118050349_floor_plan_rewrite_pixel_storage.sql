-- Floor Plan Module Rewrite: Pixel-Based Marker Storage
-- This migration adds new columns for storing marker positions as pixels
-- relative to the original floor plan image dimensions.

-- PART 1: Add pixel-based marker columns to signage_spots
ALTER TABLE signage_spots
ADD COLUMN IF NOT EXISTS marker_x_pixels INTEGER,
ADD COLUMN IF NOT EXISTS marker_y_pixels INTEGER,
ADD COLUMN IF NOT EXISTS marker_x2_pixels INTEGER,  -- For line/area endpoints
ADD COLUMN IF NOT EXISTS marker_y2_pixels INTEGER,
ADD COLUMN IF NOT EXISTS marker_width_pixels INTEGER,  -- For area/rectangle width
ADD COLUMN IF NOT EXISTS marker_height_pixels INTEGER,  -- For area/rectangle height
ADD COLUMN IF NOT EXISTS marker_radius_pixels INTEGER;  -- For point/circle radius

-- Add comments explaining the new pixel-based system
COMMENT ON COLUMN signage_spots.marker_x_pixels IS 'X coordinate in pixels relative to original floor plan image width. Used for all marker types.';
COMMENT ON COLUMN signage_spots.marker_y_pixels IS 'Y coordinate in pixels relative to original floor plan image height. Used for all marker types.';
COMMENT ON COLUMN signage_spots.marker_x2_pixels IS 'End X coordinate in pixels (for line type markers only)';
COMMENT ON COLUMN signage_spots.marker_y2_pixels IS 'End Y coordinate in pixels (for line type markers only)';
COMMENT ON COLUMN signage_spots.marker_width_pixels IS 'Width in pixels (for rectangle/area type markers only)';
COMMENT ON COLUMN signage_spots.marker_height_pixels IS 'Height in pixels (for rectangle/area type markers only)';
COMMENT ON COLUMN signage_spots.marker_radius_pixels IS 'Radius in pixels (for circle/point type markers only)';

-- Keep old percentage columns for backward compatibility during migration
COMMENT ON COLUMN signage_spots.marker_x IS 'DEPRECATED: Old percentage-based X coordinate (0-100). Use marker_x_pixels instead.';
COMMENT ON COLUMN signage_spots.marker_y IS 'DEPRECATED: Old percentage-based Y coordinate (0-100). Use marker_y_pixels instead.';
COMMENT ON COLUMN signage_spots.marker_size IS 'DEPRECATED: Old size in arbitrary units. Use marker_radius_pixels/marker_width_pixels instead.';
COMMENT ON COLUMN signage_spots.marker_rotation IS 'Rotation in degrees (0-360). Still valid for all marker types.';

-- PART 2: Ensure floor_plans has image dimension columns (idempotent)
-- These may already exist from previous migration 20251118041816
ALTER TABLE floor_plans
ADD COLUMN IF NOT EXISTS original_width INTEGER,
ADD COLUMN IF NOT EXISTS original_height INTEGER;

COMMENT ON COLUMN floor_plans.original_width IS 'Original width of floor plan image in pixels (e.g., 1920). Required for pixel-based marker positioning.';
COMMENT ON COLUMN floor_plans.original_height IS 'Original height of floor plan image in pixels (e.g., 1080). Required for pixel-based marker positioning.';

-- PART 3: Add validation constraints
-- Marker coordinates must be positive and within image bounds
-- We'll enforce this at application level for now, but add check constraints for future

-- PART 4: Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_signage_spots_floor_plan_pixels
ON signage_spots(floor_plan_id)
WHERE marker_x_pixels IS NOT NULL;

-- PART 5: Migration function to convert existing percentage-based markers to pixels
-- This will only work for floor plans that have original_width/original_height populated
CREATE OR REPLACE FUNCTION migrate_markers_to_pixels()
RETURNS TABLE(
  spot_id UUID,
  spot_name TEXT,
  migrated BOOLEAN,
  reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  UPDATE signage_spots ss
  SET
    marker_x_pixels = CASE
      WHEN fp.original_width IS NOT NULL AND ss.marker_x IS NOT NULL
      THEN ROUND((ss.marker_x / 100.0) * fp.original_width)::INTEGER
      ELSE NULL
    END,
    marker_y_pixels = CASE
      WHEN fp.original_height IS NOT NULL AND ss.marker_y IS NOT NULL
      THEN ROUND((ss.marker_y / 100.0) * fp.original_height)::INTEGER
      ELSE NULL
    END,
    marker_radius_pixels = CASE
      WHEN ss.marker_type IN ('circle', 'point') AND ss.marker_size IS NOT NULL
      THEN (ss.marker_size / 2)::INTEGER  -- marker_size was diameter, radius is half
      ELSE NULL
    END,
    marker_width_pixels = CASE
      WHEN ss.marker_type IN ('rectangle', 'area') AND ss.marker_size IS NOT NULL
      THEN ss.marker_size::INTEGER
      ELSE NULL
    END,
    marker_height_pixels = CASE
      WHEN ss.marker_type IN ('rectangle', 'area') AND ss.marker_size IS NOT NULL
      THEN ss.marker_size::INTEGER
      ELSE NULL
    END
  FROM floor_plans fp
  WHERE ss.floor_plan_id = fp.id
    AND ss.marker_x IS NOT NULL  -- Has old percentage data
    AND ss.marker_x_pixels IS NULL  -- Not already migrated
  RETURNING
    ss.id,
    ss.location_name,
    (ss.marker_x_pixels IS NOT NULL) as migrated,
    CASE
      WHEN fp.original_width IS NULL THEN 'Floor plan missing original dimensions'
      WHEN ss.marker_x IS NULL THEN 'Marker has no position data'
      ELSE 'Successfully migrated'
    END;
END;
$$ LANGUAGE plpgsql;

-- Run the migration function
SELECT * FROM migrate_markers_to_pixels();

-- Log migration results
DO $$
DECLARE
  v_total INTEGER;
  v_migrated INTEGER;
  v_pending INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM signage_spots
  WHERE floor_plan_id IS NOT NULL;

  SELECT COUNT(*) INTO v_migrated
  FROM signage_spots
  WHERE marker_x_pixels IS NOT NULL;

  v_pending := v_total - v_migrated;

  RAISE NOTICE '╔════════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║ Floor Plan Marker Migration Results                           ║';
  RAISE NOTICE '╠════════════════════════════════════════════════════════════════╣';
  RAISE NOTICE '║ Total markers on floor plans: %                               ║', LPAD(v_total::TEXT, 5);
  RAISE NOTICE '║ Migrated to pixel coords:    %                               ║', LPAD(v_migrated::TEXT, 5);
  RAISE NOTICE '║ Pending (need dimensions):    %                               ║', LPAD(v_pending::TEXT, 5);
  RAISE NOTICE '╚════════════════════════════════════════════════════════════════╝';

  IF v_pending > 0 THEN
    RAISE WARNING 'Some markers could not be migrated because floor plans are missing original_width/original_height. Upload new floor plans or manually set dimensions.';
  END IF;
END $$;

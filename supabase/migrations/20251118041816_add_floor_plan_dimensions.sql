-- Add original image dimensions to floor_plans table
-- This provides a stable reference for marker positioning

ALTER TABLE floor_plans
ADD COLUMN IF NOT EXISTS original_width INTEGER,
ADD COLUMN IF NOT EXISTS original_height INTEGER;

-- Add comment to explain the purpose
COMMENT ON COLUMN floor_plans.original_width IS 'Original width of the floor plan image in pixels - used as reference for marker positioning';
COMMENT ON COLUMN floor_plans.original_height IS 'Original height of the floor plan image in pixels - used as reference for marker positioning';

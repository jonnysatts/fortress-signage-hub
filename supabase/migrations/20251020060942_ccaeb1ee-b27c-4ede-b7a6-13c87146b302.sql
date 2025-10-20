-- Add budget columns to signage_spots
ALTER TABLE signage_spots 
ADD COLUMN production_cost numeric,
ADD COLUMN installation_cost numeric,
ADD COLUMN budget_notes text;

-- Add budget columns to campaigns
ALTER TABLE campaigns
ADD COLUMN budget_allocated numeric,
ADD COLUMN budget_notes text;

-- Create budget rollup function
CREATE OR REPLACE FUNCTION calculate_campaign_budget(campaign_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(
    COALESCE(s.production_cost, 0) + COALESCE(s.installation_cost, 0)
  ), 0)
  FROM signage_spots s
  JOIN signage_campaigns sc ON sc.signage_spot_id = s.id
  WHERE sc.campaign_id = calculate_campaign_budget.campaign_id
$$;

COMMENT ON COLUMN signage_spots.production_cost IS 'Cost to produce/create the signage content (AUD)';
COMMENT ON COLUMN signage_spots.installation_cost IS 'Cost to install/change the signage (AUD)';
COMMENT ON COLUMN campaigns.budget_allocated IS 'Total budget allocated to this campaign (AUD)';
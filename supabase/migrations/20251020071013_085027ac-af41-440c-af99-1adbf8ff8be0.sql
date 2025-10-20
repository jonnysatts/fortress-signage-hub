-- Add groups and tags to campaigns table
ALTER TABLE campaigns 
ADD COLUMN groups TEXT[] DEFAULT '{}',
ADD COLUMN tags TEXT[] DEFAULT '{}';
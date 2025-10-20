-- Add location photo field to signage_spots
ALTER TABLE signage_spots 
ADD COLUMN location_photo_url TEXT;
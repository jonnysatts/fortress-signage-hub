-- Attach triggers so photo uploads update signage_spots automatically
-- 1) When a 'current' image is inserted into photo_history, update signage_spots via handle_photo_upload()
-- 2) When a 'planned' image is inserted, keep next_planned_* in sync via update_next_planned_image()

-- Create trigger for handling current image uploads
DROP TRIGGER IF EXISTS trg_photo_upload ON public.photo_history;
CREATE TRIGGER trg_photo_upload
AFTER INSERT ON public.photo_history
FOR EACH ROW
EXECUTE FUNCTION public.handle_photo_upload();

-- Create trigger for updating next planned image metadata
DROP TRIGGER IF EXISTS trg_update_next_planned ON public.photo_history;
CREATE TRIGGER trg_update_next_planned
AFTER INSERT ON public.photo_history
FOR EACH ROW
EXECUTE FUNCTION public.update_next_planned_image();
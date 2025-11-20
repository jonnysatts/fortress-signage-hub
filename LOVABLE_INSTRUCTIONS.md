# Instructions for Lovable: Fix Floor Plan Marker Placement

## Problem
Floor plan marker placement is broken because the `floor_plans` table is missing `original_width` and `original_height` values. Without these dimensions, the SVG coordinate system defaults to 1920x1080, which doesn't match the actual image dimensions, making marker placement completely broken.

Console shows: `⚠ Floor plan missing dimensions, using defaults (1920x1080)`

## Solution Overview
1. Pull latest code from GitHub (includes marker visibility fixes)
2. Deploy the Edge Function to fix existing floor plans
3. Run the Edge Function to automatically detect and set correct dimensions
4. Ensure future floor plan uploads always include dimensions

---

## Step 1: Pull Latest Code from GitHub

Pull the latest code from the main branch. This includes:
- ✅ Floor plan marker visibility fixes (hex colors, white outlines)
- ✅ Cursor fixes (pointer in view mode)
- ✅ Edge Function to fix floor plan dimensions
- ✅ Image utility functions

---

## Step 2: Deploy the Edge Function

Deploy the new Edge Function:

```bash
supabase functions deploy fix-floor-plan-dimensions
```

This creates an endpoint that can automatically detect and fix floor plan dimensions.

---

## Step 3: Run the Edge Function

The Edge Function needs to be invoked once to fix all existing floor plans. You can do this via:

### Option A: Using the Supabase Dashboard
1. Go to Edge Functions in Supabase Dashboard
2. Find `fix-floor-plan-dimensions` function
3. Click "Invoke" with an empty request body `{}`

### Option B: Using curl (if you have the project URL)
```bash
curl -X POST \
  https://[project-ref].supabase.co/functions/v1/fix-floor-plan-dimensions \
  -H "Authorization: Bearer [anon-key]" \
  -H "Content-Type: application/json"
```

### Option C: Using SQL to manually check and update

First, check which floor plans need fixing:
```sql
SELECT
  id,
  display_name,
  original_width,
  original_height,
  image_url
FROM floor_plans
WHERE original_width IS NULL OR original_height IS NULL;
```

If the Edge Function doesn't work, you can manually update by:
1. Download each floor plan image from `image_url`
2. Get the actual dimensions (right-click → Get Info on Mac, or use an image editor)
3. Update the database:

```sql
-- Example: Update for a specific floor plan
UPDATE floor_plans
SET
  original_width = 2000,  -- Replace with actual width
  original_height = 1500  -- Replace with actual height
WHERE id = '[floor-plan-id]';
```

---

## Step 4: Ensure Future Uploads Include Dimensions

When implementing floor plan upload functionality, use the `getImageDimensions` utility:

```typescript
import { getImageDimensions } from '@/utils/imageUtils';
import { supabase } from '@/integrations/supabase/client';

async function uploadFloorPlan(file: File, displayName: string) {
  // Get image dimensions BEFORE uploading
  const { width, height } = await getImageDimensions(file);

  // Upload image to storage
  const fileName = `${Date.now()}_${file.name}`;
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('floor-plans')
    .upload(fileName, file);

  if (uploadError) throw uploadError;

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('floor-plans')
    .getPublicUrl(fileName);

  // Insert floor plan WITH dimensions
  const { error: insertError } = await supabase
    .from('floor_plans')
    .insert({
      display_name: displayName,
      image_url: publicUrl,
      original_width: width,      // ✅ Critical!
      original_height: height,    // ✅ Critical!
      display_order: 0
    });

  if (insertError) throw insertError;
}
```

---

## Step 5: Verify the Fix

After running the Edge Function or manual updates:

1. **Check the database:**
```sql
SELECT
  id,
  display_name,
  original_width,
  original_height
FROM floor_plans
ORDER BY display_order;
```

All floor plans should now have `original_width` and `original_height` values.

2. **Test marker placement:**
- Go to a signage spot detail page
- Click "Add to Floor Plan"
- Try placing a line or point marker
- The placement should now work correctly
- Console warning should be gone

3. **Check console:**
The warning `⚠ Floor plan missing dimensions, using defaults (1920x1080)` should no longer appear.

---

## Expected Results

After completing these steps:
- ✅ All existing floor plans have correct dimensions
- ✅ Marker placement works correctly
- ✅ Markers appear in correct colors (green, grey, red, amber, blue)
- ✅ Cursor shows pointer (finger) in view mode
- ✅ Line markers have white outlines for visibility
- ✅ No console warnings about missing dimensions
- ✅ Future floor plan uploads will automatically include dimensions

---

## Troubleshooting

### If markers still don't place correctly:
1. Check browser console for errors
2. Verify floor plan dimensions are set:
   ```sql
   SELECT * FROM floor_plans WHERE original_width IS NULL OR original_height IS NULL;
   ```
3. Check if the floor plan image URL is accessible
4. Try the Edge Function again

### If the Edge Function fails:
- Check the function logs in Supabase Dashboard
- Verify the floor plan `image_url` fields are accessible URLs
- Fall back to manual SQL updates (see Option C above)

### If you need help:
The Edge Function is located at: `supabase/functions/fix-floor-plan-dimensions/index.ts`
It supports PNG, JPEG, GIF, and WebP formats.

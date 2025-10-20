import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Auto-promote scheduled images job started');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const today = new Date().toISOString().split('T')[0];

    // Get all planned images scheduled for today or earlier with auto_promote = true
    const { data: plannedImages, error: fetchError } = await supabase
      .from('photo_history')
      .select('*')
      .eq('image_type', 'planned')
      .eq('auto_promote', true)
      .eq('approval_status', 'approved')
      .lte('scheduled_date', today);

    if (fetchError) {
      console.error('Error fetching planned images:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${plannedImages?.length || 0} images to auto-promote`);

    if (!plannedImages || plannedImages.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No images to promote',
          promoted: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let promotedCount = 0;
    const errors: string[] = [];

    // Promote each image
    for (const image of plannedImages) {
      try {
        // Call the promote function
        const { data, error } = await supabase.rpc('promote_planned_to_current', {
          p_photo_id: image.id,
          p_promoted_by: '00000000-0000-0000-0000-000000000000' // System user
        });

        if (error) {
          console.error(`Error promoting image ${image.id}:`, error);
          errors.push(`${image.id}: ${error.message}`);
        } else {
          promotedCount++;
          console.log(`Successfully promoted image ${image.id} for spot ${image.signage_spot_id}`);
        }
      } catch (err: any) {
        console.error(`Exception promoting image ${image.id}:`, err);
        errors.push(`${image.id}: ${err.message}`);
      }
    }

    console.log(`Auto-promotion complete. Promoted: ${promotedCount}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        promoted: promotedCount,
        errors: errors.length > 0 ? errors : undefined,
        total_processed: plannedImages.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Auto-promote error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

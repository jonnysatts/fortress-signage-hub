import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate cron secret for scheduled function security
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret !== Deno.env.get('CRON_SECRET')) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting signage status update job...');

    const today = new Date().toISOString().split('T')[0];
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const expiringThreshold = sevenDaysFromNow.toISOString().split('T')[0];

    let updatedToOverdue = 0;
    let updatedToExpiring = 0;
    let updatedToCurrent = 0;

    // Get all signage spots with expiry dates
    const { data: allSpots, error: fetchError } = await supabase
      .from('signage_spots')
      .select('id, status, expiry_date, last_update_date')
      .not('expiry_date', 'is', null);

    if (fetchError) {
      console.error('Error fetching signage spots:', fetchError);
      throw fetchError;
    }

    console.log(`Processing ${allSpots?.length || 0} signage spots with expiry dates`);

    if (!allSpots || allSpots.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No signage spots to update',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process each spot
    for (const spot of allSpots) {
      let newStatus = spot.status;

      // Determine new status based on expiry date
      if (spot.expiry_date < today) {
        newStatus = 'overdue';
      } else if (spot.expiry_date <= expiringThreshold && spot.expiry_date >= today) {
        newStatus = 'expiring_soon';
      } else if (spot.expiry_date > expiringThreshold) {
        // Only set to current if it was expiring/overdue before
        if (spot.status === 'expiring_soon' || spot.status === 'overdue') {
          newStatus = 'current';
        }
      }

      // Update if status changed
      if (newStatus !== spot.status) {
        const { error: updateError } = await supabase
          .from('signage_spots')
          .update({ status: newStatus })
          .eq('id', spot.id);

        if (updateError) {
          console.error(`Error updating spot ${spot.id}:`, updateError);
        } else {
          console.log(`Updated spot ${spot.id}: ${spot.status} -> ${newStatus}`);
          
          if (newStatus === 'overdue') updatedToOverdue++;
          else if (newStatus === 'expiring_soon') updatedToExpiring++;
          else if (newStatus === 'current') updatedToCurrent++;
        }
      }
    }

    const totalUpdated = updatedToOverdue + updatedToExpiring + updatedToCurrent;

    console.log(`Status update completed. Updated ${totalUpdated} signage spots.`);
    console.log(`- Overdue: ${updatedToOverdue}`);
    console.log(`- Expiring Soon: ${updatedToExpiring}`);
    console.log(`- Current: ${updatedToCurrent}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${allSpots.length} signage spots, updated ${totalUpdated}`,
        spotsProcessed: allSpots.length,
        updates: {
          overdue: updatedToOverdue,
          expiring: updatedToExpiring,
          current: updatedToCurrent,
          total: totalUpdated
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Signage status update error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

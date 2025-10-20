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

    console.log('Starting campaign status update job...');

    const today = new Date().toISOString().split('T')[0];

    // Find campaigns that have ended (end_date < today) and are still active
    const { data: endedCampaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id, name, end_date')
      .eq('is_active', true)
      .lt('end_date', today);

    if (campaignsError) {
      console.error('Error fetching campaigns:', campaignsError);
      throw campaignsError;
    }

    console.log(`Found ${endedCampaigns?.length || 0} ended campaigns`);

    if (!endedCampaigns || endedCampaigns.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No campaigns to update',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let updatedSpots = 0;

    for (const campaign of endedCampaigns) {
      console.log(`Processing campaign: ${campaign.name} (${campaign.id})`);

      // Get all signage spots linked to this campaign
      const { data: linkedSpots, error: spotsError } = await supabase
        .from('signage_campaigns')
        .select('signage_spot_id, signage_spots(status)')
        .eq('campaign_id', campaign.id);

      if (spotsError) {
        console.error(`Error fetching spots for campaign ${campaign.id}:`, spotsError);
        continue;
      }

      console.log(`Found ${linkedSpots?.length || 0} linked spots for campaign ${campaign.name}`);

      // Update all linked signage spots to "overdue" if they're currently "current"
      if (linkedSpots && linkedSpots.length > 0) {
        const spotIds = linkedSpots
          .filter((ls: any) => ls.signage_spots?.status === 'current')
          .map((ls: any) => ls.signage_spot_id);

        if (spotIds.length > 0) {
          const { error: updateError } = await supabase
            .from('signage_spots')
            .update({ status: 'overdue' })
            .in('id', spotIds);

          if (updateError) {
            console.error(`Error updating spots for campaign ${campaign.id}:`, updateError);
          } else {
            console.log(`Updated ${spotIds.length} spots to overdue for campaign ${campaign.name}`);
            updatedSpots += spotIds.length;
          }
        }
      }

      // Mark campaign as inactive
      const { error: campaignUpdateError } = await supabase
        .from('campaigns')
        .update({ is_active: false })
        .eq('id', campaign.id);

      if (campaignUpdateError) {
        console.error(`Error updating campaign ${campaign.id}:`, campaignUpdateError);
      } else {
        console.log(`Marked campaign ${campaign.name} as inactive`);
      }
    }

    console.log(`Campaign status update completed. Updated ${updatedSpots} signage spots.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${endedCampaigns.length} campaigns, updated ${updatedSpots} signage spots`,
        campaignsProcessed: endedCampaigns.length,
        spotsUpdated: updatedSpots
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Campaign update error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

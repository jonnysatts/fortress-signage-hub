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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const today = new Date();
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(today.getDate() + 3);

    // Find print jobs due within 3 days that aren't ready yet
    const { data: urgentJobs, error } = await supabase
      .from('photo_history')
      .select(`
        *,
        signage_spots (
          location_name,
          assigned_user_id,
          venues (name)
        )
      `)
      .in('print_status', ['pending', 'ordered', 'in_production'])
      .lte('print_due_date', threeDaysFromNow.toISOString().split('T')[0])
      .not('print_due_date', 'is', null);

    if (error) throw error;

    console.log(`Found ${urgentJobs?.length || 0} urgent print jobs`);

    // Send reminders for each job
    for (const job of urgentJobs || []) {
      console.log(`Reminder: Print job for ${job.signage_spots?.location_name} due ${job.print_due_date}`);
      
      // Log activity
      await supabase.from('activity_log').insert({
        action_type: 'alert',
        signage_spot_id: job.signage_spot_id,
        action_details: {
          type: 'print_job_reminder',
          print_due_date: job.print_due_date,
          print_vendor: job.print_vendor,
          status: job.print_status
        }
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        reminders_sent: urgentJobs?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Print job reminders error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

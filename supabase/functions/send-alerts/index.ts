import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AlertEvent {
  type: 'overdue' | 'expiring_soon' | 'empty_too_long' | 'campaign_ended';
  signage_spot_id?: string;
  campaign_id?: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Alert function triggered');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get alert settings
    const { data: alertSettings, error: settingsError } = await supabase
      .from('alert_settings')
      .select('*')
      .eq('enabled', true);

    if (settingsError) {
      console.error('Error fetching alert settings:', settingsError);
      throw settingsError;
    }

    console.log(`Found ${alertSettings?.length || 0} enabled alert settings`);

    // Check for overdue signage
    const { data: overdueSpots, error: overdueError } = await supabase
      .from('signage_spots')
      .select('*, venues(*)')
      .eq('status', 'overdue');

    if (overdueError) {
      console.error('Error fetching overdue spots:', overdueError);
    }

    // Check for expiring soon signage
    const { data: expiringSpots, error: expiringError } = await supabase
      .from('signage_spots')
      .select('*, venues(*)')
      .eq('status', 'expiring_soon');

    if (expiringError) {
      console.error('Error fetching expiring spots:', expiringError);
    }

    // Check for empty spots that have been empty for too long (30+ days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: emptySpots, error: emptyError } = await supabase
      .from('signage_spots')
      .select('*, venues(*)')
      .eq('status', 'empty')
      .lt('updated_at', thirtyDaysAgo.toISOString());

    if (emptyError) {
      console.error('Error fetching empty spots:', emptyError);
    }

    const alerts: AlertEvent[] = [];

    // Generate alerts for overdue signage
    if (overdueSpots && overdueSpots.length > 0) {
      const overdueAlert = alertSettings?.find(s => s.alert_type === 'overdue_signage');
      if (overdueAlert) {
        alerts.push({
          type: 'overdue',
          message: `${overdueSpots.length} signage spot(s) are overdue for updates`,
          severity: 'critical',
        });
        
        // Log individual spots
        overdueSpots.forEach(spot => {
          console.log(`Overdue: ${spot.location_name} at ${spot.venues?.name}`);
        });
      }
    }

    // Generate alerts for expiring signage
    if (expiringSpots && expiringSpots.length > 0) {
      const expiringAlert = alertSettings?.find(s => s.alert_type === 'expiring_soon');
      if (expiringAlert) {
        alerts.push({
          type: 'expiring_soon',
          message: `${expiringSpots.length} signage spot(s) expiring soon`,
          severity: 'warning',
        });
        
        expiringSpots.forEach(spot => {
          console.log(`Expiring soon: ${spot.location_name} at ${spot.venues?.name}`);
        });
      }
    }

    // Generate alerts for empty spots
    if (emptySpots && emptySpots.length > 0) {
      const emptyAlert = alertSettings?.find(s => s.alert_type === 'empty_signage');
      if (emptyAlert) {
        alerts.push({
          type: 'empty_too_long',
          message: `${emptySpots.length} signage spot(s) have been empty for 30+ days`,
          severity: 'warning',
        });
        
        emptySpots.forEach(spot => {
          console.log(`Empty too long: ${spot.location_name} at ${spot.venues?.name}`);
        });
      }
    }

    // Send notifications for each alert
    for (const alert of alerts) {
      // Find the relevant alert setting
      const setting = alertSettings?.find(s => {
        if (alert.type === 'overdue') return s.alert_type === 'overdue_signage';
        if (alert.type === 'expiring_soon') return s.alert_type === 'expiring_soon';
        if (alert.type === 'empty_too_long') return s.alert_type === 'empty_signage';
        return false;
      });

      if (!setting) continue;

      // Send email notifications
      if (setting.email_recipients && setting.email_recipients.length > 0) {
        console.log(`Would send email to: ${setting.email_recipients.join(', ')}`);
        console.log(`Subject: [${alert.severity.toUpperCase()}] ${alert.message}`);
        // TODO: Integrate with email service (e.g., Resend, SendGrid)
      }

      // Send Slack notifications
      if (setting.slack_webhook_url) {
        try {
          const slackPayload = {
            text: `*${alert.severity.toUpperCase()}*: ${alert.message}`,
            attachments: [{
              color: alert.severity === 'critical' ? 'danger' : 'warning',
              text: alert.message,
              footer: 'Fortress Signage Management',
              ts: Math.floor(Date.now() / 1000),
            }],
          };

          const slackResponse = await fetch(setting.slack_webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(slackPayload),
          });

          if (!slackResponse.ok) {
            console.error('Failed to send Slack notification:', await slackResponse.text());
          } else {
            console.log('Slack notification sent successfully');
          }
        } catch (slackError) {
          console.error('Error sending Slack notification:', slackError);
        }
      }

      // Log alert to activity_log
      await supabase.from('activity_log').insert({
        action_type: 'alert',
        action_details: {
          alert_type: alert.type,
          message: alert.message,
          severity: alert.severity,
        },
      });
    }

    console.log(`Processed ${alerts.length} alerts`);

    return new Response(
      JSON.stringify({
        success: true,
        alerts_sent: alerts.length,
        overdue_count: overdueSpots?.length || 0,
        expiring_count: expiringSpots?.length || 0,
        empty_count: emptySpots?.length || 0,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in alert function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

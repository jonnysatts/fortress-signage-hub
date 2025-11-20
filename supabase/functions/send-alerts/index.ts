import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';
import { Resend } from 'https://esm.sh/resend@2.0.0';

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
  spots?: any[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
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
    
    const { data: emptySpots, error: emptyError} = await supabase
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
        // Filter by venue if configured
        const filteredSpots = overdueAlert.venue_filter && overdueAlert.venue_filter.length > 0
          ? overdueSpots.filter(spot => overdueAlert.venue_filter.includes(spot.venues?.name))
          : overdueSpots;

        if (filteredSpots.length > 0) {
          alerts.push({
            type: 'overdue',
            message: `${filteredSpots.length} signage spot(s) are overdue for updates`,
            severity: 'critical',
            spots: filteredSpots,
          });
        }
      }
    }

    // Generate alerts for expiring signage
    if (expiringSpots && expiringSpots.length > 0) {
      const expiringAlert = alertSettings?.find(s => s.alert_type === 'expiring_soon');
      if (expiringAlert) {
        const filteredSpots = expiringAlert.venue_filter && expiringAlert.venue_filter.length > 0
          ? expiringSpots.filter(spot => expiringAlert.venue_filter.includes(spot.venues?.name))
          : expiringSpots;

        if (filteredSpots.length > 0) {
          alerts.push({
            type: 'expiring_soon',
            message: `${filteredSpots.length} signage spot(s) expiring soon`,
            severity: 'warning',
            spots: filteredSpots,
          });
        }
      }
    }

    // Generate alerts for empty spots
    if (emptySpots && emptySpots.length > 0) {
      const emptyAlert = alertSettings?.find(s => s.alert_type === 'empty_signage');
      if (emptyAlert) {
        const filteredSpots = emptyAlert.venue_filter && emptyAlert.venue_filter.length > 0
          ? emptySpots.filter(spot => emptyAlert.venue_filter.includes(spot.venues?.name))
          : emptySpots;

        if (filteredSpots.length > 0) {
          alerts.push({
            type: 'empty_too_long',
            message: `${filteredSpots.length} signage spot(s) have been empty for 30+ days`,
            severity: 'warning',
            spots: filteredSpots,
          });
        }
      }
    }

    console.log(`Generated ${alerts.length} alerts`);

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

      // Check if we should skip based on alert_once setting
      if (setting.alert_once && alert.spots) {
        const spotIds = alert.spots.map(s => s.id);
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        const { data: recentAlerts } = await supabase
          .from('alert_history')
          .select('signage_spot_id')
          .eq('alert_type', setting.alert_type)
          .in('signage_spot_id', spotIds)
          .gt('sent_at', twentyFourHoursAgo.toISOString());

        const alreadyAlertedIds = new Set(recentAlerts?.map(a => a.signage_spot_id) || []);
        alert.spots = alert.spots.filter(spot => !alreadyAlertedIds.has(spot.id));

        if (alert.spots.length === 0) {
          console.log(`Skipping ${setting.alert_type} - all spots already alerted in last 24h`);
          continue;
        }

        alert.message = `${alert.spots.length} signage spot(s) ${alert.type === 'overdue' ? 'are overdue' : alert.type === 'expiring_soon' ? 'expiring soon' : 'empty for 30+ days'}`;
      }

      // Send email notifications
      if (setting.email_recipients && setting.email_recipients.length > 0) {
        const resendApiKey = Deno.env.get('RESEND_API_KEY');
        
        if (resendApiKey) {
          try {
            const resend = new Resend(resendApiKey);
            
            const spotsHtml = alert.spots?.slice(0, 10).map(spot => `
              <div style="background: #F9FAFB; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid ${alert.severity === 'critical' ? '#EF4444' : '#F59E0B'};">
                <strong style="color: #111827;">${spot.location_name}</strong> at ${spot.venues?.name}<br>
                <span style="color: #6B7280; font-size: 14px;">
                  ${spot.last_update_date ? `Last updated: ${spot.last_update_date}` : 'Never updated'}
                </span>
              </div>
            `).join('') || '';

            const emailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #111827; border-bottom: 3px solid ${alert.severity === 'critical' ? '#EF4444' : '#F59E0B'}; padding-bottom: 15px;">
                  ${alert.severity === 'critical' ? '🚨' : '⚠️'} ${alert.message.toUpperCase()}
                </h1>
                <div style="background: ${alert.severity === 'critical' ? '#FEE2E2' : '#FEF3C7'}; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <p style="color: #111827; font-size: 16px; margin: 0;">
                    <strong>Alert Type:</strong> ${setting.alert_type.replace(/_/g, ' ')}<br>
                    <strong>Severity:</strong> ${alert.severity.toUpperCase()}<br>
                    <strong>Affected Spots:</strong> ${alert.spots?.length || 0}
                  </p>
                </div>
                ${spotsHtml}
                ${alert.spots && alert.spots.length > 10 ? `<p style="color: #6B7280; font-style: italic;">...and ${alert.spots.length - 10} more</p>` : ''}
                <p style="color: #6B7280; font-size: 14px; margin-top: 30px; border-top: 1px solid #E5E7EB; padding-top: 15px;">
                  Sent at ${new Date().toLocaleString()}<br>
                  Fortress Signage Manager
                </p>
              </div>
            `;

            const { error: emailError } = await resend.emails.send({
              from: 'Fortress Signage Manager <alerts@resend.dev>',
              to: setting.email_recipients,
              subject: `[${alert.severity.toUpperCase()}] ${alert.message}`,
              html: emailHtml,
            });

            if (emailError) {
              console.error('Email send error:', emailError);
            } else {
              console.log(`Email sent to: ${setting.email_recipients.join(', ')}`);
            }
          } catch (error: any) {
            console.error('Email error:', error);
          }
        } else {
          console.log('Resend API key not configured, skipping email');
        }
      }

      // Send Slack notifications using environment variable
      const slackWebhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');
      if (slackWebhookUrl) {
        try {
          // Fetch users to mention based on severity
          const { data: mentionSettings } = await supabase
            .from('slack_mention_settings')
            .select('*');
          
          const usersToMention = mentionSettings?.filter(setting => {
            if (!setting.mention_for_severities.includes(alert.severity)) {
              return false;
            }
            
            // If there are spots, filter by venue
            if (alert.spots && alert.spots.length > 0) {
              return setting.venues.some((venue: string) => 
                alert.spots!.some((spot: any) => spot.venues?.name === venue)
              );
            }
            
            return true;
          }) || [];
          
          const mentions = usersToMention.length > 0 
            ? usersToMention.map(u => `<@${u.slack_user_id}>`).join(' ') + ' '
            : '';
          
          // Build detailed blocks with images for each spot
          const blocks: any[] = [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `${alert.severity.toUpperCase()}: ${alert.message}`,
                emoji: true
              }
            }
          ];

          if (alert.spots && alert.spots.length > 0) {
            // Limit to first 5 spots to avoid message size limits
            const spotsToShow = alert.spots.slice(0, 5);
            
            spotsToShow.forEach((spot, index) => {
              const daysInfo = spot.last_update_date 
                ? `Last updated: ${spot.last_update_date}`
                : 'Never updated';
              
              blocks.push({
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*${spot.location_name}* at ${spot.venues?.name}\n${daysInfo}`
                },
                ...(spot.current_image_url && {
                  accessory: {
                    type: 'image',
                    image_url: spot.current_image_url,
                    alt_text: spot.location_name
                  }
                })
              });

              if (index < spotsToShow.length - 1) {
                blocks.push({ type: 'divider' });
              }
            });

            if (alert.spots.length > 5) {
              blocks.push({
                type: 'context',
                elements: [{
                  type: 'mrkdwn',
                  text: `_...and ${alert.spots.length - 5} more spots_`
                }]
              });
            }
          }

          blocks.push({
            type: 'context',
            elements: [{
              type: 'mrkdwn',
              text: `Alert sent at ${new Date().toLocaleString()}`
            }]
          });

          const slackMessage = {
            text: `${mentions}${alert.message}`,
            blocks
          };

          const slackResponse = await fetch(slackWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(slackMessage),
          });

          if (!slackResponse.ok) {
            console.error('Slack notification failed:', await slackResponse.text());
          } else {
            console.log('Slack notification sent successfully');
          }
        } catch (error: any) {
          console.error('Slack error:', error);
        }
      }

      // Record in alert history
      if (alert.spots) {
        const historyRecords = alert.spots.map(spot => ({
          alert_type: setting.alert_type,
          severity: alert.severity,
          signage_spot_id: spot.id,
          message: alert.message,
        }));

        await supabase.from('alert_history').insert(historyRecords);
      }
    }

    // Update last_run for all enabled settings
    const now = new Date().toISOString();
    for (const setting of alertSettings || []) {
      await supabase
        .from('alert_settings')
        .update({ last_run: now })
        .eq('id', setting.id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        alerts_sent: alerts.length,
        timestamp: now
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Alert function error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

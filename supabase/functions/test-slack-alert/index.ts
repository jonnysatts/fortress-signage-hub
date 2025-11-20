import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestAlertRequest {
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { severity, message }: TestAlertRequest = await req.json();

    // Get sample signage spots with images for demonstration
    const { data: sampleSpots } = await supabase
      .from('signage_spots')
      .select('id, location_name, current_image_url, last_update_date, venues(name)')
      .not('current_image_url', 'is', null)
      .limit(3);

    // Get Slack webhook URL from environment
    const slackWebhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');
    
    if (!slackWebhookUrl) {
      throw new Error('SLACK_WEBHOOK_URL not configured');
    }

    // Fetch users to mention based on severity
    const { data: mentionSettings, error: mentionError } = await supabase
      .from('slack_mention_settings')
      .select('*');
    
    if (mentionError) {
      console.error('Error fetching mention settings:', mentionError);
    }

    const usersToMention = mentionSettings?.filter(setting => 
      setting.mention_for_severities.includes(severity)
    ) || [];
    
    const mentions = usersToMention.length > 0 
      ? usersToMention.map(u => `<@${u.slack_user_id}>`).join(' ') + ' '
      : '';
    
    // Build blocks with sample spots
    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `TEST ALERT - ${severity.toUpperCase()}: ${message}`,
          emoji: true
        }
      }
    ];

    if (sampleSpots && sampleSpots.length > 0) {
      sampleSpots.forEach((spot: any, index: number) => {
        const daysInfo = spot.last_update_date 
          ? `Last updated: ${spot.last_update_date}`
          : 'Never updated';
        
        const venueName = spot.venues && typeof spot.venues === 'object' && !Array.isArray(spot.venues) 
          ? spot.venues.name 
          : 'Unknown Venue';
        
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${spot.location_name}* at ${venueName}\n${daysInfo}`
          },
          ...(spot.current_image_url && {
            accessory: {
              type: 'image',
              image_url: spot.current_image_url,
              alt_text: spot.location_name
            }
          })
        });

        if (index < sampleSpots.length - 1) {
          blocks.push({ type: 'divider' });
        }
      });
    } else {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: message
        }
      });
    }

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Fortress Signage Management (Test) | ${new Date().toLocaleString()}`
        }
      ]
    });
    
    const slackPayload = {
      text: `${mentions}TEST ALERT - ${severity.toUpperCase()}: ${message}`,
      blocks: blocks
    };

    const slackResponse = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload),
    });

    if (!slackResponse.ok) {
      const errorText = await slackResponse.text();
      console.error('Failed to send Slack notification:', errorText);
      throw new Error(`Slack API error: ${errorText}`);
    }

    console.log('Test Slack notification sent successfully');

    // Log activity
    await supabase.from('activity_log').insert({
      action_type: 'alert',
      action_details: {
        alert_type: 'test',
        message: message,
        severity: severity,
        mentions: usersToMention.map(u => u.user_name),
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Test alert sent successfully',
        mentioned_users: usersToMention.map(u => u.user_name),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in test-slack-alert function:', error);
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

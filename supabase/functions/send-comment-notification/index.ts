import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CommentNotificationRequest {
  comment_id: string;
  signage_spot_id: string;
  body: string;
  author_id: string;
  mentions: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { comment_id, signage_spot_id, body, author_id, mentions }: CommentNotificationRequest = await req.json();

    // Get author details
    const { data: author } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', author_id)
      .single();

    // Get signage spot details
    const { data: spot } = await supabase
      .from('signage_spots')
      .select('location_name, current_image_url, venues(name)')
      .eq('id', signage_spot_id)
      .single();

    if (!spot) {
      throw new Error('Signage spot not found');
    }

    // Get mentioned users' Slack IDs
    const { data: mentionedUsers } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', mentions);

    const { data: slackSettings } = await supabase
      .from('slack_mention_settings')
      .select('*');

    // Match Supabase user IDs to Slack IDs
    const slackMentions = mentionedUsers
      ?.map(user => {
        const setting = slackSettings?.find(s => s.user_name === user.full_name);
        return setting ? `<@${setting.slack_user_id}>` : null;
      })
      .filter(Boolean)
      .join(' ') || '';

    const slackWebhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');
    
    if (!slackWebhookUrl) {
      console.log('No Slack webhook configured, skipping notification');
      return new Response(
        JSON.stringify({ success: true, message: 'No Slack webhook configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const venueName = spot.venues && typeof spot.venues === 'object' && !Array.isArray(spot.venues) && 'name' in spot.venues
      ? (spot.venues as any).name
      : 'Unknown Venue';

    // Use custom app URL from env, or construct from Supabase URL
    const appUrl = Deno.env.get('APP_URL') || 
      Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com') || '';
    const spotUrl = `${appUrl}/signage/${signage_spot_id}`;

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '💬 New Comment',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${slackMentions ? slackMentions + '\n' : ''}*${author?.full_name || 'Someone'}* commented on *${spot.location_name}* at ${venueName}:`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `> ${body}`
        },
        ...(spot.current_image_url && {
          accessory: {
            type: 'image',
            image_url: spot.current_image_url,
            alt_text: spot.location_name
          }
        })
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Signage Spot',
              emoji: true
            },
            url: spotUrl,
            style: 'primary'
          }
        ]
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Fortress Signage Management | ${new Date().toLocaleString()}`
          }
        ]
      }
    ];

    const slackResponse = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `${slackMentions}New comment from ${author?.full_name || 'Someone'} on ${spot.location_name}`,
        blocks
      }),
    });

    if (!slackResponse.ok) {
      console.error('Failed to send Slack notification:', await slackResponse.text());
      throw new Error('Failed to send Slack notification');
    }

    console.log('Comment notification sent successfully');

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in send-comment-notification:', error);
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

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
  resolved?: boolean;
  resolved_by?: string;
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

    const { comment_id, signage_spot_id, body, author_id, mentions, resolved, resolved_by }: CommentNotificationRequest = await req.json();

    // Get author details
    const { data: author } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', author_id)
      .single();

    // Get resolver details if this is a resolution notification
    let resolver = null;
    if (resolved && resolved_by) {
      const { data: resolverData } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', resolved_by)
        .single();
      resolver = resolverData;
    }

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

    console.log('Mentioned user IDs:', mentions);
    console.log('Mentioned users from profiles:', mentionedUsers);

    const { data: slackSettings } = await supabase
      .from('slack_mention_settings')
      .select('*');

    console.log('Slack settings:', slackSettings);

    // Match Supabase user IDs to Slack IDs
    const slackMentions = mentionedUsers
      ?.map(user => {
        const setting = slackSettings?.find(s => s.user_name === user.full_name);
        const rawSlackId = setting?.slack_user_id;
        // Support both raw IDs (U123...) and preformatted mentions like <@U123> or @handle
        let mention: string | null = null;
        if (rawSlackId) {
          if (rawSlackId.startsWith('<@') && rawSlackId.endsWith('>')) {
            mention = rawSlackId; // already in correct format
          } else if (rawSlackId.startsWith('U')) {
            mention = `<@${rawSlackId}>`; // user ID, wrap it
          } else if (rawSlackId.startsWith('@')) {
            mention = rawSlackId; // handle-style mention, send as-is
          } else {
            // Fallback: try treating it as a handle
            mention = `@${rawSlackId}`;
          }
        }
        console.log(`Matching ${user.full_name} to Slack identifier:`, rawSlackId, '-> mention token:', mention);
        return mention;
      })
      .filter(Boolean)
      .join(' ') || '';

    console.log('Final Slack mentions string:', slackMentions);

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

    // Build blocks based on whether this is a report or resolution
    const blocks = resolved ? [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '✅ Issue Resolved',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${slackMentions ? slackMentions + '\n' : ''}*${resolver?.full_name || 'Someone'}* resolved an issue on *${spot.location_name}* at ${venueName}:`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `> ${body}\n\n_Issue has been marked as resolved._`
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
              text: 'View Details',
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
    ] : [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚨 Issue Reported',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${slackMentions ? slackMentions + '\n' : ''}*${author?.full_name || 'Someone'}* reported an issue on *${spot.location_name}* at ${venueName}:`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `> ${body}\n\n_This requires your attention and resolution._`
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
              text: 'View & Resolve Issue',
              emoji: true
            },
            url: spotUrl,
            style: 'danger'
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

    const slackText = resolved 
      ? `${slackMentions}Issue resolved by ${resolver?.full_name || 'Someone'} on ${spot.location_name}`
      : `${slackMentions}New issue reported by ${author?.full_name || 'Someone'} on ${spot.location_name}`;

    const slackResponse = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: slackText,
        blocks,
        link_names: 1 // ensure Slack resolves @mentions in text
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

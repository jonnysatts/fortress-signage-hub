import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestAlertRequest {
  alert_type: string;
  send_email: boolean;
  send_slack: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { alert_type, send_email, send_slack }: TestAlertRequest = await req.json();

    console.log(`Testing alert type: ${alert_type}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get alert settings
    const { data: setting, error: settingError } = await supabase
      .from('alert_settings')
      .select('*')
      .eq('alert_type', alert_type)
      .single();

    if (settingError) {
      throw new Error(`Failed to fetch alert settings: ${settingError.message}`);
    }

    const results: any = { slack: null, email: null };

    // Test Slack notification
    if (send_slack) {
      const slackWebhookUrl = setting.slack_webhook_url || Deno.env.get('SLACK_WEBHOOK_URL');
      
      if (!slackWebhookUrl) {
        results.slack = { success: false, error: 'No Slack webhook URL configured' };
      } else {
        try {
          const testMessage = {
            text: `🧪 Test Alert: ${alert_type}`,
            blocks: [
              {
                type: 'header',
                text: {
                  type: 'plain_text',
                  text: `🧪 Test Alert: ${alert_type.replace(/_/g, ' ').toUpperCase()}`,
                  emoji: true
                }
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `This is a test notification from the Fortress Signage Manager alert system.\n\n*Alert Type:* ${alert_type}\n*Status:* Working correctly ✅`
                }
              },
              {
                type: 'context',
                elements: [
                  {
                    type: 'mrkdwn',
                    text: `Sent at ${new Date().toISOString()}`
                  }
                ]
              }
            ]
          };

          const slackResponse = await fetch(slackWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testMessage),
          });

          if (!slackResponse.ok) {
            throw new Error(`Slack API error: ${slackResponse.statusText}`);
          }

          results.slack = { success: true, message: 'Test Slack notification sent' };
        } catch (error: any) {
          results.slack = { success: false, error: error.message };
        }
      }
    }

    // Test Email notification
    if (send_email) {
      const recipients = setting.email_recipients || [];
      
      if (recipients.length === 0) {
        results.email = { success: false, error: 'No email recipients configured' };
      } else {
        const resendApiKey = Deno.env.get('RESEND_API_KEY');
        
        if (!resendApiKey) {
          results.email = { success: false, error: 'Resend API key not configured' };
        } else {
          try {
            const resend = new Resend(resendApiKey);

            const emailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #333; border-bottom: 2px solid #4F46E5; padding-bottom: 10px;">
                  🧪 Test Alert
                </h1>
                <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h2 style="color: #4F46E5; margin-top: 0;">
                    ${alert_type.replace(/_/g, ' ').toUpperCase()}
                  </h2>
                  <p style="color: #666; font-size: 16px;">
                    This is a test notification from the Fortress Signage Manager alert system.
                  </p>
                  <p style="color: #666;">
                    <strong>Alert Type:</strong> ${alert_type}<br>
                    <strong>Status:</strong> <span style="color: #10B981;">Working correctly ✅</span>
                  </p>
                </div>
                <p style="color: #999; font-size: 12px; border-top: 1px solid #E5E7EB; padding-top: 10px;">
                  Sent at ${new Date().toLocaleString()}
                </p>
              </div>
            `;

            const { error: emailError } = await resend.emails.send({
              from: 'Fortress Signage Manager <alerts@resend.dev>',
              to: recipients,
              subject: `🧪 Test Alert: ${alert_type.replace(/_/g, ' ')}`,
              html: emailHtml,
            });

            if (emailError) {
              throw emailError;
            }

            results.email = { 
              success: true, 
              message: `Test email sent to ${recipients.length} recipient(s)`,
              recipients: recipients
            };
          } catch (error: any) {
            results.email = { success: false, error: error.message };
          }
        }
      }
    }

    console.log('Test results:', JSON.stringify(results, null, 2));

    return new Response(
      JSON.stringify({ 
        success: true,
        results,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Test alert error:', error);
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

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Bell, Save } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [alertSettings, setAlertSettings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    checkAuth();
    fetchAlertSettings();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUser(session.user);

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id);

    const roleList = roles?.map(r => r.role) || [];
    const effectiveRole = roleList.includes('admin') ? 'admin' : roleList.includes('manager') ? 'manager' : 'staff';
    setUserRole(effectiveRole);
  };

  const fetchAlertSettings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('alert_settings')
        .select('*')
        .order('alert_type');

      if (error) throw error;

      // Ensure we have settings for all alert types
      const alertTypes = ['overdue_signage', 'expiring_soon', 'empty_signage', 'campaign_ended'];
      const existingTypes = data?.map(s => s.alert_type) || [];
      
      const settings = [...(data || [])];
      
      // Create missing alert settings
      for (const type of alertTypes) {
        if (!existingTypes.includes(type)) {
          settings.push({
            id: `new-${type}`,
            alert_type: type,
            enabled: false,
            email_recipients: [],
            slack_webhook_url: null,
            alert_triggers: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }

      setAlertSettings(settings);
    } catch (error: any) {
      toast.error("Failed to load alert settings");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      for (const setting of alertSettings) {
        if (setting.id.startsWith('new-')) {
          // Insert new setting
          const { error } = await supabase
            .from('alert_settings')
            .insert({
              alert_type: setting.alert_type,
              enabled: setting.enabled,
              email_recipients: setting.email_recipients,
              slack_webhook_url: setting.slack_webhook_url,
              alert_triggers: setting.alert_triggers,
            });
          
          if (error) throw error;
        } else {
          // Update existing setting
          const { error } = await supabase
            .from('alert_settings')
            .update({
              enabled: setting.enabled,
              email_recipients: setting.email_recipients,
              slack_webhook_url: setting.slack_webhook_url,
              alert_triggers: setting.alert_triggers,
            })
            .eq('id', setting.id);
          
          if (error) throw error;
        }
      }

      toast.success("Alert settings saved successfully!");
      fetchAlertSettings();
    } catch (error: any) {
      toast.error("Failed to save settings: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = (index: number, field: string, value: any) => {
    const updated = [...alertSettings];
    updated[index] = { ...updated[index], [field]: value };
    setAlertSettings(updated);
  };

  const addEmailRecipient = (index: number, email: string) => {
    if (!email.trim()) return;
    const updated = [...alertSettings];
    const recipients = updated[index].email_recipients || [];
    if (!recipients.includes(email.trim())) {
      updated[index].email_recipients = [...recipients, email.trim()];
      setAlertSettings(updated);
    }
  };

  const removeEmailRecipient = (settingIndex: number, emailIndex: number) => {
    const updated = [...alertSettings];
    updated[settingIndex].email_recipients = updated[settingIndex].email_recipients.filter((_: string, i: number) => i !== emailIndex);
    setAlertSettings(updated);
  };

  const getAlertLabel = (type: string) => {
    switch (type) {
      case 'overdue_signage':
        return 'Overdue Signage Alerts';
      case 'expiring_soon':
        return 'Expiring Soon Alerts';
      case 'empty_signage':
        return 'Empty Signage Alerts';
      case 'campaign_ended':
        return 'Campaign Ended Alerts';
      default:
        return type;
    }
  };

  const canEdit = userRole === 'admin' || userRole === 'manager';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Configure alert notifications and system preferences
          </p>
        </div>

        <Tabs defaultValue="alerts">
          <TabsList>
            <TabsTrigger value="alerts">
              <Bell className="w-4 h-4 mr-2" />
              Alert Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="alerts" className="space-y-4">
            {alertSettings.map((setting, index) => (
              <Card key={setting.id || setting.alert_type}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{getAlertLabel(setting.alert_type)}</CardTitle>
                      <CardDescription>
                        Configure notifications for {setting.alert_type.replace('_', ' ')}
                      </CardDescription>
                    </div>
                    <Switch
                      checked={setting.enabled}
                      onCheckedChange={(checked) => updateSetting(index, 'enabled', checked)}
                      disabled={!canEdit}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Email Recipients</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add email address"
                        type="email"
                        disabled={!canEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            addEmailRecipient(index, e.currentTarget.value);
                            e.currentTarget.value = '';
                          }
                        }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {setting.email_recipients?.map((email: string, emailIndex: number) => (
                        <div key={emailIndex} className="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm">
                          <span>{email}</span>
                          {canEdit && (
                            <button
                              onClick={() => removeEmailRecipient(index, emailIndex)}
                              className="ml-1 hover:text-destructive"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Slack Webhook URL (Optional)</Label>
                    <Input
                      placeholder="https://hooks.slack.com/services/..."
                      value={setting.slack_webhook_url || ''}
                      onChange={(e) => updateSetting(index, 'slack_webhook_url', e.target.value)}
                      disabled={!canEdit}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}

            {canEdit && (
              <div className="flex justify-end">
                <Button onClick={handleSaveSettings} disabled={isSaving}>
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            )}

            {!canEdit && (
              <p className="text-sm text-muted-foreground text-center">
                Only admins and managers can modify alert settings
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

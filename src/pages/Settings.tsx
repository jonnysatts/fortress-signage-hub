import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Bell, Settings2, Users, Tags, MapPin } from "lucide-react";
import { toast } from "sonner";
import { UserManagementPanel } from "@/components/UserManagementPanel";
import { CategoryTagManagement } from "@/components/CategoryTagManagement";
import { SlackMentionManagement } from "@/components/SlackMentionManagement";
import { AlertSettingCard } from "@/components/AlertSettingCard";

type AlertSetting = Omit<Database['public']['Tables']['alert_settings']['Row'], 'slack_webhook_url'> & {
  slack_webhook_url?: string | null;
};

export default function Settings() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [alertSettings, setAlertSettings] = useState<AlertSetting[]>([]);
  const [venues, setVenues] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
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
  }, [navigate]);

  const fetchAlertSettings = useCallback(async () => {
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

      const settings: AlertSetting[] = [...(data || [])];

      // Create missing alert settings
      for (const type of alertTypes) {
        if (!existingTypes.includes(type)) {
          settings.push({
            id: `new-${type}`,
            alert_type: type,
            enabled: false,
            email_recipients: [],
            alert_triggers: {},
            cron_schedule: 'daily_9am',
            alert_once: true,
            venue_filter: [],
            last_run: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }

      setAlertSettings(settings);
    } catch (error: unknown) {
      toast.error("Failed to load alert settings");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
    fetchAlertSettings();
    
    // Fetch venues
    supabase.from('venues').select('name').then(({ data }) => {
      setVenues(data?.map(v => v.name) || []);
    });
  }, [checkAuth, fetchAlertSettings]);

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

        <Tabs defaultValue="alerts" className="space-y-4">
          <div className="relative">
            <TabsList className="w-full inline-flex overflow-x-auto overflow-y-hidden whitespace-nowrap scrollbar-hide md:grid md:grid-cols-5 gap-1">
              <TabsTrigger value="alerts" className="flex-shrink-0">
                <Bell className="w-4 h-4 md:mr-2" />
                <span className="hidden sm:inline">Alerts</span>
              </TabsTrigger>
              <TabsTrigger value="fields" className="flex-shrink-0">
                <Settings2 className="w-4 h-4 md:mr-2" />
                <span className="hidden sm:inline">Custom Fields</span>
              </TabsTrigger>
              <TabsTrigger value="floor-plans" className="flex-shrink-0">
                <MapPin className="w-4 h-4 md:mr-2" />
                <span className="hidden sm:inline">Floor Plans</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="flex-shrink-0">
                <Users className="w-4 h-4 md:mr-2" />
                <span className="hidden sm:inline">Users</span>
              </TabsTrigger>
              <TabsTrigger value="categories" className="flex-shrink-0">
                <Tags className="w-4 h-4 md:mr-2" />
                <span className="hidden sm:inline">Categories</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="alerts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Slack User Mentions</CardTitle>
                <CardDescription>
                  Configure which users should be @mentioned in Slack alerts based on severity
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <SlackMentionManagement canEdit={canEdit} />
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Alert Types</h3>
              {alertSettings.map((setting, index) => (
                <AlertSettingCard
                  key={setting.id || setting.alert_type}
                  setting={{
                    id: setting.id,
                    alert_type: setting.alert_type,
                    enabled: setting.enabled,
                    email_recipients: setting.email_recipients || [],
                    cron_schedule: setting.cron_schedule || 'daily_9am',
                    alert_once: setting.alert_once ?? true,
                    venue_filter: setting.venue_filter || [],
                    last_run: setting.last_run,
                  }}
                  venues={venues}
                  onUpdate={(updatedSetting) => {
                    const updated = [...alertSettings];
                    updated[index] = {
                      ...updated[index],
                      ...updatedSetting,
                    };
                    setAlertSettings(updated);
                  }}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="fields">
            <Card>
              <CardHeader>
                <CardTitle>Custom Fields Management</CardTitle>
                <CardDescription>
                  Define custom fields that can be added to signage spots
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => navigate('/custom-fields')}>
                  Manage Custom Fields
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="floor-plans">
            <Card>
              <CardHeader>
                <CardTitle>Floor Plan Management</CardTitle>
                <CardDescription>
                  Upload and manage venue floor plans with signage location markers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Floor plans allow you to visualize where signage is located in your venues. Upload floor plan images and place markers to show each signage spot's physical location.
                </p>
                {userRole === 'admin' ? (
                  <Button onClick={() => navigate('/floor-plans/manage')}>
                    <MapPin className="w-4 h-4 mr-2" />
                    Manage Floor Plans
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Only admins can upload and manage floor plans. <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/floor-plans')}>View floor plans</Button>
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <UserManagementPanel 
              currentUserId={user?.id || ''} 
              userRole={userRole || 'staff'} 
            />
          </TabsContent>

          <TabsContent value="categories">
            <CategoryTagManagement canEdit={canEdit} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

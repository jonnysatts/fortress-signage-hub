import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus, TestTube2, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AlertSetting {
  id: string;
  alert_type: string;
  enabled: boolean;
  email_recipients: string[];
  cron_schedule: string;
  alert_once: boolean;
  venue_filter: string[];
  last_run: string | null;
}

interface AlertSettingCardProps {
  setting: AlertSetting;
  venues: string[];
  onUpdate: (setting: AlertSetting) => void;
}

export function AlertSettingCard({ setting, venues, onUpdate }: AlertSettingCardProps) {
  const [newEmail, setNewEmail] = useState("");
  const [isTesting, setIsTesting] = useState(false);

  const getAlertInfo = (type: string) => {
    switch (type) {
      case 'overdue_signage':
        return {
          title: 'Overdue Signage',
          description: 'Alerts when content expires and needs replacement',
          severity: 'critical' as const,
        };
      case 'expiring_soon':
        return {
          title: 'Expiring Soon',
          description: 'Alerts when content is about to expire (within 7 days)',
          severity: 'warning' as const,
        };
      case 'empty_signage':
        return {
          title: 'Empty Signage',
          description: 'Alerts when spots have been empty for 30+ days',
          severity: 'warning' as const,
        };
      case 'campaign_ended':
        return {
          title: 'Campaign Ended',
          description: 'Alerts when a campaign reaches its end date',
          severity: 'info' as const,
        };
      default:
        return {
          title: type,
          description: '',
          severity: 'info' as const,
        };
    }
  };

  const alertInfo = getAlertInfo(setting.alert_type);

  const handleAddEmail = () => {
    if (!newEmail.trim()) return;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (setting.email_recipients.includes(newEmail.trim())) {
      toast.error("Email already added");
      return;
    }

    onUpdate({
      ...setting,
      email_recipients: [...setting.email_recipients, newEmail.trim()]
    });
    setNewEmail("");
  };

  const handleRemoveEmail = (email: string) => {
    onUpdate({
      ...setting,
      email_recipients: setting.email_recipients.filter(e => e !== email)
    });
  };

  const handleTestAlert = async () => {
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-alert', {
        body: {
          alert_type: setting.alert_type,
          send_email: setting.email_recipients.length > 0,
          send_slack: true,
        }
      });

      if (error) throw error;

      if (data.results.slack?.success || data.results.email?.success) {
        toast.success(`Test alert sent successfully!`);
      } else {
        const errors = [];
        if (data.results.slack?.error) errors.push(`Slack: ${data.results.slack.error}`);
        if (data.results.email?.error) errors.push(`Email: ${data.results.email.error}`);
        toast.error(`Test failed:\n${errors.join('\n')}`);
      }
    } catch (error: any) {
      toast.error(`Failed to send test alert: ${error.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleToggleVenue = (venue: string) => {
    const venues = setting.venue_filter || [];
    if (venues.includes(venue)) {
      onUpdate({
        ...setting,
        venue_filter: venues.filter(v => v !== venue)
      });
    } else {
      onUpdate({
        ...setting,
        venue_filter: [...venues, venue]
      });
    }
  };

  return (
    <Card className={setting.enabled ? 'border-primary/50' : ''}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-lg">{alertInfo.title}</CardTitle>
              <Badge variant={alertInfo.severity === 'critical' ? 'destructive' : alertInfo.severity === 'warning' ? 'outline' : 'secondary'}>
                {alertInfo.severity}
              </Badge>
            </div>
            <CardDescription>{alertInfo.description}</CardDescription>
          </div>
          <Switch
            checked={setting.enabled}
            onCheckedChange={(checked) => onUpdate({ ...setting, enabled: checked })}
          />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Schedule */}
        <div>
          <Label>Check Frequency</Label>
          <Select
            value={setting.cron_schedule}
            onValueChange={(value) => onUpdate({ ...setting, cron_schedule: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily_9am">Daily at 9 AM</SelectItem>
              <SelectItem value="daily_6pm">Daily at 6 PM</SelectItem>
              <SelectItem value="weekly_monday">Weekly on Monday</SelectItem>
              <SelectItem value="hourly">Every Hour</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Venue Filter */}
        {venues.length > 0 && (
          <div>
            <Label>Filter by Venues (optional)</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {venues.map(venue => (
                <Badge
                  key={venue}
                  variant={(setting.venue_filter || []).includes(venue) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => handleToggleVenue(venue)}
                >
                  {venue}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {(setting.venue_filter || []).length === 0 ? 'All venues' : `${(setting.venue_filter || []).length} venue(s) selected`}
            </p>
          </div>
        )}

        {/* Alert Once */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Alert Once</Label>
            <p className="text-xs text-muted-foreground">Don't repeat alerts for the same spots within 24h</p>
          </div>
          <Switch
            checked={setting.alert_once}
            onCheckedChange={(checked) => onUpdate({ ...setting, alert_once: checked })}
          />
        </div>

        {/* Notification Channels */}
        <div className="border-t pt-4">
          <Label className="text-base">Notification Channels</Label>
          
          {/* Slack */}
          <div className="flex items-center gap-2 mt-3">
            <Send className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Slack</span>
            <Badge variant="secondary" className="ml-auto">Using global webhook</Badge>
          </div>

          {/* Email */}
          <div className="mt-3">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Email Recipients</span>
            </div>
            
            <div className="flex flex-wrap gap-2 mb-2">
              {setting.email_recipients.map((email) => (
                <Badge key={email} variant="secondary" className="gap-1">
                  {email}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-destructive" 
                    onClick={() => handleRemoveEmail(email)}
                  />
                </Badge>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Add email recipient"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddEmail()}
              />
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleAddEmail}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Test & Status */}
        <div className="border-t pt-4 flex items-center justify-between">
          <div>
            {setting.last_run && (
              <p className="text-xs text-muted-foreground">
                Last run: {new Date(setting.last_run).toLocaleString()}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestAlert}
            disabled={isTesting || !setting.enabled}
          >
            <TestTube2 className="h-4 w-4 mr-2" />
            {isTesting ? 'Testing...' : 'Test Alert'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

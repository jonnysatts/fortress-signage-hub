import { useState, useEffect } from "react";
import { Calendar as BigCalendar, momentLocalizer, View } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import moment from "moment-timezone";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarIcon, Download, Settings, Plus } from "lucide-react";
import { CalendarEventDialog } from "@/components/CalendarEventDialog";
import { CreateEventDialog } from "@/components/CreateEventDialog";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

// Set timezone to Australia/Sydney
moment.tz.setDefault("Australia/Sydney");
const localizer = momentLocalizer(moment);
const DnDCalendar = withDragAndDrop(BigCalendar);

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: 'scheduled_promotion' | 'print_job' | 'campaign_start' | 'campaign_end' | 'expiry' | 'stale_warning' | 'recurring';
  spotId?: string;
  campaignId?: string;
  photoId?: string;
  metadata?: any;
}

interface CalendarSettings {
  show_scheduled_promotions: boolean;
  show_print_jobs: boolean;
  show_campaigns: boolean;
  show_expiry_dates: boolean;
  show_stale_warnings: boolean;
  show_recurring_events: boolean;
  default_view: string;
}

export default function Calendar() {
  const { toast } = useToast();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  const [settings, setSettings] = useState<CalendarSettings>({
    show_scheduled_promotions: true,
    show_print_jobs: true,
    show_campaigns: true,
    show_expiry_dates: true,
    show_stale_warnings: true,
    show_recurring_events: true,
    default_view: 'month',
  });

  // Load user settings
  useEffect(() => {
    loadSettings();
  }, []);

  // Load events when settings change
  useEffect(() => {
    loadEvents();
  }, [settings]);

  const loadSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('calendar_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error loading settings:', error);
      return;
    }

    if (data) {
      setSettings({
        show_scheduled_promotions: data.show_scheduled_promotions,
        show_print_jobs: data.show_print_jobs,
        show_campaigns: data.show_campaigns,
        show_expiry_dates: data.show_expiry_dates,
        show_stale_warnings: data.show_stale_warnings,
        show_recurring_events: data.show_recurring_events,
        default_view: data.default_view,
      });
      setView(data.default_view as View);
    }
  };

  const saveSettings = async (newSettings: Partial<CalendarSettings>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);

    const { error } = await supabase
      .from('calendar_settings')
      .upsert({
        user_id: user.id,
        ...updatedSettings,
      });

    if (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "Failed to save calendar settings",
        variant: "destructive",
      });
    }
  };

  const loadEvents = async () => {
    setIsLoading(true);
    const allEvents: CalendarEvent[] = [];

    try {
      // Scheduled promotions
      if (settings.show_scheduled_promotions) {
        const { data: promotions } = await supabase
          .from('photo_history')
          .select(`
            id,
            scheduled_date,
            caption,
            signage_spot_id,
            signage_spots (location_name, venues (name))
          `)
          .eq('image_type', 'planned')
          .not('scheduled_date', 'is', null);

        if (promotions) {
          promotions.forEach(p => {
            allEvents.push({
              id: p.id,
              title: `📸 ${p.signage_spots?.location_name || 'Photo Update'}`,
              start: new Date(p.scheduled_date!),
              end: new Date(p.scheduled_date!),
              type: 'scheduled_promotion',
              spotId: p.signage_spot_id,
              photoId: p.id,
              metadata: p,
            });
          });
        }
      }

      // Print jobs
      if (settings.show_print_jobs) {
        const { data: printJobs } = await supabase
          .from('photo_history')
          .select(`
            id,
            print_due_date,
            print_vendor,
            print_status,
            signage_spot_id,
            signage_spots (location_name, venues (name))
          `)
          .not('print_due_date', 'is', null)
          .in('print_status', ['pending', 'ordered', 'in_production']);

        if (printJobs) {
          printJobs.forEach(j => {
            allEvents.push({
              id: j.id + '_print',
              title: `🖨️ Print: ${j.signage_spots?.location_name || 'Unknown'}`,
              start: new Date(j.print_due_date!),
              end: new Date(j.print_due_date!),
              type: 'print_job',
              spotId: j.signage_spot_id,
              photoId: j.id,
              metadata: j,
            });
          });
        }
      }

      // Campaigns - show as bars spanning dates
      if (settings.show_campaigns) {
        const { data: campaigns } = await supabase
          .from('campaigns')
          .select('*')
          .eq('is_active', true);

        if (campaigns) {
          campaigns.forEach(c => {
            if (c.start_date && c.end_date) {
              // Campaign as a bar spanning the dates
              allEvents.push({
                id: c.id + '_campaign',
                title: `📊 ${c.name}`,
                start: new Date(c.start_date),
                end: new Date(c.end_date),
                type: 'campaign_start',
                campaignId: c.id,
                metadata: c,
              });
            } else if (c.start_date) {
              allEvents.push({
                id: c.id + '_start',
                title: `🚀 ${c.name} (Start)`,
                start: new Date(c.start_date),
                end: new Date(c.start_date),
                type: 'campaign_start',
                campaignId: c.id,
                metadata: c,
              });
            }
            if (c.end_date && !c.start_date) {
              allEvents.push({
                id: c.id + '_end',
                title: `🏁 ${c.name} (End)`,
                start: new Date(c.end_date),
                end: new Date(c.end_date),
                type: 'campaign_end',
                campaignId: c.id,
                metadata: c,
              });
            }
          });
        }
      }

      // Expiry dates
      if (settings.show_expiry_dates) {
        const { data: expiring } = await supabase
          .from('signage_spots')
          .select('id, location_name, expiry_date, venues (name)')
          .not('expiry_date', 'is', null)
          .gte('expiry_date', new Date().toISOString().split('T')[0]);

        if (expiring) {
          expiring.forEach(s => {
            allEvents.push({
              id: s.id + '_expiry',
              title: `⏰ Expiry: ${s.location_name}`,
              start: new Date(s.expiry_date!),
              end: new Date(s.expiry_date!),
              type: 'expiry',
              spotId: s.id,
              metadata: s,
            });
          });
        }
      }

      // Stale warnings
      if (settings.show_stale_warnings) {
        const sixMonthsAgo = moment().subtract(6, 'months').format('YYYY-MM-DD');
        const { data: stale } = await supabase
          .from('signage_spots')
          .select('id, location_name, last_update_date, venues (name)')
          .not('last_update_date', 'is', null)
          .lt('last_update_date', sixMonthsAgo)
          .is('next_planned_image_url', null)
          .neq('status', 'empty');

        if (stale) {
          stale.forEach(s => {
            allEvents.push({
              id: s.id + '_stale',
              title: `⚠️ Stale: ${s.location_name}`,
              start: new Date(s.last_update_date!),
              end: new Date(s.last_update_date!),
              type: 'stale_warning',
              spotId: s.id,
              metadata: s,
            });
          });
        }
      }

      setEvents(allEvents);
    } catch (error) {
      console.error('Error loading events:', error);
      toast({
        title: "Error",
        description: "Failed to load calendar events",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const eventStyleGetter = (event: CalendarEvent) => {
    const colors: Record<CalendarEvent['type'], string> = {
      scheduled_promotion: '#10b981',
      print_job: '#f59e0b',
      campaign_start: '#3b82f6',
      campaign_end: '#8b5cf6',
      expiry: '#ef4444',
      stale_warning: '#dc2626',
      recurring: '#6366f1',
    };

    return {
      style: {
        backgroundColor: colors[event.type],
        borderRadius: '4px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block',
      },
    };
  };

  const handleExport = () => {
    // TODO: Implement iCal/Google Calendar export
    toast({
      title: "Export",
      description: "Calendar export coming soon!",
    });
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setShowEventDialog(true);
  };

  const handleEventDrop = async ({ event, start, end }: any) => {
    const calEvent = event as CalendarEvent;
    
    try {
      // Handle rescheduling based on event type
      if (calEvent.type === 'scheduled_promotion' && calEvent.photoId) {
        const { error } = await supabase
          .from('photo_history')
          .update({ scheduled_date: start.toISOString().split('T')[0] })
          .eq('id', calEvent.photoId);
        
        if (error) throw error;
      } else if (calEvent.type === 'print_job' && calEvent.photoId) {
        const { error } = await supabase
          .from('photo_history')
          .update({ print_due_date: start.toISOString().split('T')[0] })
          .eq('id', calEvent.photoId);
        
        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Event rescheduled successfully",
      });

      loadEvents();
    } catch (error: any) {
      console.error('Error rescheduling event:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to reschedule event",
        variant: "destructive",
      });
    }
  };

  const handleReschedule = (event: CalendarEvent, newDate: Date) => {
    handleEventDrop({ event, start: newDate, end: newDate });
  };

  const handleComplete = (event: CalendarEvent) => {
    loadEvents();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-6 h-6" />
          <h1 className="text-3xl font-bold">Calendar</h1>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Event
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-4 h-4" />
          <h2 className="font-semibold">Display Settings</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="show-promotions"
              checked={settings.show_scheduled_promotions}
              onCheckedChange={(checked) => saveSettings({ show_scheduled_promotions: checked })}
            />
            <Label htmlFor="show-promotions">Scheduled Promotions</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="show-print"
              checked={settings.show_print_jobs}
              onCheckedChange={(checked) => saveSettings({ show_print_jobs: checked })}
            />
            <Label htmlFor="show-print">Print Jobs</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="show-campaigns"
              checked={settings.show_campaigns}
              onCheckedChange={(checked) => saveSettings({ show_campaigns: checked })}
            />
            <Label htmlFor="show-campaigns">Campaigns</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="show-expiry"
              checked={settings.show_expiry_dates}
              onCheckedChange={(checked) => saveSettings({ show_expiry_dates: checked })}
            />
            <Label htmlFor="show-expiry">Expiry Dates</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="show-stale"
              checked={settings.show_stale_warnings}
              onCheckedChange={(checked) => saveSettings({ show_stale_warnings: checked })}
            />
            <Label htmlFor="show-stale">Stale Warnings</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="show-recurring"
              checked={settings.show_recurring_events}
              onCheckedChange={(checked) => saveSettings({ show_recurring_events: checked })}
            />
            <Label htmlFor="show-recurring">Recurring Events</Label>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-[600px]">
            <p className="text-muted-foreground">Loading calendar...</p>
          </div>
        ) : (
          <DnDCalendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 600 }}
            view={view}
            onView={setView}
            date={date}
            onNavigate={setDate}
            eventPropGetter={eventStyleGetter}
            views={['month', 'week', 'day', 'agenda']}
            onSelectEvent={handleSelectEvent}
            onEventDrop={handleEventDrop}
            resizable={false}
          />
        )}
      </Card>

      <CalendarEventDialog
        event={selectedEvent}
        open={showEventDialog}
        onClose={() => setShowEventDialog(false)}
        onReschedule={handleReschedule}
        onComplete={handleComplete}
        onRefresh={loadEvents}
      />

      <CreateEventDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onEventCreated={loadEvents}
      />
    </div>
  );
}

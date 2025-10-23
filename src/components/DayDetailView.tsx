import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { 
  AlertTriangle, 
  Calendar, 
  Printer, 
  Tag, 
  Clock,
  ExternalLink,
  CheckCircle
} from "lucide-react";

interface DayDetailViewProps {
  date: Date | null;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

interface EmptySpot {
  id: string;
  location_name: string;
  venue_name: string;
}

interface OverdueSpot {
  id: string;
  location_name: string;
  venue_name: string;
  days_overdue: number;
}

interface ScheduledUpdate {
  id: string;
  location_name: string;
  venue_name: string;
  caption: string;
  auto_promote: boolean;
}

interface PrintJob {
  id: string;
  vendor: string;
  status: string;
  spot_count: number;
  spots: string[];
}

interface ActiveCampaign {
  id: string;
  name: string;
  day_number: number;
  total_days: number;
  spot_count: number;
}

export function DayDetailView({ date, open, onClose, onRefresh }: DayDetailViewProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [emptySpots, setEmptySpots] = useState<EmptySpot[]>([]);
  const [overdueSpots, setOverdueSpots] = useState<OverdueSpot[]>([]);
  const [scheduledUpdates, setScheduledUpdates] = useState<ScheduledUpdate[]>([]);
  const [printJobs, setPrintJobs] = useState<PrintJob[]>([]);
  const [activeCampaigns, setActiveCampaigns] = useState<ActiveCampaign[]>([]);

  useEffect(() => {
    if (open && date) {
      loadDayData();
    }
  }, [open, date]);

  const loadDayData = async () => {
    if (!date) return;
    
    setIsLoading(true);
    const dateStr = format(date, 'yyyy-MM-dd');
    
    try {
      // Load empty spots
      const { data: empty } = await supabase
        .from('signage_spots')
        .select('id, location_name, venues (name)')
        .eq('status', 'empty')
        .limit(10);

      if (empty) {
        setEmptySpots(empty.map(s => ({
          id: s.id,
          location_name: s.location_name,
          venue_name: s.venues?.name || 'Unknown',
        })));
      }

      // Load overdue spots
      const { data: overdue } = await supabase
        .from('signage_spots')
        .select('id, location_name, expiry_date, venues (name)')
        .eq('status', 'overdue')
        .limit(10);

      if (overdue) {
        setOverdueSpots(overdue.map(s => {
          const daysOverdue = s.expiry_date 
            ? Math.floor((new Date().getTime() - new Date(s.expiry_date).getTime()) / (1000 * 60 * 60 * 24))
            : 0;
          return {
            id: s.id,
            location_name: s.location_name,
            venue_name: s.venues?.name || 'Unknown',
            days_overdue: daysOverdue,
          };
        }));
      }

      // Load scheduled updates for this day
      const { data: scheduled } = await supabase
        .from('photo_history')
        .select(`
          id,
          caption,
          auto_promote,
          signage_spot_id,
          signage_spots (location_name, venues (name))
        `)
        .eq('image_type', 'planned')
        .eq('scheduled_date', dateStr);

      if (scheduled) {
        setScheduledUpdates(scheduled.map(s => ({
          id: s.signage_spot_id,
          location_name: s.signage_spots?.location_name || 'Unknown',
          venue_name: s.signage_spots?.venues?.name || 'Unknown',
          caption: s.caption || 'No caption',
          auto_promote: s.auto_promote || false,
        })));
      }

      // Load print jobs for this day
      const { data: prints } = await supabase
        .from('photo_history')
        .select(`
          id,
          print_vendor,
          print_status,
          signage_spots (location_name)
        `)
        .eq('print_due_date', dateStr)
        .not('print_vendor', 'is', null);

      if (prints) {
        const groupedByVendor = prints.reduce((acc, p) => {
          const vendor = p.print_vendor || 'Unknown';
          if (!acc[vendor]) {
            acc[vendor] = [];
          }
          acc[vendor].push(p.signage_spots?.location_name || 'Unknown');
          return acc;
        }, {} as Record<string, string[]>);

        setPrintJobs(Object.entries(groupedByVendor).map(([vendor, spots], idx) => ({
          id: `batch-${idx}`,
          vendor,
          status: prints[0]?.print_status || 'pending',
          spot_count: spots.length,
          spots,
        })));
      }

      // Load active campaigns
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select(`
          id,
          name,
          start_date,
          end_date,
          signage_campaigns (count)
        `)
        .eq('is_active', true)
        .lte('start_date', dateStr)
        .gte('end_date', dateStr);

      if (campaigns) {
        setActiveCampaigns(campaigns.map(c => {
          const startDate = new Date(c.start_date);
          const endDate = new Date(c.end_date);
          const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          const dayNumber = Math.ceil((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          
          return {
            id: c.id,
            name: c.name,
            day_number: dayNumber,
            total_days: totalDays,
            spot_count: c.signage_campaigns?.[0]?.count || 0,
          };
        }));
      }

    } catch (error) {
      console.error('Error loading day data:', error);
      toast({
        title: "Error",
        description: "Failed to load day details",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!date) return null;

  const totalAttention = emptySpots.length + overdueSpots.length;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {format(date, 'EEEE, MMMM d, yyyy')}
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* NEEDS ATTENTION */}
            {totalAttention > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  <h3 className="font-semibold text-lg">Needs Attention ({totalAttention})</h3>
                </div>

                {emptySpots.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Empty Spots ({emptySpots.length})</h4>
                    {emptySpots.map(spot => (
                      <div 
                        key={spot.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer"
                        onClick={() => navigate(`/signage/${spot.id}`)}
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium">{spot.venue_name} - {spot.location_name}</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                )}

                {overdueSpots.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Overdue ({overdueSpots.length})</h4>
                    {overdueSpots.map(spot => (
                      <div 
                        key={spot.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 cursor-pointer"
                        onClick={() => navigate(`/signage/${spot.id}`)}
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium">{spot.venue_name} - {spot.location_name}</p>
                          <p className="text-xs text-muted-foreground">{spot.days_overdue}d late</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {totalAttention > 0 && (scheduledUpdates.length > 0 || printJobs.length > 0 || activeCampaigns.length > 0) && (
              <Separator />
            )}

            {/* SCHEDULED UPDATES */}
            {scheduledUpdates.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-500" />
                  <h3 className="font-semibold text-lg">Scheduled Updates ({scheduledUpdates.length})</h3>
                </div>
                {scheduledUpdates.map(update => (
                  <div 
                    key={update.id}
                    className="flex items-start justify-between p-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 cursor-pointer"
                    onClick={() => navigate(`/signage/${update.id}`)}
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{update.venue_name} - {update.location_name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{update.caption}</p>
                      {update.auto_promote && (
                        <Badge variant="outline" className="mt-2 text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Auto-promote: ON
                        </Badge>
                      )}
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground ml-2" />
                  </div>
                ))}
              </div>
            )}

            {scheduledUpdates.length > 0 && (printJobs.length > 0 || activeCampaigns.length > 0) && (
              <Separator />
            )}

            {/* PRINT JOBS */}
            {printJobs.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Printer className="w-5 h-5 text-blue-500" />
                  <h3 className="font-semibold text-lg">Print Jobs ({printJobs.length} batch{printJobs.length > 1 ? 'es' : ''})</h3>
                </div>
                {printJobs.map(job => (
                  <div key={job.id} className="p-3 rounded-lg bg-blue-500/10">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium">Vendor: {job.vendor}</p>
                        <p className="text-xs text-muted-foreground mt-1">{job.spot_count} poster{job.spot_count > 1 ? 's' : ''}</p>
                        <Badge variant="outline" className="mt-2 text-xs">{job.status}</Badge>
                      </div>
                    </div>
                    {job.spots.length <= 3 && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {job.spots.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {printJobs.length > 0 && activeCampaigns.length > 0 && <Separator />}

            {/* ACTIVE CAMPAIGNS */}
            {activeCampaigns.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Tag className="w-5 h-5 text-green-500" />
                  <h3 className="font-semibold text-lg">Active Campaigns ({activeCampaigns.length})</h3>
                </div>
                {activeCampaigns.map(campaign => (
                  <div 
                    key={campaign.id}
                    className="p-3 rounded-lg bg-green-500/10 hover:bg-green-500/20 cursor-pointer"
                    onClick={() => navigate(`/campaigns/${campaign.id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{campaign.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Day {campaign.day_number}/{campaign.total_days} • {campaign.spot_count} spots covered
                        </p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-muted-foreground ml-2" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* QUICK ACTIONS */}
            <Separator />
            <div className="space-y-2 pb-6">
              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => {
                  navigate('/dashboard?filter=empty');
                  onClose();
                }}
              >
                Bulk Fill Empty Spots
              </Button>
              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => {
                  navigate('/campaigns?action=new');
                  onClose();
                }}
              >
                Schedule New Campaign
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

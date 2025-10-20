import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Tag, AlertCircle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

interface CalendarEventDialogProps {
  event: CalendarEvent | null;
  open: boolean;
  onClose: () => void;
  onReschedule: (event: CalendarEvent, newDate: Date) => void;
  onComplete: (event: CalendarEvent) => void;
  onRefresh: () => void;
}

export function CalendarEventDialog({ event, open, onClose, onReschedule, onComplete, onRefresh }: CalendarEventDialogProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  if (!event) return null;

  const handleViewDetails = () => {
    if (event.spotId) {
      navigate(`/signage/${event.spotId}`);
    } else if (event.campaignId) {
      navigate(`/campaigns/${event.campaignId}`);
    }
    onClose();
  };

  const handlePromote = async () => {
    if (!event.photoId) return;
    
    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.rpc('promote_planned_to_current', {
        p_photo_id: event.photoId,
        p_promoted_by: user.id,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Image promoted to current",
      });
      
      onComplete(event);
      onRefresh();
      onClose();
    } catch (error: any) {
      console.error('Error promoting image:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to promote image",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkPrintComplete = async () => {
    if (!event.photoId) return;
    
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('photo_history')
        .update({ print_status: 'completed' })
        .eq('id', event.photoId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Print job marked as complete",
      });
      
      onComplete(event);
      onRefresh();
      onClose();
    } catch (error: any) {
      console.error('Error updating print job:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update print job",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getEventTypeInfo = () => {
    switch (event.type) {
      case 'scheduled_promotion':
        return { icon: Calendar, color: 'bg-green-500', label: 'Scheduled Promotion' };
      case 'print_job':
        return { icon: AlertCircle, color: 'bg-amber-500', label: 'Print Job' };
      case 'campaign_start':
        return { icon: Tag, color: 'bg-blue-500', label: 'Campaign Start' };
      case 'campaign_end':
        return { icon: Tag, color: 'bg-purple-500', label: 'Campaign End' };
      case 'expiry':
        return { icon: Clock, color: 'bg-red-500', label: 'Content Expiry' };
      case 'stale_warning':
        return { icon: AlertCircle, color: 'bg-red-600', label: 'Stale Content' };
      case 'recurring':
        return { icon: Calendar, color: 'bg-indigo-500', label: 'Recurring Event' };
      default:
        return { icon: Calendar, color: 'bg-gray-500', label: 'Event' };
    }
  };

  const typeInfo = getEventTypeInfo();
  const Icon = typeInfo.icon;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${typeInfo.color}`}>
              <Icon className="w-4 h-4 text-white" />
            </div>
            {event.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Badge variant="outline">{typeInfo.label}</Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>{format(event.start, 'EEEE, MMMM d, yyyy')}</span>
            </div>
            
            {event.metadata?.venues?.name && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span>{event.metadata.venues.name}</span>
              </div>
            )}

            {event.type === 'print_job' && event.metadata?.print_vendor && (
              <div className="text-sm">
                <span className="text-muted-foreground">Vendor: </span>
                <span>{event.metadata.print_vendor}</span>
              </div>
            )}

            {event.type === 'print_job' && event.metadata?.print_status && (
              <div className="text-sm">
                <span className="text-muted-foreground">Status: </span>
                <Badge variant="outline">{event.metadata.print_status}</Badge>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          {event.type === 'scheduled_promotion' && (
            <Button 
              onClick={handlePromote} 
              disabled={isProcessing}
              className="w-full sm:w-auto"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Promote Now
            </Button>
          )}

          {event.type === 'print_job' && event.metadata?.print_status !== 'completed' && (
            <Button 
              onClick={handleMarkPrintComplete} 
              disabled={isProcessing}
              variant="outline"
              className="w-full sm:w-auto"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Mark Complete
            </Button>
          )}

          <Button 
            onClick={handleViewDetails} 
            variant="outline"
            className="w-full sm:w-auto"
          >
            View Details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

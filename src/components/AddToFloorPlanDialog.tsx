import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import type { FloorPlan } from "@/components/floor-plans-v2/types";

interface AddToFloorPlanDialogProps {
  spotId: string;
  spotName: string;
  venueId: string;
  currentFloorPlanId?: string | null;
  children: React.ReactNode;
}

export default function AddToFloorPlanDialog({
  spotId,
  spotName,
  venueId,
  currentFloorPlanId,
  children
}: AddToFloorPlanDialogProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [markerType, setMarkerType] = useState<string>("circle");
  const [loading, setLoading] = useState(false);

  const loadFloorPlans = useCallback(async () => {
    try {
      // Get venue name first
      const { data: venue, error: venueError } = await supabase
        .from('venues')
        .select('name')
        .eq('id', venueId)
        .single();

      if (venueError) throw venueError;

      // Get floor plans for this venue
      const { data, error } = await supabase
        .from('floor_plans')
        .select('*')
        .eq('venue', venue.name)
        .order('display_order');

      if (error) throw error;
      const plans = (data || []) as FloorPlan[];
      setFloorPlans(plans);
      
      if (plans.length > 0) {
        if (currentFloorPlanId && plans.some(plan => plan.id === currentFloorPlanId)) {
          setSelectedPlanId(currentFloorPlanId);
        } else {
          setSelectedPlanId(plans[0].id);
        }
      } else {
        setSelectedPlanId('');
      }
    } catch (error) {
      console.error('Error loading floor plans:', error);
      toast.error('Failed to load floor plans');
    }
  }, [venueId, currentFloorPlanId]);

  useEffect(() => {
    if (open) {
      loadFloorPlans();
    }
  }, [open, loadFloorPlans]);

  const handleContinue = () => {
    if (!selectedPlanId) {
      toast.error('Please select a floor plan');
      return;
    }

    // Navigate to editor with spotToPlace param
    navigate(`/floor-plans/${selectedPlanId}/edit?spotToPlace=${spotId}&markerType=${markerType}`);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Add "{spotName}" to Floor Plan
          </DialogTitle>
          <DialogDescription>
            Select a floor plan and marker style, then click on the floor plan to place this signage spot.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {floorPlans.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="mb-4">No floor plans available for this venue.</p>
              <Button
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  navigate('/settings');
                }}
              >
                Upload Floor Plans in Settings
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="floor-plan">Floor Plan</Label>
                <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                  <SelectTrigger id="floor-plan">
                    <SelectValue placeholder="Select floor plan..." />
                  </SelectTrigger>
                  <SelectContent>
                    {floorPlans.map(plan => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose which floor plan this spot is located on
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="marker-type">Marker Style</Label>
                <Select value={markerType} onValueChange={setMarkerType}>
                  <SelectTrigger id="marker-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="circle">● Circle (default)</SelectItem>
                    <SelectItem value="rectangle">■ Rectangle</SelectItem>
                    <SelectItem value="line">─ Line</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Circle for most posters, Rectangle for screens/lightboxes, Line for pillars/banners
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleContinue}>
                  Continue to Place Marker
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

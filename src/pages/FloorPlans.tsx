import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { MapPin, ZoomIn, ZoomOut, RotateCcw, Edit } from "lucide-react";
import { toast } from "sonner";
import FloorPlanViewerHighlight from "@/components/FloorPlanViewerHighlight";

interface FloorPlan {
  id: string;
  venue: string;
  level: string;
  display_name: string;
  image_url: string;
}

export default function FloorPlans() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showLegend, setShowLegend] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadFloorPlans();
    checkAdminRole();
  }, []);

  useEffect(() => {
    // Check for plan and spot params in URL
    const planId = searchParams.get('plan');
    const spotId = searchParams.get('spot');
    
    if (planId && floorPlans.length > 0) {
      setSelectedPlanId(planId);
    }
  }, [searchParams, floorPlans]);

  const checkAdminRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    setIsAdmin(!!data);
  };

  const loadFloorPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('floor_plans')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;

      setFloorPlans(data || []);
      if (data && data.length > 0 && !selectedPlanId) {
        setSelectedPlanId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading floor plans:', error);
      toast.error('Failed to load floor plans');
    } finally {
      setLoading(false);
    }
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.2, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.2, 0.5));
  const handleResetView = () => setZoom(1);

  const handleEditMode = () => {
    const spotId = searchParams.get('spot');
    if (spotId) {
      navigate(`/floor-plans/${selectedPlanId}/edit?spot=${spotId}`);
    } else {
      navigate(`/floor-plans/${selectedPlanId}/edit`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading floor plans...</div>
      </div>
    );
  }

  if (floorPlans.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <Card className="p-8 text-center">
          <MapPin className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">No Floor Plans Yet</h2>
          <p className="text-muted-foreground mb-4">
            Upload floor plans to start mapping your signage locations.
          </p>
          {isAdmin && (
            <Button onClick={() => navigate('/settings')}>
              Go to Settings to Upload
            </Button>
          )}
        </Card>
      </div>
    );
  }

  const selectedPlan = floorPlans.find(fp => fp.id === selectedPlanId);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MapPin className="w-8 h-8" />
            Venue Floor Plans
          </h1>
          <p className="text-muted-foreground mt-1">
            Visual map of all signage locations
          </p>
        </div>
      </div>

      {isAdmin && (
        <div className="p-4 bg-muted/50 rounded-lg border border-muted">
          <h3 className="text-sm font-semibold mb-2">How to Edit Floor Plan Markers</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• From any signage detail page, click the pencil icon on the floor plan widget to jump directly to edit mode for that spot</li>
            <li>• Or click <strong>"Enter Edit Mode"</strong> below to place or reposition multiple markers</li>
            <li>• In edit mode, you can move existing markers or add new ones from the dropdown</li>
            <li>• Click on markers in view mode to navigate to that signage's detail page</li>
          </ul>
        </div>
      )}

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-2 block">Select Floor Plan:</label>
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {floorPlans.map(plan => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-2 block">Filter Status:</label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Signage</SelectItem>
                <SelectItem value="current">Current Only</SelectItem>
                <SelectItem value="expiring">Expiring Soon</SelectItem>
                <SelectItem value="overdue">Overdue Only</SelectItem>
                <SelectItem value="empty">Empty Only</SelectItem>
                <SelectItem value="scheduled">Scheduled Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 mt-6">
            <Checkbox 
              id="show-legend" 
              checked={showLegend} 
              onCheckedChange={(checked) => setShowLegend(checked as boolean)}
            />
            <label htmlFor="show-legend" className="text-sm font-medium cursor-pointer">
              Show Legend
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="w-4 h-4 mr-2" />
              Zoom In
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="w-4 h-4 mr-2" />
              Zoom Out
            </Button>
            <Button variant="outline" size="sm" onClick={handleResetView}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset View
            </Button>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-lg border border-primary/20">
              <Button variant="default" size="sm" onClick={handleEditMode} className="font-semibold">
                <Edit className="w-4 h-4 mr-2" />
                Enter Edit Mode
              </Button>
              <span className="text-xs text-muted-foreground hidden sm:block">
                Place and adjust markers
              </span>
            </div>
          )}

          <Badge variant="outline" className="ml-auto">
            Zoom: {Math.round(zoom * 100)}%
          </Badge>
        </div>

        {selectedPlan && (
          <FloorPlanViewerHighlight
            floorPlanId={selectedPlan.id}
            imageUrl={selectedPlan.image_url}
            filterStatus={filterStatus}
            zoom={zoom}
            showLegend={showLegend}
            onEditClick={handleEditMode}
            isAdmin={isAdmin}
          />
        )}
      </Card>
    </div>
  );
}

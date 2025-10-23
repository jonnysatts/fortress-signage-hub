import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import FloorPlanViewer from "@/components/floor-plans/FloorPlanViewer";

interface FloorPlan {
  id: string;
  venue: string;
  level: string;
  display_name: string;
  image_url: string;
}

export default function FloorPlans() {
  const navigate = useNavigate();
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
    navigate(`/floor-plans/${selectedPlanId}/edit`);
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

        <div className="flex flex-wrap items-center gap-2 mb-4">
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
          {isAdmin && (
            <Button variant="default" size="sm" onClick={handleEditMode}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Mode
            </Button>
          )}
          <Badge variant="outline" className="ml-auto">
            Zoom: {Math.round(zoom * 100)}%
          </Badge>
        </div>

        {selectedPlan && (
          <FloorPlanViewer
            floorPlanId={selectedPlan.id}
            imageUrl={selectedPlan.image_url}
            filterStatus={filterStatus}
            zoom={zoom}
            showLegend={showLegend}
          />
        )}
      </Card>
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Edit2 } from "lucide-react";
import { getMarkerColor, getMarkerStatus } from "@/utils/markerUtils";
import { percentToPixel } from "@/utils/coordinateUtils";
import { useNavigate } from "react-router-dom";

interface FloorPlanMiniWidgetProps {
  spotId: string;
  spotData: any;
}

export default function FloorPlanMiniWidget({ spotId, spotData }: FloorPlanMiniWidgetProps) {
  const [floorPlan, setFloorPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadFloorPlan();
  }, [spotId, spotData.floor_plan_id]);

  const loadFloorPlan = async () => {
    if (!spotData.floor_plan_id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('floor_plans')
        .select('*')
        .eq('id', spotData.floor_plan_id)
        .single();

      if (error) throw error;
      setFloorPlan(data);
    } catch (error) {
      console.error('Error loading floor plan:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Floor Plan Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (!floorPlan || !spotData.show_on_map || spotData.marker_x === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Floor Plan Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            This spot is not placed on a floor plan yet.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/floor-plans/manage')}
          >
            <MapPin className="w-4 h-4 mr-2" />
            Add to Floor Plan
          </Button>
        </CardContent>
      </Card>
    );
  }

  const markerColor = getMarkerColor(spotData);
  const markerStatus = getMarkerStatus(spotData);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Floor Plan Location
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/floor-plans?plan=${floorPlan.id}&spot=${spotId}`)}
          >
            <Edit2 className="w-4 h-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-sm">
            <span className="font-medium">Floor Plan:</span> {floorPlan.display_name}
          </div>
          
          <div 
            className="relative border rounded-lg overflow-hidden bg-muted cursor-pointer hover:opacity-80 transition-opacity"
            style={{ height: '200px' }}
            onClick={() => navigate(`/floor-plans?plan=${floorPlan.id}&spot=${spotId}`)}
          >
            <img 
              src={floorPlan.image_url} 
              alt={floorPlan.display_name}
              className="w-full h-full object-cover"
            />
            <svg
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
            >
              {spotData.marker_type === 'circle' && (
                <circle
                  cx={`${spotData.marker_x}%`}
                  cy={`${spotData.marker_y}%`}
                  r={spotData.marker_size / 2}
                  fill={markerColor}
                  stroke="white"
                  strokeWidth="3"
                  className={markerStatus === 'overdue' ? 'animate-pulse' : ''}
                />
              )}
              {spotData.marker_type === 'rectangle' && (
                <rect
                  x={`calc(${spotData.marker_x}% - ${spotData.marker_size / 2}px)`}
                  y={`calc(${spotData.marker_y}% - ${spotData.marker_size / 2}px)`}
                  width={spotData.marker_size}
                  height={spotData.marker_size}
                  fill={markerColor}
                  stroke="white"
                  strokeWidth="3"
                  transform={`rotate(${spotData.marker_rotation} ${spotData.marker_x}% ${spotData.marker_y}%)`}
                  className={markerStatus === 'overdue' ? 'animate-pulse' : ''}
                />
              )}
              {spotData.marker_type === 'line' && (
                <line
                  x1={`${spotData.marker_x}%`}
                  y1={`${spotData.marker_y}%`}
                  x2={`${spotData.marker_x}%`}
                  y2={`calc(${spotData.marker_y}% + ${spotData.marker_size}px)`}
                  stroke={markerColor}
                  strokeWidth="8"
                  strokeLinecap="round"
                  transform={`rotate(${spotData.marker_rotation} ${spotData.marker_x}% ${spotData.marker_y}%)`}
                  className={markerStatus === 'overdue' ? 'animate-pulse' : ''}
                />
              )}
            </svg>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => navigate(`/floor-plans?plan=${floorPlan.id}&spot=${spotId}`)}
          >
            View Full Floor Plan →
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

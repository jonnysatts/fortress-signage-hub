import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Edit2 } from "lucide-react";
import { getMarkerColor, getMarkerStatus } from "@/utils/markerUtils";
import { percentToPixel } from "@/utils/coordinateUtils";
import { useNavigate } from "react-router-dom";
import AddToFloorPlanDialog from "./AddToFloorPlanDialog";

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
          <AddToFloorPlanDialog
            spotId={spotId}
            spotName={spotData.location_name}
            venueId={spotData.venue_id}
          >
            <Button variant="outline" size="sm">
              <MapPin className="w-4 h-4 mr-2" />
              Add to Floor Plan
            </Button>
          </AddToFloorPlanDialog>
        </CardContent>
      </Card>
    );
  }

  const markerColor = getMarkerColor(spotData);
  const markerStatus = getMarkerStatus(spotData);

  // Calculate zoomed viewBox around the marker
  const calculateViewBox = () => {
    const centerX = spotData.marker_x;
    const centerY = spotData.marker_y;

    // Zoom level: smaller = more zoomed in (show 20% of the full plan)
    const zoomWidth = 20;
    const zoomHeight = 20;

    // Calculate viewBox boundaries, clamped to 0-100
    const minX = Math.max(0, centerX - zoomWidth / 2);
    const minY = Math.max(0, centerY - zoomHeight / 2);
    const maxX = Math.min(100, minX + zoomWidth);
    const maxY = Math.min(100, minY + zoomHeight);

    // Adjust if we hit the edge
    const finalMinX = maxX === 100 ? 100 - zoomWidth : minX;
    const finalMinY = maxY === 100 ? 100 - zoomHeight : minY;

    return `${finalMinX} ${finalMinY} ${zoomWidth} ${zoomHeight}`;
  };

  const viewBox = calculateViewBox();

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
            <svg
              className="w-full h-full"
              viewBox={viewBox}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Floor plan image as SVG background */}
              <image
                href={floorPlan.image_url}
                x="0"
                y="0"
                width="100"
                height="100"
                preserveAspectRatio="xMidYMid slice"
              />

              {/* Highlight circle around marker for better visibility */}
              <circle
                cx={spotData.marker_x}
                cy={spotData.marker_y}
                r={3}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="0.3"
                className="animate-pulse"
                opacity="0.6"
              />
              <circle
                cx={spotData.marker_x}
                cy={spotData.marker_y}
                r={2}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="0.2"
                className="animate-pulse"
                opacity="0.4"
                style={{ animationDelay: '0.5s' }}
              />

              {/* Actual marker */}
              {spotData.marker_type === 'circle' && (
                <circle
                  cx={spotData.marker_x}
                  cy={spotData.marker_y}
                  r={spotData.marker_size / 20}
                  fill={markerColor}
                  stroke="white"
                  strokeWidth="0.3"
                  className={markerStatus === 'overdue' ? 'animate-pulse' : ''}
                />
              )}
              {spotData.marker_type === 'rectangle' && (
                <rect
                  x={spotData.marker_x - (spotData.marker_size / 20) / 2}
                  y={spotData.marker_y - (spotData.marker_size / 20) / 2}
                  width={spotData.marker_size / 20}
                  height={spotData.marker_size / 20}
                  fill={markerColor}
                  stroke="white"
                  strokeWidth="0.3"
                  transform={`rotate(${spotData.marker_rotation} ${spotData.marker_x} ${spotData.marker_y})`}
                  className={markerStatus === 'overdue' ? 'animate-pulse' : ''}
                />
              )}
              {spotData.marker_type === 'line' && (
                <line
                  x1={spotData.marker_x}
                  y1={spotData.marker_y}
                  x2={spotData.marker_x}
                  y2={spotData.marker_y + (spotData.marker_size / 10)}
                  stroke={markerColor}
                  strokeWidth="1"
                  strokeLinecap="round"
                  transform={`rotate(${spotData.marker_rotation} ${spotData.marker_x} ${spotData.marker_y})`}
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

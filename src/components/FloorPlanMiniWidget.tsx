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

  // Check for both new (pixel-based) and old (percentage-based) marker data
  const hasMarkerData = (spotData.marker_x_pixels !== null && spotData.marker_x_pixels !== undefined) ||
    (spotData.marker_x !== null && spotData.marker_x !== undefined);

  if (!floorPlan || !spotData.show_on_map || !hasMarkerData) {
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

  console.log('[FloorPlanMiniWidget] Rendering for spot:', {
    spotId,
    spotName: spotData.location_name,
    floorPlanId: floorPlan.id,
    floorPlanName: floorPlan.display_name,
    marker_x_pixels: spotData.marker_x_pixels,
    marker_y_pixels: spotData.marker_y_pixels,
    marker_type: spotData.marker_type,
    marker_x_percent: spotData.marker_x,
    marker_y_percent: spotData.marker_y
  });

  // Determine if using new pixel-based or old percentage-based coordinates
  const usePixelCoords = spotData.marker_x_pixels !== null && spotData.marker_x_pixels !== undefined;

  // Get floor plan dimensions (use defaults for legacy plans)
  const floorWidth = floorPlan.original_width || 1920;
  const floorHeight = floorPlan.original_height || 1080;

  // Calculate zoomed viewBox around the marker
  const calculateViewBox = () => {
    let centerX, centerY;

    if (usePixelCoords) {
      // Use new pixel coordinates
      centerX = spotData.marker_x_pixels;
      centerY = spotData.marker_y_pixels;
    } else {
      // Convert old percentage coordinates to pixels
      centerX = (spotData.marker_x / 100) * floorWidth;
      centerY = (spotData.marker_y / 100) * floorHeight;
    }

    // Zoom level: show area around marker (400px wide view)
    const zoomWidth = 400;
    const zoomHeight = (zoomWidth / floorWidth) * floorHeight;  // Maintain aspect ratio

    // Calculate viewBox boundaries, clamped to floor plan size
    const minX = Math.max(0, centerX - zoomWidth / 2);
    const minY = Math.max(0, centerY - zoomHeight / 2);
    const maxX = Math.min(floorWidth, minX + zoomWidth);
    const maxY = Math.min(floorHeight, minY + zoomHeight);

    // Adjust if we hit the edge
    const finalMinX = maxX === floorWidth ? floorWidth - zoomWidth : minX;
    const finalMinY = maxY === floorHeight ? floorHeight - zoomHeight : minY;

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
            variant="outline"
            size="sm"
            onClick={() => {
              const url = `/floor-plans/${floorPlan.id}/edit?highlightMarker=${spotId}`;
              console.log('[FloorPlanMiniWidget] Navigating to edit marker:', url);
              navigate(url);
            }}
            title="Edit this marker's position"
          >
            <Edit2 className="w-4 h-4 mr-2" />
            Edit Position
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
                width={floorWidth}
                height={floorHeight}
                preserveAspectRatio="xMidYMid slice"
              />

              {(() => {
                // Get marker coordinates in pixels
                let markerX, markerY, markerX2, markerY2, markerWidth, markerHeight, markerRadius;

                if (usePixelCoords) {
                  markerX = spotData.marker_x_pixels;
                  markerY = spotData.marker_y_pixels;
                  markerX2 = spotData.marker_x2_pixels;
                  markerY2 = spotData.marker_y2_pixels;
                  markerWidth = spotData.marker_width_pixels;
                  markerHeight = spotData.marker_height_pixels;
                  markerRadius = spotData.marker_radius_pixels || 15;
                } else {
                  // Convert percentage to pixels
                  markerX = (spotData.marker_x / 100) * floorWidth;
                  markerY = (spotData.marker_y / 100) * floorHeight;
                  markerRadius = (spotData.marker_size / 2) || 15;
                  markerWidth = spotData.marker_size || 30;
                  markerHeight = spotData.marker_size || 30;
                }

                const markerType = spotData.marker_type || 'circle';

                return (
                  <>
                    {/* Highlight pulse around marker */}
                    <circle
                      cx={markerX}
                      cy={markerY}
                      r={30}
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="3"
                      className="animate-pulse"
                      opacity="0.4"
                    />

                    {/* Actual marker */}
                    {(markerType === 'circle' || markerType === 'point') && (
                      <circle
                        cx={markerX}
                        cy={markerY}
                        r={markerRadius}
                        fill={markerColor}
                        stroke="white"
                        strokeWidth="3"
                        className={markerStatus === 'overdue' ? 'animate-pulse' : ''}
                      />
                    )}
                    {(markerType === 'rectangle' || markerType === 'area') && (
                      <rect
                        x={markerX}
                        y={markerY}
                        width={markerWidth}
                        height={markerHeight}
                        fill={markerColor}
                        stroke="white"
                        strokeWidth="3"
                        transform={`rotate(${spotData.marker_rotation || 0} ${markerX + markerWidth / 2} ${markerY + markerHeight / 2})`}
                        className={markerStatus === 'overdue' ? 'animate-pulse' : ''}
                      />
                    )}
                    {markerType === 'line' && markerX2 && markerY2 && (
                      <line
                        x1={markerX}
                        y1={markerY}
                        x2={markerX2}
                        y2={markerY2}
                        stroke={markerColor}
                        strokeWidth="6"
                        strokeLinecap="round"
                        className={markerStatus === 'overdue' ? 'animate-pulse' : ''}
                      />
                    )}
                  </>
                );
              })()}
            </svg>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => navigate(`/floor-plans?plan=${floorPlan.id}&highlightMarker=${spotId}`)}
          >
            View Full Floor Plan →
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

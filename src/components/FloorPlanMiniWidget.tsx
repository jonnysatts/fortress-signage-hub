import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Edit2 } from "lucide-react";
import { getMarkerColor, getMarkerStatus } from "@/utils/markerUtils";
import { useNavigate } from "react-router-dom";
import AddToFloorPlanDialog from "./AddToFloorPlanDialog";
import type { FloorPlan } from "@/components/floor-plans-v2/types";

interface FloorPlanMiniWidgetProps {
  spotId: string;
  spotData: FloorPlanSpotData;
}

interface FloorPlanSpotData {
  location_name: string;
  venue_id: string;
  floor_plan_id: string | null;
  show_on_map: boolean;
  marker_x_pixels: number | null;
  marker_y_pixels: number | null;
  marker_x2_pixels: number | null;
  marker_y2_pixels: number | null;
  marker_width_pixels: number | null;
  marker_height_pixels: number | null;
  marker_radius_pixels: number | null;
  marker_x: number | null;
  marker_y: number | null;
  marker_size: number | null;
  marker_rotation: number | null;
  marker_type: string | null;
}

export default function FloorPlanMiniWidget({ spotId, spotData }: FloorPlanMiniWidgetProps) {
  const [floorPlan, setFloorPlan] = useState<FloorPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadFloorPlan = useCallback(async () => {
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
  }, [spotData.floor_plan_id]);

  useEffect(() => {
    loadFloorPlan();
  }, [loadFloorPlan]);

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
            currentFloorPlanId={spotData.floor_plan_id}
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
            onClick={() => navigate(`/floor-plans?plan=${floorPlan.id}&highlightMarker=${spotId}`)}
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
                let markerCenterX = 0;
                let markerCenterY = 0;
                let markerX2: number | null = null;
                let markerY2: number | null = null;
                let markerWidth = spotData.marker_width_pixels || spotData.marker_size || 30;
                let markerHeight = spotData.marker_height_pixels || spotData.marker_size || 30;
                let markerRadius = spotData.marker_radius_pixels || (spotData.marker_size ? spotData.marker_size / 2 : 15);

                if (usePixelCoords) {
                  markerCenterX = spotData.marker_x_pixels ?? 0;
                  markerCenterY = spotData.marker_y_pixels ?? 0;
                  markerX2 = spotData.marker_x2_pixels ?? null;
                  markerY2 = spotData.marker_y2_pixels ?? null;
                  markerWidth = spotData.marker_width_pixels || (markerRadius ? markerRadius * 2 : markerWidth);
                  markerHeight = spotData.marker_height_pixels || (markerRadius ? markerRadius * 2 : markerHeight);
                } else {
                  markerCenterX = (spotData.marker_x / 100) * floorWidth;
                  markerCenterY = (spotData.marker_y / 100) * floorHeight;
                  markerX2 = null;
                  markerY2 = null;
                  markerWidth = spotData.marker_size || 30;
                  markerHeight = spotData.marker_size || 30;
                  markerRadius = (spotData.marker_size / 2) || 15;
                }

                const markerType = spotData.marker_type || 'circle';
                const rectX = markerCenterX - markerWidth / 2;
                const rectY = markerCenterY - markerHeight / 2;

                return (
                  <>
                    <circle
                      cx={markerCenterX}
                      cy={markerCenterY}
                      r={30}
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="3"
                      className="animate-pulse"
                      opacity="0.4"
                    />

                    {(markerType === 'circle' || markerType === 'point') && (
                      <circle
                        cx={markerCenterX}
                        cy={markerCenterY}
                        r={markerRadius}
                        fill={markerColor}
                        stroke="white"
                        strokeWidth="3"
                        className={markerStatus === 'overdue' ? 'animate-pulse' : ''}
                      />
                    )}
                    {(markerType === 'rectangle' || markerType === 'area') && (
                      <rect
                        x={rectX}
                        y={rectY}
                        width={markerWidth}
                        height={markerHeight}
                        fill={markerColor}
                        stroke="white"
                        strokeWidth="3"
                        transform={`rotate(${spotData.marker_rotation || 0} ${markerCenterX} ${markerCenterY})`}
                        className={markerStatus === 'overdue' ? 'animate-pulse' : ''}
                      />
                    )}
                    {markerType === 'line' && markerX2 !== null && markerY2 !== null && (
                      <line
                        x1={markerCenterX}
                        y1={markerCenterY}
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

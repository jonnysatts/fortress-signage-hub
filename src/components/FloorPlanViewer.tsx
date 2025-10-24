import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { getMarkerColor, getMarkerStatus, STATUS_COLORS } from "@/utils/markerUtils";
import { percentToPixel } from "@/utils/coordinateUtils";
import MarkerTooltip from "./MarkerTooltip";

interface Marker {
  id: string;
  location_name: string;
  marker_x: number;
  marker_y: number;
  marker_type: string;
  marker_size: number;
  marker_rotation: number;
  status: string;
  expiry_date: string | null;
  next_planned_date: string | null;
  current_image_url: string | null;
}

interface FloorPlanViewerProps {
  floorPlanId: string;
  imageUrl: string;
  filterStatus: string;
  zoom: number;
  showLegend: boolean;
}

export default function FloorPlanViewer({
  floorPlanId,
  imageUrl,
  filterStatus,
  zoom,
  showLegend
}: FloorPlanViewerProps) {
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredMarker, setHoveredMarker] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    loadMarkers();
    
    const subscription = supabase
      .channel('floor-plan-markers')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'signage_spots',
          filter: `floor_plan_id=eq.${floorPlanId}`
        },
        () => {
          loadMarkers();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [floorPlanId]);

  useEffect(() => {
    const updateSize = () => {
      if (imageRef.current) {
        const rect = imageRef.current.getBoundingClientRect();
        setContainerSize({
          width: rect.width,
          height: rect.height
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const loadMarkers = async () => {
    try {
      const { data, error } = await supabase
        .from('signage_spots')
        .select('id, location_name, marker_x, marker_y, marker_type, marker_size, marker_rotation, status, expiry_date, next_planned_date, current_image_url')
        .eq('floor_plan_id', floorPlanId)
        .eq('show_on_map', true)
        .not('marker_x', 'is', null);

      if (error) throw error;
      setMarkers(data || []);
    } catch (error) {
      console.error('Error loading markers:', error);
      toast.error('Failed to load markers');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkerClick = (markerId: string) => {
    window.location.href = `/signage/${markerId}`;
  };

  const handleMarkerHover = (markerId: string | null, event?: React.MouseEvent) => {
    setHoveredMarker(markerId);
    if (event && markerId) {
      setTooltipPosition({ x: event.clientX, y: event.clientY });
    }
  };

  const filteredMarkers = markers.filter(marker => {
    if (filterStatus === 'all') return true;
    const markerStatus = getMarkerStatus(marker);
    return markerStatus === filterStatus;
  });

  const statusCounts = {
    current: markers.filter(m => getMarkerStatus(m) === 'current').length,
    expiring: markers.filter(m => getMarkerStatus(m) === 'expiring').length,
    overdue: markers.filter(m => getMarkerStatus(m) === 'overdue').length,
    empty: markers.filter(m => getMarkerStatus(m) === 'empty').length,
    scheduled: markers.filter(m => getMarkerStatus(m) === 'scheduled').length,
  };

  const renderMarker = (marker: Marker) => {
    const color = getMarkerColor(marker);
    const markerStatus = getMarkerStatus(marker);
    const isOverdue = markerStatus === 'overdue';
    const isHovered = hoveredMarker === marker.id;

    // Use imageRef instead of containerRef to account for zoom transform
    const rect = imageRef.current?.getBoundingClientRect();
    // Ensure image is loaded before rendering (check for valid dimensions)
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    const pixelPos = percentToPixel(
      marker.marker_x,
      marker.marker_y,
      rect.width,
      rect.height
    );

    const scale = isHovered ? 1.2 : 1;
    const opacity = isHovered ? 1 : 0.8;

    const commonProps = {
      onClick: () => handleMarkerClick(marker.id),
      onMouseEnter: (e: React.MouseEvent) => handleMarkerHover(marker.id, e),
      onMouseLeave: () => handleMarkerHover(null),
      style: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        transform: `scale(${scale})`,
        opacity
      },
      className: isOverdue ? 'animate-pulse' : ''
    };

    if (marker.marker_type === 'circle') {
      return (
        <circle
          key={marker.id}
          cx={pixelPos.x}
          cy={pixelPos.y}
          r={marker.marker_size / 2}
          fill={color}
          stroke="white"
          strokeWidth="2"
          {...commonProps}
        />
      );
    }

    if (marker.marker_type === 'rectangle') {
      return (
        <rect
          key={marker.id}
          x={pixelPos.x - marker.marker_size / 2}
          y={pixelPos.y - marker.marker_size / 2}
          width={marker.marker_size}
          height={marker.marker_size}
          fill={color}
          stroke="white"
          strokeWidth="2"
          transform={`rotate(${marker.marker_rotation} ${pixelPos.x} ${pixelPos.y})`}
          {...commonProps}
        />
      );
    }

    if (marker.marker_type === 'line') {
      return (
        <line
          key={marker.id}
          x1={pixelPos.x}
          y1={pixelPos.y}
          x2={pixelPos.x}
          y2={pixelPos.y + marker.marker_size}
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          transform={`rotate(${marker.marker_rotation} ${pixelPos.x} ${pixelPos.y})`}
          {...commonProps}
        />
      );
    }

    return null;
  };

  if (loading) {
    return <div className="p-8 text-center">Loading markers...</div>;
  }

  return (
    <div className="space-y-4">
      <div 
        className="relative border rounded-lg overflow-hidden bg-muted"
        style={{ minHeight: '600px' }}
      >
        <div className="relative" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
          <img
            ref={imageRef}
            src={imageUrl}
            alt="Floor plan"
            className="block w-full h-auto"
            onLoad={() => {
              const rect = imageRef.current?.getBoundingClientRect();
              if (rect) {
                setContainerSize({
                  width: rect.width,
                  height: rect.height
                });
              }
            }}
          />
          <svg
            className="absolute top-0 left-0 w-full h-full pointer-events-auto"
            style={{ minHeight: '600px' }}
          >
            {filteredMarkers.map(renderMarker)}
          </svg>
        </div>

        {hoveredMarker && (
          <MarkerTooltip
            marker={markers.find(m => m.id === hoveredMarker)!}
            position={tooltipPosition}
          />
        )}
      </div>

      {showLegend && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Legend</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: STATUS_COLORS.current }} />
              <span className="text-sm">Current ({statusCounts.current})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: STATUS_COLORS.expiring }} />
              <span className="text-sm">Expiring ({statusCounts.expiring})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full animate-pulse" style={{ backgroundColor: STATUS_COLORS.overdue }} />
              <span className="text-sm">Overdue ({statusCounts.overdue})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: STATUS_COLORS.empty }} />
              <span className="text-sm">Empty ({statusCounts.empty})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: STATUS_COLORS.scheduled }} />
              <span className="text-sm">Scheduled ({statusCounts.scheduled})</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Save, Eye, Grid3x3, Undo } from "lucide-react";
import { toast } from "sonner";
import { getMarkerColor, getMarkerStatus } from "@/utils/markerUtils";
import { pixelToPercent } from "@/utils/coordinateUtils";

interface SignageSpot {
  id: string;
  location_name: string;
  marker_x: number | null;
  marker_y: number | null;
  marker_type: string;
  marker_size: number;
  marker_rotation: number;
  status: string;
  expiry_date: string | null;
  next_planned_date: string | null;
}

interface Marker extends SignageSpot {
  isDragging?: boolean;
  isResizing?: boolean;
  isRotating?: boolean;
}

export default function FloorPlanEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [floorPlan, setFloorPlan] = useState<any>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [availableSpots, setAvailableSpots] = useState<SignageSpot[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
  const [selectedSpotToAdd, setSelectedSpotToAdd] = useState<string>("");
  const [markerType, setMarkerType] = useState<string>("circle");
  const [markerSize, setMarkerSize] = useState<number>(30);
  const [showGrid, setShowGrid] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [placementMode, setPlacementMode] = useState(false);
  const [spotToPlaceName, setSpotToPlaceName] = useState<string>("");

  useEffect(() => {
    loadFloorPlan();
    loadMarkers();
    loadAvailableSpots();
  }, [id]);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Handle spot placement mode from URL
  useEffect(() => {
    const spotToPlaceId = searchParams.get('spotToPlace');
    const markerTypeParam = searchParams.get('markerType');
    
    if (spotToPlaceId) {
      setSelectedSpotToAdd(spotToPlaceId);
      setPlacementMode(true);
      if (markerTypeParam) {
        setMarkerType(markerTypeParam);
      }
      
      // Get spot name
      supabase
        .from('signage_spots')
        .select('location_name')
        .eq('id', spotToPlaceId)
        .single()
        .then(({ data }) => {
          if (data) {
            setSpotToPlaceName(data.location_name);
          }
        });
    }
    
    // Highlight specific spot if in URL
    const spotId = searchParams.get('spot');
    if (spotId) {
      setSelectedMarker(spotId);
    }
  }, [searchParams]);

  const loadFloorPlan = async () => {
    try {
      const { data, error } = await supabase
        .from('floor_plans')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setFloorPlan(data);
    } catch (error) {
      console.error('Error loading floor plan:', error);
      toast.error('Failed to load floor plan');
    }
  };

  const loadMarkers = async () => {
    try {
      const { data, error } = await supabase
        .from('signage_spots')
        .select('id, location_name, marker_x, marker_y, marker_type, marker_size, marker_rotation, status, expiry_date, next_planned_date, show_on_map')
        .eq('floor_plan_id', id)
        .eq('show_on_map', true)
        .not('marker_x', 'is', null);

      if (error) throw error;
      setMarkers(data || []);
    } catch (error) {
      console.error('Error loading markers:', error);
    }
  };

  const loadAvailableSpots = async () => {
    if (!floorPlan) return;

    try {
      // Get all spots that either don't have markers or have markers on different floor plans
      const { data, error } = await supabase
        .from('signage_spots')
        .select('id, location_name, marker_x, marker_y, marker_type, marker_size, marker_rotation, status, expiry_date, next_planned_date, floor_plan_id')
        .or(`floor_plan_id.is.null,floor_plan_id.neq.${id},and(floor_plan_id.eq.${id},marker_x.is.null)`);

      if (error) throw error;
      
      const filtered = (data || []).filter(spot => 
        !spot.floor_plan_id || spot.floor_plan_id !== id || !spot.marker_x
      );
      
      setAvailableSpots(filtered);
    } catch (error) {
      console.error('Error loading available spots:', error);
    }
  };

  const handleImageClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedSpotToAdd || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    try {
      // Update the signage spot with marker info
      const { error } = await supabase
        .from('signage_spots')
        .update({
          floor_plan_id: id,
          marker_x: x,
          marker_y: y,
          marker_type: markerType,
          marker_size: markerSize,
          marker_rotation: 0,
          show_on_map: true
        })
        .eq('id', selectedSpotToAdd);

      if (error) throw error;

      toast.success('Marker placed successfully!');
      setSelectedSpotToAdd("");
      setPlacementMode(false);
      setSpotToPlaceName("");
      loadMarkers();
      loadAvailableSpots();
      
      // If came from placement mode, redirect to signage detail
      if (searchParams.get('spotToPlace')) {
        navigate(`/signage/${selectedSpotToAdd}`);
      }
    } catch (error: any) {
      toast.error('Failed to place marker: ' + error.message);
    }
  };

  const handleMarkerDragStart = (markerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedMarker(markerId);
    
    const updatedMarkers = markers.map(m => 
      m.id === markerId ? { ...m, isDragging: true } : m
    );
    setMarkers(updatedMarkers);
  };

  const handleMarkerDrag = async (e: React.MouseEvent) => {
    const draggingMarker = markers.find(m => m.isDragging);
    if (!draggingMarker || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    const updatedMarkers = markers.map(m =>
      m.id === draggingMarker.id ? { ...m, marker_x: x, marker_y: y } : m
    );
    setMarkers(updatedMarkers);
  };

  const handleMarkerDragEnd = async () => {
    const draggingMarker = markers.find(m => m.isDragging);
    if (!draggingMarker) return;

    try {
      const { error } = await supabase
        .from('signage_spots')
        .update({
          marker_x: draggingMarker.marker_x,
          marker_y: draggingMarker.marker_y
        })
        .eq('id', draggingMarker.id);

      if (error) throw error;

      const updatedMarkers = markers.map(m =>
        m.id === draggingMarker.id ? { ...m, isDragging: false } : m
      );
      setMarkers(updatedMarkers);

      toast.success('Marker position updated');
    } catch (error: any) {
      toast.error('Failed to update marker: ' + error.message);
    }
  };

  const handleDeleteMarker = async (markerId: string) => {
    try {
      const { error } = await supabase
        .from('signage_spots')
        .update({ 
          show_on_map: false,
          marker_x: null,
          marker_y: null
        })
        .eq('id', markerId);

      if (error) throw error;

      toast.success('Marker removed from floor plan');
      setSelectedMarker(null);
      loadMarkers();
      loadAvailableSpots();
    } catch (error: any) {
      toast.error('Failed to remove marker: ' + error.message);
    }
  };

  const handleSizeChange = async (size: number) => {
    if (!selectedMarker) return;

    try {
      const { error } = await supabase
        .from('signage_spots')
        .update({ marker_size: size })
        .eq('id', selectedMarker);

      if (error) throw error;

      const updatedMarkers = markers.map(m =>
        m.id === selectedMarker ? { ...m, marker_size: size } : m
      );
      setMarkers(updatedMarkers);
    } catch (error: any) {
      toast.error('Failed to update marker size');
    }
  };

  const handleRotationChange = async (rotation: number) => {
    if (!selectedMarker) return;

    try {
      const { error } = await supabase
        .from('signage_spots')
        .update({ marker_rotation: rotation })
        .eq('id', selectedMarker);

      if (error) throw error;

      const updatedMarkers = markers.map(m =>
        m.id === selectedMarker ? { ...m, marker_rotation: rotation } : m
      );
      setMarkers(updatedMarkers);
    } catch (error: any) {
      toast.error('Failed to update marker rotation');
    }
  };

  const renderMarker = (marker: Marker) => {
    const color = getMarkerColor(marker);
    const isSelected = selectedMarker === marker.id;
    const scale = isSelected ? 1.1 : 1;

    const commonProps = {
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedMarker(marker.id);
      },
      onMouseDown: (e: React.MouseEvent) => handleMarkerDragStart(marker.id, e),
      style: {
        cursor: 'move',
        transition: 'transform 0.2s',
        transform: `scale(${scale})`
      },
      stroke: isSelected ? 'hsl(var(--primary))' : 'white',
      strokeWidth: isSelected ? 4 : 2
    };

    if (marker.marker_type === 'circle') {
      return (
        <circle
          key={marker.id}
          cx={`${marker.marker_x}%`}
          cy={`${marker.marker_y}%`}
          r={marker.marker_size / 2}
          fill={color}
          {...commonProps}
        />
      );
    }

    if (marker.marker_type === 'rectangle') {
      return (
        <rect
          key={marker.id}
          x={`calc(${marker.marker_x}% - ${marker.marker_size / 2}px)`}
          y={`calc(${marker.marker_y}% - ${marker.marker_size / 2}px)`}
          width={marker.marker_size}
          height={marker.marker_size}
          fill={color}
          transform={`rotate(${marker.marker_rotation} ${marker.marker_x}% ${marker.marker_y}%)`}
          {...commonProps}
        />
      );
    }

    if (marker.marker_type === 'line') {
      return (
        <line
          key={marker.id}
          x1={`${marker.marker_x}%`}
          y1={`${marker.marker_y}%`}
          x2={`${marker.marker_x}%`}
          y2={`calc(${marker.marker_y}% + ${marker.marker_size}px)`}
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          transform={`rotate(${marker.marker_rotation} ${marker.marker_x}% ${marker.marker_y}%)`}
          {...commonProps}
        />
      );
    }

    return null;
  };

  if (!floorPlan) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  const selectedMarkerData = markers.find(m => m.id === selectedMarker);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button
              variant="ghost"
              onClick={() => {
                if (placementMode) {
                  navigate(`/signage/${selectedSpotToAdd}`);
                } else {
                  navigate('/floor-plans');
                }
              }}
              className="mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {placementMode ? 'Back to Signage Detail' : 'Back to Floor Plans'}
            </Button>
            <h1 className="text-3xl font-bold">
              {floorPlan.display_name} - {placementMode ? 'Place Marker' : 'Edit Mode'}
            </h1>
            {placementMode ? (
              <p className="text-muted-foreground">
                Click on the floor plan to place "{spotToPlaceName}"
              </p>
            ) : (
              <p className="text-muted-foreground">
                Click to place markers, drag to move them
              </p>
            )}
          </div>
          {!placementMode && (
            <Button onClick={() => navigate('/floor-plans')}>
              <Eye className="w-4 h-4 mr-2" />
              View Mode
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card className="p-4 lg:col-span-1">
            {placementMode ? (
              <>
                <h3 className="font-semibold mb-4">Placing: {spotToPlaceName}</h3>
                
                <div className="space-y-4">
                  <div>
                    <Label>Marker Style</Label>
                    <Select value={markerType} onValueChange={setMarkerType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="circle">● Circle</SelectItem>
                        <SelectItem value="rectangle">■ Rectangle</SelectItem>
                        <SelectItem value="line">─ Line</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Marker Size: {markerSize}px</Label>
                    <Slider
                      value={[markerSize]}
                      onValueChange={(val) => setMarkerSize(val[0])}
                      min={10}
                      max={80}
                      step={5}
                    />
                  </div>

                  <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                    <p className="text-sm font-medium">
                      👆 Click anywhere on the floor plan to place this marker
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-semibold mb-4">Add New Marker</h3>
                
                <div className="space-y-4">
                  <div>
                    <Label>Search Signage Spot</Label>
                    <Select value={selectedSpotToAdd} onValueChange={setSelectedSpotToAdd}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select spot..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSpots.map(spot => (
                          <SelectItem key={spot.id} value={spot.id}>
                            {spot.location_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Marker Style</Label>
                    <Select value={markerType} onValueChange={setMarkerType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="circle">● Circle</SelectItem>
                        <SelectItem value="rectangle">■ Rectangle</SelectItem>
                        <SelectItem value="line">─ Line</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Marker Size: {markerSize}px</Label>
                    <Slider
                      value={[markerSize]}
                      onValueChange={(val) => setMarkerSize(val[0])}
                      min={10}
                      max={80}
                      step={5}
                    />
                  </div>

                  {selectedSpotToAdd && (
                    <p className="text-sm text-muted-foreground">
                      → Click on the floor plan to place this marker
                    </p>
                  )}
                </div>
              </>
            )}

            <Separator className="my-4" />

            {selectedMarkerData && (
              <div className="space-y-4">
                <h3 className="font-semibold">
                  Selected: {selectedMarkerData.location_name}
                </h3>

                <div>
                  <Label>Size: {selectedMarkerData.marker_size}px</Label>
                  <Slider
                    value={[selectedMarkerData.marker_size]}
                    onValueChange={(val) => handleSizeChange(val[0])}
                    min={10}
                    max={80}
                    step={5}
                  />
                </div>

                {selectedMarkerData.marker_type !== 'circle' && (
                  <div>
                    <Label>Rotation: {selectedMarkerData.marker_rotation}°</Label>
                    <Slider
                      value={[selectedMarkerData.marker_rotation]}
                      onValueChange={(val) => handleRotationChange(val[0])}
                      min={0}
                      max={360}
                      step={15}
                    />
                  </div>
                )}

                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => handleDeleteMarker(selectedMarkerData.id)}
                >
                  Delete Marker
                </Button>
              </div>
            )}
          </Card>

          <Card className="p-4 lg:col-span-3">
            <div className="mb-4 flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowGrid(!showGrid)}
              >
                <Grid3x3 className="w-4 h-4 mr-2" />
                {showGrid ? 'Hide' : 'Show'} Grid
              </Button>
            </div>

            <div
              ref={containerRef}
              className="relative border rounded-lg overflow-hidden bg-muted"
              style={{ minHeight: '600px', cursor: selectedSpotToAdd ? 'crosshair' : 'default' }}
              onClick={handleImageClick}
              onMouseMove={handleMarkerDrag}
              onMouseUp={handleMarkerDragEnd}
              onMouseLeave={handleMarkerDragEnd}
            >
              <img
                ref={imageRef}
                src={floorPlan.image_url}
                alt={floorPlan.display_name}
                className="w-full h-auto"
                onLoad={() => {
                  if (containerRef.current) {
                    setContainerSize({
                      width: containerRef.current.offsetWidth,
                      height: containerRef.current.offsetHeight
                    });
                  }
                }}
              />
              
              {showGrid && (
                <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
                  {[...Array(11)].map((_, i) => (
                    <g key={i}>
                      <line
                        x1={`${i * 10}%`}
                        y1="0"
                        x2={`${i * 10}%`}
                        y2="100%"
                        stroke="hsl(var(--primary))"
                        strokeWidth="1"
                        opacity="0.2"
                      />
                      <line
                        x1="0"
                        y1={`${i * 10}%`}
                        x2="100%"
                        y2={`${i * 10}%`}
                        stroke="hsl(var(--primary))"
                        strokeWidth="1"
                        opacity="0.2"
                      />
                    </g>
                  ))}
                </svg>
              )}

              <svg className="absolute top-0 left-0 w-full h-full">
                {markers.map(renderMarker)}
              </svg>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

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
import { ArrowLeft, Save, Eye, Grid3x3, Undo, ZoomIn, ZoomOut, Maximize, Crosshair } from "lucide-react";
import { toast } from "sonner";
import { getMarkerColor, getMarkerStatus } from "@/utils/markerUtils";
import { eventToPercent, percentToPixel, clampPercent } from "@/utils/coordinateUtils";
import { TransformWrapper, TransformComponent, useControls } from "react-zoom-pan-pinch";
import CalibrationOverlay from "@/components/CalibrationOverlay";

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
  floor_plan_id: string | null;
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
  const [showDebug, setShowDebug] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [placementMode, setPlacementMode] = useState(false);
  const [spotToPlaceName, setSpotToPlaceName] = useState<string>("");

  // Draft placement state for intuitive line placement
  const [draftStart, setDraftStart] = useState<{ x: number; y: number } | null>(null);
  const [draftEnd, setDraftEnd] = useState<{ x: number; y: number } | null>(null);
  const [isDrawingDraft, setIsDrawingDraft] = useState(false);

  // Zoom controls component
  const ZoomControls = () => {
    const { zoomIn, zoomOut, resetTransform } = useControls();
    return (
      <div className="absolute top-4 right-4 z-10 flex gap-2 bg-background/90 backdrop-blur-sm p-2 rounded-lg border shadow-lg">
        <Button size="sm" variant="outline" onClick={() => zoomIn()}>
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={() => zoomOut()}>
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={() => resetTransform()}>
          <Maximize className="w-4 h-4" />
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <Button 
          size="sm" 
          variant={showCalibration ? "default" : "outline"}
          onClick={() => setShowCalibration(!showCalibration)}
          title="Toggle calibration overlay"
        >
          <Crosshair className="w-4 h-4" />
        </Button>
      </div>
    );
  };

  useEffect(() => {
    loadFloorPlan();
    loadMarkers();
  }, [id]);

  useEffect(() => {
    if (floorPlan) {
      loadAvailableSpots();
    }
  }, [floorPlan, id]);

  // Auto-select spot from URL parameter
  useEffect(() => {
    const spotId = searchParams.get('spot');
    if (spotId && availableSpots.length > 0) {
      const spotExists = availableSpots.find(s => s.id === spotId);
      if (spotExists) {
        setSelectedSpotToAdd(spotId);
      }
    }
  }, [searchParams, availableSpots]);

  useEffect(() => {
    const updateSize = () => {
      const img = imageRef.current;
      if (img) {
        const rect = img.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
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
        .select('id, location_name, marker_x, marker_y, marker_type, marker_size, marker_rotation, status, expiry_date, next_planned_date, show_on_map, floor_plan_id')
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
      // Get ALL spots from ANY venue to allow repositioning/moving between plans
      const { data, error } = await supabase
        .from('signage_spots')
        .select('id, location_name, marker_x, marker_y, marker_type, marker_size, marker_rotation, status, expiry_date, next_planned_date, floor_plan_id')
        .order('location_name');

      if (error) throw error;
      
      // Include all spots - this allows repositioning existing markers
      // and moving spots between floor plans
      setAvailableSpots(data || []);
    } catch (error) {
      console.error('Error loading available spots:', error);
    }
  };

  // Line placement helpers (percent-based coordinates)
  const getPercentFromEvent = (e: React.MouseEvent) => {
    const coords = eventToPercent(e, imageRef.current);
    if (!coords) return { x: 0, y: 0 };
    return clampPercent(coords);
  };

  const handleLineMouseDown = (e: React.MouseEvent) => {
    if (!placementMode || markerType !== 'line' || !selectedSpotToAdd) return;
    e.preventDefault();
    const p = getPercentFromEvent(e);
    setDraftStart(p);
    setDraftEnd(p);
    setIsDrawingDraft(true);
  };

  const handleLineMouseMove = (e: React.MouseEvent) => {
    if (!isDrawingDraft) return;
    const p = getPercentFromEvent(e);
    setDraftEnd(p);
  };

  const handleLineMouseUp = () => {
    if (!isDrawingDraft) return;
    setIsDrawingDraft(false);
  };

  const confirmDraftPlacement = async () => {
    if (!draftStart || !draftEnd || !selectedSpotToAdd || !imageRef.current) return;
    // Convert percent delta to pixel length and angle using image size
    const rect = imageRef.current.getBoundingClientRect();
    const dxPx = ((draftEnd.x - draftStart.x) / 100) * rect.width;
    const dyPx = ((draftEnd.y - draftStart.y) / 100) * rect.height;
    const length = Math.max(5, Math.round(Math.hypot(dxPx, dyPx)));
    const angle = Math.round((Math.atan2(dyPx, dxPx) * 180) / Math.PI);

    console.log('[EDITOR] Saving line placement:', {
      startPercent: draftStart,
      endPercent: draftEnd,
      imageRect: { width: rect.width, height: rect.height },
      calculatedLength: length,
      calculatedAngle: angle
    });

    try {
      const { error } = await supabase
        .from('signage_spots')
        .update({
          floor_plan_id: id,
          marker_x: draftStart.x,
          marker_y: draftStart.y,
          marker_type: 'line',
          marker_size: length,
          marker_rotation: angle,
          show_on_map: true,
        })
        .eq('id', selectedSpotToAdd);

      if (error) throw error;

      toast.success('Line placed successfully!');
      setDraftStart(null);
      setDraftEnd(null);
      setSelectedSpotToAdd("");
      setPlacementMode(false);
      setSpotToPlaceName("");
      await loadMarkers();
      await loadAvailableSpots();
      if (searchParams.get('spotToPlace')) {
        navigate(`/signage/${selectedSpotToAdd}`);
      }
    } catch (error: any) {
      toast.error('Failed to place line: ' + error.message);
    }
  };

  const cancelDraftPlacement = () => {
    setDraftStart(null);
    setDraftEnd(null);
    setIsDrawingDraft(false);
  };

  const handleImageClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    // For line placement we use drag + submit flow, so ignore simple clicks
    if (placementMode && markerType === 'line') return;
    if (!selectedSpotToAdd) return;

    const coords = eventToPercent(e, imageRef.current);
    if (!coords) return;

    const clampedCoords = clampPercent(coords);

    try {
      // Update the signage spot with marker info
      const { error } = await supabase
        .from('signage_spots')
        .update({
          floor_plan_id: id,
          marker_x: clampedCoords.x,
          marker_y: clampedCoords.y,
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
    if (!draggingMarker) return;

    const coords = eventToPercent(e, imageRef.current);
    if (!coords) return;

    const clampedCoords = clampPercent(coords);

    const updatedMarkers = markers.map(m =>
      m.id === draggingMarker.id ? { ...m, marker_x: clampedCoords.x, marker_y: clampedCoords.y } : m
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
    // Use imageRef for consistent coordinate calculations
    const rect = imageRef.current?.getBoundingClientRect();
    // Ensure image is loaded before rendering (check for valid dimensions)
    if (!rect || rect.width === 0 || rect.height === 0) return null;

    const color = getMarkerColor(marker);
    const isSelected = selectedMarker === marker.id;
    const scale = isSelected ? 1.1 : 1;

    // Convert stored percentage coordinates to pixel positions based on current image rendering size
    const pixelPos = percentToPixel(
      marker.marker_x ?? 0,
      marker.marker_y ?? 0,
      rect.width,
      rect.height
    );

    if (marker.marker_type === 'line') {
      console.log('[EDITOR] Rendering line:', {
        markerId: marker.id,
        storedPercent: { x: marker.marker_x, y: marker.marker_y },
        imageRect: { width: rect.width, height: rect.height },
        calculatedPixel: pixelPos,
        size: marker.marker_size,
        rotation: marker.marker_rotation
      });
    }

    const eventProps = {
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedMarker(marker.id);
      },
      onMouseDown: (e: React.MouseEvent) => handleMarkerDragStart(marker.id, e),
      style: {
        cursor: 'move',
        transition: 'transform 0.2s',
        transform: `scale(${scale})`,
      },
    } as const;

    if (marker.marker_type === 'circle') {
      return (
        <circle
          key={marker.id}
          cx={pixelPos.x}
          cy={pixelPos.y}
          r={marker.marker_size / 2}
          fill={color}
          stroke={isSelected ? 'hsl(var(--primary))' : 'white'}
          strokeWidth={isSelected ? 4 : 2}
          {...eventProps}
        />
      );
    }

    if (marker.marker_type === 'rectangle') {
      return (
        <g
          key={marker.id}
          transform={`translate(${pixelPos.x}, ${pixelPos.y}) rotate(${marker.marker_rotation})`}
          {...eventProps}
        >
          <rect
            x={-marker.marker_size / 2}
            y={-marker.marker_size / 2}
            width={marker.marker_size}
            height={marker.marker_size}
            fill={color}
            stroke={isSelected ? 'hsl(var(--primary))' : 'white'}
            strokeWidth={isSelected ? 4 : 2}
          />
        </g>
      );
    }

    if (marker.marker_type === 'line') {
      return (
        <g
          key={marker.id}
          transform={`translate(${pixelPos.x}, ${pixelPos.y}) rotate(${marker.marker_rotation})`}
          {...eventProps}
        >
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={marker.marker_size}
            stroke={color}
            strokeWidth={8}
            strokeLinecap="round"
          />
        </g>
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

        {!placementMode && searchParams.get('spot') && selectedSpotToAdd && (
          <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
            <p className="text-sm">
              <span className="font-semibold">✏️ Editing Position:</span> {availableSpots.find(s => s.id === selectedSpotToAdd)?.location_name}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              This spot is selected for repositioning. {availableSpots.find(s => s.id === selectedSpotToAdd)?.floor_plan_id === id ? 'Drag the existing marker to move it, or click elsewhere to place it in a new position.' : 'Click on the floor plan to place this marker.'}
            </p>
          </div>
        )}

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
                      <SelectContent className="bg-popover z-50">
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

                  {markerType === 'line' ? (
                    <div className="p-3 bg-primary/10 rounded-lg border border-primary/20 space-y-3">
                      <p className="text-sm font-medium">
                        Click and drag on the floor plan to draw the line. Release to preview, then adjust by dragging again. When happy, click Submit.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          size="sm" 
                          onClick={confirmDraftPlacement} 
                          disabled={!draftStart || !draftEnd}
                          className="w-full whitespace-nowrap"
                        >
                          Submit
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={cancelDraftPlacement} 
                          disabled={!draftStart && !draftEnd}
                          className="w-full whitespace-nowrap"
                        >
                          Reset
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                      <p className="text-sm font-medium">
                        👆 Click anywhere on the floor plan to place this marker
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <h3 className="font-semibold mb-4">Add New Marker</h3>
                
                {!selectedSpotToAdd && (
                  <div className="mb-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
                    <p className="text-sm font-semibold mb-1">👇 Start here:</p>
                    <p className="text-xs text-muted-foreground">
                      Select a signage spot below to begin placing markers on the floor plan
                    </p>
                  </div>
                )}
                
                <div className="space-y-4">
                  <div>
                    <Label>Search Signage Spot</Label>
                    <Select value={selectedSpotToAdd} onValueChange={setSelectedSpotToAdd}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select spot..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50 max-h-[300px] overflow-y-auto">
                        {availableSpots.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground">No available spots</div>
                        ) : (
                          availableSpots.map(spot => {
                            const isOnThisPlan = spot.floor_plan_id === id && spot.marker_x !== null;
                            return (
                              <SelectItem key={spot.id} value={spot.id}>
                                {spot.location_name}
                                {isOnThisPlan && <span className="ml-2 text-xs text-primary">(Already on this plan)</span>}
                              </SelectItem>
                            );
                          })
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Marker Style</Label>
                    <Select value={markerType} onValueChange={setMarkerType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
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

                  {selectedSpotToAdd && markerType === 'line' && (
                    <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                      <p className="text-sm font-medium mb-2">
                        📐 Line Placement Mode:
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Click and drag on the floor plan to draw your line. The Submit button will appear below once you've drawn a line.
                      </p>
                    </div>
                  )}

                  {selectedSpotToAdd && markerType !== 'line' && (
                    <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                      <p className="text-sm font-medium">
                        👆 Click anywhere on the floor plan to place this marker
                      </p>
                    </div>
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDebug(!showDebug)}
              >
                {showDebug ? 'Hide' : 'Show'} Debug Info
              </Button>
              <span className="text-sm text-muted-foreground ml-2">
                💡 Use mouse wheel to zoom, drag to pan
              </span>
            </div>

            <div className="relative border rounded-lg overflow-hidden bg-muted" style={{ minHeight: '600px' }}>
              <TransformWrapper
                initialScale={1}
                minScale={0.5}
                maxScale={5}
                centerOnInit={true}
                wheel={{ step: 0.1 }}
                panning={{ disabled: placementMode && markerType === 'line' }}
                doubleClick={{ disabled: false }}
              >
                <ZoomControls />
                <TransformComponent
                  wrapperStyle={{ width: '100%', height: '600px' }}
                  contentStyle={{ width: '100%', height: '100%' }}
                >
                  <div
                    ref={containerRef}
                    className="relative w-full"
                    style={{ cursor: selectedSpotToAdd ? 'crosshair' : 'default' }}
                    onClick={handleImageClick}
                    onMouseDown={(e) => {
                      if (placementMode && markerType === 'line' && selectedSpotToAdd) handleLineMouseDown(e);
                    }}
                    onMouseMove={(e) => {
                      handleMarkerDrag(e);
                      if (placementMode && markerType === 'line') handleLineMouseMove(e);
                    }}
                    onMouseUp={() => {
                      handleMarkerDragEnd();
                      if (placementMode && markerType === 'line') handleLineMouseUp();
                    }}
                    onMouseLeave={() => {
                      handleMarkerDragEnd();
                      if (isDrawingDraft) handleLineMouseUp();
                    }}
                  >
                    <img
                      ref={imageRef}
                      src={floorPlan.image_url}
                      alt={floorPlan.display_name}
                      className="block w-full h-auto"
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

                    {showDebug && containerRef.current && (
                      <div className="absolute top-2 left-2 bg-black/80 text-white text-xs p-2 rounded font-mono pointer-events-none z-20">
                        <div>Container: {Math.round(containerRef.current.getBoundingClientRect().width)}x{Math.round(containerRef.current.getBoundingClientRect().height)}px</div>
                        <div>Markers: {markers.length}</div>
                        {draftStart && draftEnd && (
                          <>
                            <div className="mt-1 border-t border-white/20 pt-1">Draft Line:</div>
                            <div>Start: ({draftStart.x.toFixed(1)}%, {draftStart.y.toFixed(1)}%)</div>
                            <div>End: ({draftEnd.x.toFixed(1)}%, {draftEnd.y.toFixed(1)}%)</div>
                          </>
                        )}
                        {selectedMarker && markers.find(m => m.id === selectedMarker) && (
                          <>
                            <div className="mt-1 border-t border-white/20 pt-1">Selected:</div>
                            <div>{markers.find(m => m.id === selectedMarker)?.location_name}</div>
                            <div>Pos: ({markers.find(m => m.id === selectedMarker)?.marker_x?.toFixed(1)}%, {markers.find(m => m.id === selectedMarker)?.marker_y?.toFixed(1)}%)</div>
                            <div>Size: {markers.find(m => m.id === selectedMarker)?.marker_size}px</div>
                            <div>Rotation: {markers.find(m => m.id === selectedMarker)?.marker_rotation}°</div>
                          </>
                        )}
                      </div>
                    )}

                    {showCalibration && (
                      <CalibrationOverlay containerRef={containerRef} />
                    )}

                    <svg className="absolute top-0 left-0 w-full h-full">
                      {markers.map(renderMarker)}
                    </svg>

                    {draftStart && draftEnd && (
                      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
                        <line
                          x1={`${draftStart.x}%`}
                          y1={`${draftStart.y}%`}
                          x2={`${draftEnd.x}%`}
                          y2={`${draftEnd.y}%`}
                          stroke="hsl(var(--primary))"
                          strokeWidth="6"
                          strokeLinecap="round"
                          opacity="0.9"
                        />
                        <circle cx={`${draftStart.x}%`} cy={`${draftStart.y}%`} r="6" fill="hsl(var(--primary))" />
                        <circle cx={`${draftEnd.x}%`} cy={`${draftEnd.y}%`} r="6" fill="hsl(var(--primary))" />
                      </svg>
                    )}
                  </div>
                </TransformComponent>
              </TransformWrapper>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

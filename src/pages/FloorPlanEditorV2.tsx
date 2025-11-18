/**
 * Floor Plan Module V2 - Editor Page
 *
 * Complete rewrite with SVG-native pixel-based coordinate system.
 * Clean, maintainable, and actually works.
 */

import { useState, useEffect, useReducer, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { FloorPlan, Marker, SVGPoint, PointMarker, AreaMarker, LineMarker } from '@/components/floor-plans-v2/types';
import { editorReducer, createInitialEditorState } from '@/components/floor-plans-v2/editorReducer';
import { useFloorPlanMarkers } from '@/components/floor-plans-v2/useFloorPlanMarkers';
import { createInitialViewBox, constrainViewBox, viewBoxToZoomLevel } from '@/components/floor-plans-v2/utils';
import FloorPlanCanvas from '@/components/floor-plans-v2/FloorPlanCanvas';
import FloorPlanControls from '@/components/floor-plans-v2/FloorPlanControls';

export default function FloorPlanEditorV2() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [floorPlan, setFloorPlan] = useState<FloorPlan | null>(null);
  const [loadingFloorPlan, setLoadingFloorPlan] = useState(true);
  const [showGrid, setShowGrid] = useState(false);

  // Load markers using custom hook
  const { markers, loading: loadingMarkers, saveMarker, updateMarker, deleteMarker } = useFloorPlanMarkers(id || '');

  // Editor state management
  const [state, dispatch] = useReducer(
    editorReducer,
    null,
    () => floorPlan ? createInitialEditorState(floorPlan) : createInitialEditorState({
      id: '',
      venue: '',
      level: '',
      display_name: '',
      image_url: '',
      original_width: 1920,
      original_height: 1080,
      display_order: 0
    })
  );

  // Load floor plan
  useEffect(() => {
    if (!id) return;

    const loadFloorPlan = async () => {
      try {
        const { data, error } = await supabase
          .from('floor_plans')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;

        // Validate floor plan has dimensions
        if (!data.original_width || !data.original_height) {
          toast.error('This floor plan is missing dimension data. Please re-upload it.');
          return;
        }

        setFloorPlan(data as FloorPlan);
      } catch (error) {
        console.error('Error loading floor plan:', error);
        toast.error('Failed to load floor plan');
        navigate('/floor-plans');
      } finally {
        setLoadingFloorPlan(false);
      }
    };

    loadFloorPlan();
  }, [id, navigate]);

  // Handle spot placement from URL params
  useEffect(() => {
    const spotToPlaceId = searchParams.get('spotToPlace');
    const markerType = searchParams.get('markerType') as 'circle' | 'rectangle' | 'line' | null;

    if (spotToPlaceId && markerType) {
      // Load spot name
      supabase
        .from('signage_spots')
        .select('location_name')
        .eq('id', spotToPlaceId)
        .single()
        .then(({ data }) => {
          if (data) {
            const type = markerType === 'circle' ? 'point' : markerType === 'rectangle' ? 'area' : 'line';
            dispatch({
              type: 'START_PLACEMENT',
              markerType: type,
              spotId: spotToPlaceId,
              spotName: data.location_name
            });
          }
        });
    }
  }, [searchParams]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo: Ctrl+Z
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
      }

      // Redo: Ctrl+Shift+Z
      if (e.ctrlKey && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        dispatch({ type: 'REDO' });
      }

      // Escape: Cancel
      if (e.key === 'Escape') {
        dispatch({ type: 'CANCEL_DRAFT' });
        dispatch({ type: 'DESELECT_ALL' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Canvas click handler
  const handleCanvasClick = useCallback(async (point: SVGPoint) => {
    if (state.mode === 'place-point') {
      // Place point marker
      const marker: PointMarker = {
        id: state.placementSpotId!,
        signage_spot_id: state.placementSpotId!,
        floor_plan_id: id!,
        location_name: state.placementSpotName!,
        type: 'point',
        x: point.x,
        y: point.y,
        radius: 20,
        rotation: 0,
        status: 'empty',
        expiry_date: null,
        next_planned_date: null,
        current_image_url: null,
        show_on_map: true
      };

      const success = await saveMarker(marker);
      if (success) {
        dispatch({ type: 'CANCEL_DRAFT' });
        // If came from spot detail, navigate back
        if (searchParams.get('spotToPlace')) {
          navigate(`/signage/${state.placementSpotId}`);
        }
      }
    } else if (state.mode === 'place-area') {
      // Place area marker
      const marker: AreaMarker = {
        id: state.placementSpotId!,
        signage_spot_id: state.placementSpotId!,
        floor_plan_id: id!,
        location_name: state.placementSpotName!,
        type: 'area',
        x: point.x,
        y: point.y,
        width: 40,
        height: 40,
        rotation: 0,
        status: 'empty',
        expiry_date: null,
        next_planned_date: null,
        current_image_url: null,
        show_on_map: true
      };

      const success = await saveMarker(marker);
      if (success) {
        dispatch({ type: 'CANCEL_DRAFT' });
        if (searchParams.get('spotToPlace')) {
          navigate(`/signage/${state.placementSpotId}`);
        }
      }
    } else if (state.mode === 'place-line') {
      // Start line placement
      if (!state.draftMarker) {
        // First click: set start point
        dispatch({
          type: 'SET_DRAFT_MARKER',
          marker: {
            id: state.placementSpotId!,
            signage_spot_id: state.placementSpotId!,
            floor_plan_id: id!,
            location_name: state.placementSpotName!,
            type: 'line',
            x: point.x,
            y: point.y,
            x2: point.x,
            y2: point.y
          }
        });
      } else {
        // Second click: set end point and save
        const marker: LineMarker = {
          ...(state.draftMarker as Partial<LineMarker>),
          x2: point.x,
          y2: point.y,
          status: 'empty',
          expiry_date: null,
          next_planned_date: null,
          current_image_url: null,
          show_on_map: true
        } as LineMarker;

        const success = await saveMarker(marker);
        if (success) {
          dispatch({ type: 'CANCEL_DRAFT' });
          if (searchParams.get('spotToPlace')) {
            navigate(`/signage/${state.placementSpotId}`);
          }
        }
      }
    }
  }, [state, id, saveMarker, navigate, searchParams]);

  // Marker click handler
  const handleMarkerClick = useCallback((marker: Marker, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      // Multi-select
      dispatch({ type: 'SELECT_MARKER', markerId: marker.id, multiSelect: true });
    } else {
      // Single select
      dispatch({ type: 'SELECT_MARKER', markerId: marker.id });
    }
  }, []);

  // Marker drag handlers
  const handleMarkerDragStart = useCallback((marker: Marker, point: SVGPoint) => {
    dispatch({ type: 'START_DRAG', x: point.x, y: point.y });
  }, []);

  const handleMarkerDrag = useCallback((marker: Marker, point: SVGPoint) => {
    // Update marker position in real-time (optimistic update)
    dispatch({ type: 'DRAG', x: point.x, y: point.y });
  }, []);

  const handleMarkerDragEnd = useCallback(async (marker: Marker, point: SVGPoint) => {
    dispatch({ type: 'END_DRAG' });

    // Update marker in database
    const updatedMarker = {
      ...marker,
      x: point.x,
      y: point.y
    };

    await updateMarker(updatedMarker);
  }, [updateMarker]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (!floorPlan) return;
    dispatch({ type: 'ZOOM_IN' });
  }, [floorPlan]);

  const handleZoomOut = useCallback(() => {
    if (!floorPlan) return;
    dispatch({ type: 'ZOOM_OUT' });
  }, [floorPlan]);

  const handleResetView = useCallback(() => {
    if (!floorPlan) return;
    dispatch({ type: 'SET_VIEW_BOX', viewBox: createInitialViewBox(floorPlan) });
  }, [floorPlan]);

  // ViewBox change handler
  const handleViewBoxChange = useCallback((newViewBox: any) => {
    if (!floorPlan) return;
    const constrained = constrainViewBox(newViewBox, floorPlan);
    dispatch({ type: 'SET_VIEW_BOX', viewBox: constrained });
  }, [floorPlan]);

  const zoomLevel = floorPlan ? viewBoxToZoomLevel(state.viewBox, floorPlan) : 1;

  if (loadingFloorPlan) {
    return <div className="flex items-center justify-center h-screen">Loading floor plan...</div>;
  }

  if (!floorPlan) {
    return <div className="flex items-center justify-center h-screen">Floor plan not found</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/floor-plans')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{floorPlan.display_name}</h1>
            <p className="text-sm text-muted-foreground">
              {floorPlan.original_width} × {floorPlan.original_height} px
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <FloorPlanControls
        mode={state.mode}
        canUndo={state.historyIndex > 0}
        canRedo={state.historyIndex < state.history.length - 1}
        showGrid={showGrid}
        zoomLevel={zoomLevel}
        placementSpotName={state.placementSpotName}
        onModeChange={(mode) => dispatch({ type: 'SET_MODE', mode })}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        onUndo={() => dispatch({ type: 'UNDO' })}
        onRedo={() => dispatch({ type: 'REDO' })}
        onToggleGrid={() => setShowGrid(!showGrid)}
        onCancelPlacement={() => dispatch({ type: 'CANCEL_DRAFT' })}
      />

      {/* Canvas */}
      <div className="flex-1 overflow-hidden bg-muted">
        <FloorPlanCanvas
          floorPlan={floorPlan}
          markers={markers}
          viewBox={state.viewBox}
          mode={state.mode}
          selectedMarkerIds={state.selectedMarkerIds}
          draftMarker={state.draftMarker}
          showGrid={showGrid}
          gridSize={50}
          onMarkerClick={handleMarkerClick}
          onCanvasClick={handleCanvasClick}
          onMarkerDragStart={handleMarkerDragStart}
          onMarkerDrag={handleMarkerDrag}
          onMarkerDragEnd={handleMarkerDragEnd}
          onViewBoxChange={handleViewBoxChange}
          className="w-full h-full"
        />
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between p-2 text-xs text-muted-foreground border-t bg-background">
        <div>
          {markers.length} marker{markers.length !== 1 ? 's' : ''} • Zoom: {Math.round(zoomLevel * 100)}%
        </div>
        <div>
          {state.mode === 'view' && 'View Mode'}
          {state.mode === 'select' && 'Select Mode'}
          {state.mode.startsWith('place-') && 'Placement Mode - Click to place marker'}
        </div>
      </div>
    </div>
  );
}

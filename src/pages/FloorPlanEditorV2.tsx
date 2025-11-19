/**
 * Floor Plan Module V2 - Editor Page
 *
 * Complete rewrite with SVG-native pixel-based coordinate system.
 * Clean, maintainable, and actually works.
 */

import { useState, useEffect, useReducer, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { FloorPlan, Marker, SVGPoint, PointMarker, AreaMarker, LineMarker, ViewBox } from '@/components/floor-plans-v2/types';
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
    if (!id) {
      toast.error('Floor plan ID is missing. Please select a floor plan first.');
      navigate('/floor-plans');
      return;
    }

    const loadFloorPlan = async () => {
      try {
        const { data, error } = await supabase
          .from('floor_plans')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;

        // Legacy floor plans without dimensions will use defaults (1920x1080)
        if (!data.original_width || !data.original_height) {
          console.warn('Floor plan missing dimensions, using defaults (1920x1080)');
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

  useEffect(() => {
    if (floorPlan) {
      dispatch({
        type: 'SET_VIEW_BOX',
        viewBox: createInitialViewBox(floorPlan)
      });
    }
  }, [floorPlan]);

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

  // Handle highlighting/selecting a specific marker from URL
  useEffect(() => {
    const highlightMarkerId = searchParams.get('highlightMarker');
    console.log('[Auto-select] highlightMarkerId from URL:', highlightMarkerId);
    console.log('[Auto-select] Total markers loaded:', markers.length);
    console.log('[Auto-select] All markers:', markers.map(m => ({
      id: m.id,
      signage_spot_id: m.signage_spot_id,
      type: m.type,
      name: m.location_name
    })));

    if (!highlightMarkerId || markers.length === 0 || !floorPlan) {
      console.warn('[Auto-select] Skipping - no highlightMarkerId or no markers loaded');
      return;
    }

    // Find the marker to select
    const markerToSelect = markers.find(m => m.signage_spot_id === highlightMarkerId);
    if (markerToSelect) {
      // Auto-select the marker
      dispatch({ type: 'SELECT_MARKER', markerId: markerToSelect.id });

      // Set the context so the header and back button work correctly
      // We use the marker's location_name as the spot name
      dispatch({
        type: 'SET_FOCUS_CONTEXT',
        spotId: markerToSelect.signage_spot_id,
        spotName: markerToSelect.location_name
      });

      console.log('[Auto-select] SUCCESS! Selected marker:', markerToSelect);
      console.log('[Auto-select] Marker coordinates:', {
        x: markerToSelect.x,
        y: markerToSelect.y,
        type: markerToSelect.type,
        signage_spot_id: markerToSelect.signage_spot_id
      });

      // Auto-zoom to the selected marker (show 600px area around it)
      const zoomWidth = 600;
      const floorWidth = floorPlan.original_width || 1920;
      const floorHeight = floorPlan.original_height || 1080;
      const zoomHeight = (zoomWidth / floorWidth) * floorHeight;

      const centerX = markerToSelect.x;
      const centerY = markerToSelect.y;

      const minX = Math.max(0, centerX - zoomWidth / 2);
      const minY = Math.max(0, centerY - zoomHeight / 2);

      const newViewBox = {
        x: minX,
        y: minY,
        width: zoomWidth,
        height: zoomHeight
      };

      console.log('[Auto-select] Calculated viewBox:', newViewBox);
      console.log('[Auto-select] Floor dimensions:', { floorWidth, floorHeight });

      dispatch({
        type: 'SET_VIEW_BOX',
        viewBox: newViewBox
      });

      console.log('[Auto-select] Dispatched SET_VIEW_BOX action');
      toast.info('Marker selected and zoomed. You can drag to move it or press Delete to remove it.');
    } else {
      console.error('[Auto-select] FAILED - Marker not found!');
      console.error('[Auto-select] Looking for signage_spot_id:', highlightMarkerId);
      console.error('[Auto-select] Available signage_spot_ids:', markers.map(m => m.signage_spot_id));

      // Even if marker not found, if we have the ID, we should try to fetch the spot name to keep context
      // This handles the case where the marker might have been deleted but we still want to go back to the spot
      supabase
        .from('signage_spots')
        .select('location_name')
        .eq('id', highlightMarkerId)
        .single()
        .then(({ data }) => {
          if (data) {
            dispatch({
              type: 'SET_FOCUS_CONTEXT',
              spotId: highlightMarkerId,
              spotName: data.location_name
            });
            toast.error(`Marker not found, but context set to ${data.location_name}`);
          } else {
            toast.error(`Could not find marker for this signage spot.`);
          }
        });
    }
  }, [searchParams, markers, floorPlan]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
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

      // Delete: Delete or Backspace (delete selected markers)
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedMarkerIds.length > 0) {
        e.preventDefault();

        // Delete all selected markers
        for (const markerId of state.selectedMarkerIds) {
          await deleteMarker(markerId);
        }

        dispatch({ type: 'DESELECT_ALL' });
      }

      // Escape: Cancel
      if (e.key === 'Escape') {
        dispatch({ type: 'CANCEL_DRAFT' });
        dispatch({ type: 'DESELECT_ALL' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.selectedMarkerIds, deleteMarker]);

  // Marker resize handlers
  const handleResizeStart = useCallback((handle: string, marker: Marker, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent drag start
    dispatch({ type: 'START_RESIZE', handle, markerId: marker.id, marker });
  }, []);

  const handleResizeEnd = useCallback(async () => {
    if (state.draggedMarkerOverride) {
      // Save the final resized state
      const finalMarker = {
        ...state.resizeStartMarker,
        ...state.draggedMarkerOverride
      } as Marker;

      await updateMarker(finalMarker);
    }
    dispatch({ type: 'END_RESIZE' });
  }, [state.draggedMarkerOverride, state.resizeStartMarker, updateMarker]);

  // Ref to store the start point of a placement drag
  const placementStartRef = useRef<SVGPoint | null>(null);

  // Canvas mouse down handler (start placement)
  const handleCanvasMouseDown = useCallback((point: SVGPoint) => {
    // Store start point for drag calculations
    placementStartRef.current = point;

    if (state.mode === 'place-area') {
      dispatch({
        type: 'SET_DRAFT_MARKER',
        marker: {
          id: state.placementSpotId!,
          signage_spot_id: state.placementSpotId!,
          floor_plan_id: id!,
          location_name: state.placementSpotName!,
          type: 'area',
          x: point.x,
          y: point.y,
          width: 1, // Start with tiny width to be visible
          height: 1,
          rotation: 0
        }
      });
    } else if (state.mode === 'place-line') {
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
          x2: point.x, // Start with zero length
          y2: point.y,
          rotation: 0
        }
      });
    }
  }, [state.mode, state.placementSpotId, state.placementSpotName, id]);

  // Canvas mouse move handler (update draft or resize)
  const handleCanvasMouseMove = useCallback((point: SVGPoint) => {
    if (state.isResizing) {
      dispatch({ type: 'RESIZE', x: point.x, y: point.y });
      return;
    }

    if (!state.draftMarker) return;

    if (state.mode === 'place-line' && state.draftMarker.type === 'line') {
      dispatch({
        type: 'SET_DRAFT_MARKER',
        marker: {
          ...state.draftMarker,
          x2: point.x,
          y2: point.y
        }
      });
    } else if (state.mode === 'place-area' && state.draftMarker.type === 'area') {
      const start = placementStartRef.current;
      if (!start) return;

      const width = Math.abs(point.x - start.x);
      const height = Math.abs(point.y - start.y);
      const centerX = start.x + (point.x - start.x) / 2;
      const centerY = start.y + (point.y - start.y) / 2;

      dispatch({
        type: 'SET_DRAFT_MARKER',
        marker: {
          ...state.draftMarker,
          x: centerX,
          y: centerY,
          width,
          height
        }
      });
    }
  }, [state.draftMarker, state.mode, state.isResizing]);

  // Canvas mouse up handler (finish placement or resize)
  const handleCanvasMouseUp = useCallback(async (point: SVGPoint) => {
    if (state.isResizing) {
      await handleResizeEnd();
      return;
    }

    if (!state.draftMarker) return;

    // Clear start ref
    placementStartRef.current = null;

    if (state.mode === 'place-area' || state.mode === 'place-line') {
      // Finalize marker
      const marker = state.draftMarker as Marker;

      // Validate minimum size to prevent accidental clicks creating tiny markers
      let isValid = true;

      if (marker.type === 'area') {
        if (marker.width < 20 || marker.height < 20) isValid = false;
      } else if (marker.type === 'line') {
        const dx = marker.x2 - marker.x;
        const dy = marker.y2 - marker.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 20) isValid = false;
      }

      if (!isValid) {
        dispatch({ type: 'CANCEL_DRAFT', preserveContext: true });
        toast.info('Click and drag to draw the shape.');
        return;
      }

      dispatch({ type: 'CANCEL_DRAFT', preserveContext: true });

      const success = await saveMarker({
        ...marker,
        status: 'empty',
        expiry_date: null,
        next_planned_date: null,
        current_image_url: null,
        show_on_map: true
      });

      if (success) {
        dispatch({ type: 'SELECT_MARKER', markerId: marker.id });
        dispatch({ type: 'SET_MODE', mode: 'select' });
        toast.success(
          <div className="flex flex-col gap-2">
            <span>{marker.type === 'line' ? 'Line' : 'Rectangle'} placed!</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/signage/${state.placementSpotId}`)}
              className="w-full"
            >
              Return to Signage Detail →
            </Button>
          </div>,
          { duration: 5000 }
        );
      }
    }
  }, [state.draftMarker, state.mode, saveMarker, navigate, state.placementSpotId, handleResizeEnd, state.isResizing]);

  // Canvas click handler (only for Point markers now)
  const handleCanvasClick = useCallback(async (point: SVGPoint) => {
    // Validate that we have a spot ID for placement
    if (state.mode.startsWith('place-') && !state.placementSpotId) {
      toast.error('No signage spot selected.');
      dispatch({ type: 'CANCEL_DRAFT' });
      dispatch({ type: 'SET_MODE', mode: 'view' });
      return;
    }

    // Only allow click-to-place for POINTS. Areas/Lines must be dragged.
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
        dispatch({ type: 'CANCEL_DRAFT', preserveContext: true });
        dispatch({ type: 'SELECT_MARKER', markerId: marker.id });
        dispatch({ type: 'SET_MODE', mode: 'select' });
        toast.success(
          <div className="flex flex-col gap-2">
            <span>Circle marker placed!</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/signage/${state.placementSpotId}`)}
              className="w-full"
            >
              Return to Signage Detail →
            </Button>
          </div>,
          { duration: 5000 }
        );
      }
    }
  }, [state.mode, state.placementSpotId, state.placementSpotName, id, saveMarker, navigate]);

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
    dispatch({ type: 'START_DRAG', x: point.x, y: point.y, markerId: marker.id, marker });
  }, []);

  const handleMarkerDrag = useCallback((marker: Marker, point: SVGPoint) => {
    // Update marker position in real-time (optimistic update)
    dispatch({ type: 'DRAG', x: point.x, y: point.y });
  }, []);

  const handleMarkerDragEnd = useCallback(async (marker: Marker, point: SVGPoint) => {
    const finalMarker = state.draggedMarkerOverride
      ? { ...marker, ...state.draggedMarkerOverride }
      : { ...marker, x: point.x, y: point.y };

    dispatch({ type: 'END_DRAG' });
    await updateMarker(finalMarker as Marker);
  }, [updateMarker, state.draggedMarkerOverride]);



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
  const handleViewBoxChange = useCallback((newViewBox: ViewBox) => {
    if (!floorPlan) return;
    const constrained = constrainViewBox(newViewBox, floorPlan);
    dispatch({ type: 'SET_VIEW_BOX', viewBox: constrained });
  }, [floorPlan]);

  const zoomLevel = floorPlan ? viewBoxToZoomLevel(state.viewBox, floorPlan) : 1;

  // Merge markers with optimistic updates
  const displayMarkers = markers.map(m => {
    if (state.draggedMarkerOverride && state.draggedMarkerOverride.id === m.id) {
      return { ...m, ...state.draggedMarkerOverride } as Marker;
    }
    return m;
  });

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
            onClick={() => {
              if (state.placementSpotId) {
                navigate(`/signage/${state.placementSpotId}`);
              } else {
                navigate('/floor-plans');
              }
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {state.placementSpotName ? 'Back to Spot' : 'Back to Floor Plans'}
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {state.placementSpotName
                ? (state.mode.startsWith('place-') ? `Place Marker: ${state.placementSpotName}` : `Editing: ${state.placementSpotName}`)
                : `Manage Markers - ${floorPlan.display_name}`}
            </h1>
            <p className="text-sm text-muted-foreground">
              {state.placementSpotName
                ? state.mode.startsWith('place-')
                  ? (state.mode === 'place-point' ? 'Click anywhere to place the circle marker' : 'Click and drag to draw the shape')
                  : 'Adjust position or resize. Click "Back to Spot" when done.'
                : 'Move or delete existing markers • Cannot add new markers from this page'
              }
            </p>
          </div>
        </div>

        {/* Show helpful banner when not in placement mode */}
        {!state.placementSpotName && (
          <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950 border-y border-amber-200 dark:border-amber-800 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-lg">💡</span>
              <div>
                <strong className="text-amber-900 dark:text-amber-100">To add new markers:</strong>
                <span className="text-amber-800 dark:text-amber-200 ml-2">
                  Navigate to a signage spot's detail page → Click "Add to Floor Plan" button → Choose marker type
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <FloorPlanControls
        mode={state.mode}
        canUndo={state.historyIndex > 0}
        canRedo={state.historyIndex < state.history.length - 1}
        showGrid={showGrid}
        zoomLevel={zoomLevel}
        selectedCount={state.selectedMarkerIds.length}
        placementSpotName={state.placementSpotName}
        onModeChange={(mode) => dispatch({ type: 'SET_MODE', mode })}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        onUndo={() => dispatch({ type: 'UNDO' })}
        onRedo={() => dispatch({ type: 'REDO' })}
        onToggleGrid={() => setShowGrid(!showGrid)}
        onDeleteSelected={async () => {
          for (const markerId of state.selectedMarkerIds) {
            await deleteMarker(markerId);
          }
          dispatch({ type: 'DESELECT_ALL' });
        }}
        onCancelPlacement={() => dispatch({ type: 'CANCEL_DRAFT' })}
      />

      {/* Canvas */}
      <div className="flex-1 overflow-hidden bg-muted">
        <FloorPlanCanvas
          floorPlan={floorPlan}
          markers={displayMarkers}
          viewBox={state.viewBox}
          mode={state.mode}
          selectedMarkerIds={state.selectedMarkerIds}
          draftMarker={state.draftMarker}
          showGrid={showGrid}
          gridSize={50}
          onMarkerClick={handleMarkerClick}
          onCanvasClick={handleCanvasClick}
          onCanvasMouseDown={handleCanvasMouseDown}
          onCanvasMouseUp={handleCanvasMouseUp}
          onCanvasMouseMove={handleCanvasMouseMove}
          onMarkerDragStart={handleMarkerDragStart}
          onMarkerDragEnd={handleMarkerDragEnd}
          onResizeStart={handleResizeStart}
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

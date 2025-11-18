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
      name: m.label
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
      console.log('[Auto-select] SUCCESS! Selected marker:', markerToSelect);

      // Auto-zoom to the selected marker (show 600px area around it)
      const zoomWidth = 600;
      const floorWidth = floorPlan.original_width || 1920;
      const floorHeight = floorPlan.original_height || 1080;
      const zoomHeight = (zoomWidth / floorWidth) * floorHeight;

      const centerX = markerToSelect.x;
      const centerY = markerToSelect.y;

      const minX = Math.max(0, centerX - zoomWidth / 2);
      const minY = Math.max(0, centerY - zoomHeight / 2);

      dispatch({
        type: 'SET_VIEW_BOX',
        viewBox: {
          x: minX,
          y: minY,
          width: zoomWidth,
          height: zoomHeight
        }
      });

      console.log('[Auto-select] Auto-zoomed to marker at:', { x: centerX, y: centerY });
      toast.info('Marker selected and zoomed. You can drag to move it or press Delete to remove it.');
    } else {
      console.error('[Auto-select] FAILED - Marker not found!');
      console.error('[Auto-select] Looking for signage_spot_id:', highlightMarkerId);
      console.error('[Auto-select] Available signage_spot_ids:', markers.map(m => m.signage_spot_id));
      toast.error(`Could not find marker for this signage spot. The marker may not exist on this floor plan.`);
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

  // Canvas click handler
  const handleCanvasClick = useCallback(async (point: SVGPoint) => {
    // Validate that we have a spot ID for placement
    if (state.mode.startsWith('place-') && !state.placementSpotId) {
      toast.error('No signage spot selected. Go to a signage detail page and click "Add to Floor Plan" to place markers.');
      dispatch({ type: 'CANCEL_DRAFT' });
      dispatch({ type: 'SET_MODE', mode: 'view' });
      return;
    }

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
        // Show success with return button
        toast.success(
          <div className="flex flex-col gap-2">
            <span>Circle marker placed successfully!</span>
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
    } else if (state.mode === 'place-area') {
      // Start area placement (two-click workflow like line)
      if (!state.draftMarker) {
        // First click: set top-left corner
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
            width: 10,  // Small initial size
            height: 10,
            rotation: 0
          }
        });
      } else {
        // Second click: set bottom-right corner and save
        const draft = state.draftMarker as Partial<AreaMarker>;
        const width = Math.abs(point.x - draft.x!);
        const height = Math.abs(point.y - draft.y!);
        const x = Math.min(point.x, draft.x!);  // Top-left corner
        const y = Math.min(point.y, draft.y!);

        const marker: AreaMarker = {
          ...draft,
          x,
          y,
          width: Math.max(width, 20),  // Minimum size
          height: Math.max(height, 20),
          rotation: 0,
          status: 'empty',
          expiry_date: null,
          next_planned_date: null,
          current_image_url: null,
          show_on_map: true
        } as AreaMarker;

        const success = await saveMarker(marker);
        if (success) {
          dispatch({ type: 'CANCEL_DRAFT' });
          // Show success with return button
          toast.success(
            <div className="flex flex-col gap-2">
              <span>Rectangle marker placed successfully!</span>
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
            y2: point.y,
            rotation: 0
          }
        });
      } else {
        // Second click: set end point and save
        const marker: LineMarker = {
          ...(state.draftMarker as Partial<LineMarker>),
          x2: point.x,
          y2: point.y,
          rotation: 0,
          status: 'empty',
          expiry_date: null,
          next_planned_date: null,
          current_image_url: null,
          show_on_map: true
        } as LineMarker;

        console.log('Saving line marker:', {
          x: marker.x,
          y: marker.y,
          x2: marker.x2,
          y2: marker.y2,
          type: marker.type
        });

        const success = await saveMarker(marker);
        if (success) {
          dispatch({ type: 'CANCEL_DRAFT' });

          // Don't auto-navigate - let user see the result
          // Show success message with option to go back
          toast.success(
            <div className="flex flex-col gap-2">
              <span>Line marker placed successfully!</span>
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
    }
  }, [state, id, saveMarker, navigate, searchParams]);

  // Canvas mouse move handler (for updating draft markers)
  const handleCanvasMouseMove = useCallback((point: SVGPoint) => {
    if (!state.draftMarker) return;

    // Update draft marker based on mode
    if (state.mode === 'place-line' && state.draftMarker.type === 'line') {
      // Update line endpoint
      dispatch({
        type: 'SET_DRAFT_MARKER',
        marker: {
          ...state.draftMarker,
          x2: point.x,
          y2: point.y
        }
      });
    } else if (state.mode === 'place-area' && state.draftMarker.type === 'area') {
      // Update area dimensions
      const draft = state.draftMarker as Partial<AreaMarker>;
      const width = Math.abs(point.x - draft.x!);
      const height = Math.abs(point.y - draft.y!);
      const x = Math.min(point.x, draft.x!);
      const y = Math.min(point.y, draft.y!);

      dispatch({
        type: 'SET_DRAFT_MARKER',
        marker: {
          ...state.draftMarker,
          x,
          y,
          width: Math.max(width, 10),
          height: Math.max(height, 10)
        }
      });
    }
  }, [state.draftMarker, state.mode]);

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
            <h1 className="text-2xl font-bold">
              {state.placementSpotName ? `Place Marker: ${state.placementSpotName}` : `Manage Markers - ${floorPlan.display_name}`}
            </h1>
            <p className="text-sm text-muted-foreground">
              {state.placementSpotName
                ? 'Click to place start point, then click again to finalize'
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
          markers={markers}
          viewBox={state.viewBox}
          mode={state.mode}
          selectedMarkerIds={state.selectedMarkerIds}
          draftMarker={state.draftMarker}
          showGrid={showGrid}
          gridSize={50}
          onMarkerClick={handleMarkerClick}
          onCanvasClick={handleCanvasClick}
          onCanvasMouseMove={handleCanvasMouseMove}
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

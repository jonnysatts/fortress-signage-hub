/**
 * Floor Plan Module V2 - Core Canvas Component
 *
 * SVG-native floor plan renderer with pixel-based coordinates.
 * Handles all rendering, zooming, and interaction.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { FloorPlan, Marker, ViewBox, EditorMode, SVGPoint } from './types';
import { screenToSVG, clampToFloorPlan, findMarkerAtPoint } from './utils';
import FloorPlanMarker from './FloorPlanMarker';

interface FloorPlanCanvasProps {
  floorPlan: FloorPlan;
  markers: Marker[];
  viewBox: ViewBox;
  mode: EditorMode;
  selectedMarkerIds: string[];
  draftMarker: Partial<Marker> | null;
  showGrid?: boolean;
  gridSize?: number;
  onMarkerClick?: (marker: Marker, event: React.MouseEvent) => void;
  onCanvasClick?: (point: SVGPoint, event: React.MouseEvent) => void;
  onCanvasMouseMove?: (point: SVGPoint) => void;
  onMarkerDragStart?: (marker: Marker, point: SVGPoint) => void;
  onMarkerDrag?: (marker: Marker, point: SVGPoint) => void;
  onMarkerDragEnd?: (marker: Marker, point: SVGPoint) => void;
  onViewBoxChange?: (viewBox: ViewBox) => void;
  onCanvasMouseDown?: (point: SVGPoint, event: React.MouseEvent) => void;
  onCanvasMouseUp?: (point: SVGPoint, event: React.MouseEvent) => void;
  onResizeStart?: (handle: string, marker: Marker, event: React.MouseEvent) => void;
  className?: string;
}

const FloorPlanCanvas = React.memo(function FloorPlanCanvas({
  floorPlan,
  markers,
  viewBox,
  mode,
  selectedMarkerIds,
  draftMarker,
  showGrid = false,
  gridSize = 50,
  onMarkerClick,
  onCanvasClick,
  onCanvasMouseMove,
  onCanvasMouseDown,
  onCanvasMouseUp,
  onMarkerDragStart,
  onMarkerDrag,
  onMarkerDragEnd,
  onResizeStart,
  onViewBoxChange,
  className = ''
}: FloorPlanCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const isDraggingRef = useRef(false);
  const draggedMarkerRef = useRef<Marker | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<SVGPoint | null>(null);

  // We still need state for UI updates (cursor, etc), but logic will use refs
  const [isDraggingState, setIsDraggingState] = useState(false);
  const [draggedMarkerState, setDraggedMarkerState] = useState<Marker | null>(null);
  const [isPanningState, setIsPanningState] = useState(false);
  const [panStartState, setPanStartState] = useState<SVGPoint | null>(null); // Kept for potential UI feedback, though logic uses ref

  // Handle SVG click
  const handleSvgClick = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    if (isDraggingRef.current || isPanningRef.current) return;

    const svgPoint = screenToSVG(svgRef.current, event.clientX, event.clientY);
    const clampedPoint = clampToFloorPlan(svgPoint, floorPlan);

    // During placement mode, always trigger canvas click (not marker click)
    // This allows second click to finalize placement even if draft marker is under cursor
    const isPlacingMarker = mode.startsWith('place-') && draftMarker;

    if (isPlacingMarker && onCanvasClick) {
      // In placement mode, all clicks go to canvas handler
      onCanvasClick(clampedPoint, event);
    } else {
      // Normal mode: check if clicked on a marker
      const clickedMarker = findMarkerAtPoint(clampedPoint, markers);

      if (clickedMarker && onMarkerClick) {
        onMarkerClick(clickedMarker, event);
      } else if (onCanvasClick) {
        onCanvasClick(clampedPoint, event);
      }
    }
  }, [floorPlan, markers, mode, draftMarker, onMarkerClick, onCanvasClick]);

  // Handle SVG Mouse Down
  const handleSvgMouseDown = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    // If clicking a marker, that's handled by handleMarkerMouseDown (bubbling stopped there? No, it's on the marker element)
    // But here we are on the SVG background.

    const svgPoint = screenToSVG(svgRef.current, event.clientX, event.clientY);
    const clampedPoint = clampToFloorPlan(svgPoint, floorPlan);

    // Start panning if not in a placement mode and not clicking a marker
    const isPlacingNew = (mode === 'place-point' || mode === 'place-area' || mode === 'place-line') && draftMarker;
    const clickedMarker = findMarkerAtPoint(clampedPoint, markers);

    if (!isPlacingNew && !clickedMarker && onViewBoxChange && event.button === 0) { // Left click to pan
      isPanningRef.current = true;
      panStartRef.current = clampedPoint;
      setIsPanningState(true);
      setPanStartState(clampedPoint);
    }

    if (onCanvasMouseDown) {
      onCanvasMouseDown(clampedPoint, event);
    }
  }, [floorPlan, markers, mode, draftMarker, onCanvasMouseDown, onViewBoxChange]);

  // Handle global mouse move (for dragging)
  const handleWindowMouseMove = useCallback((event: MouseEvent) => {
    if (!svgRef.current) return;

    // Check refs immediately
    // We want to handle:
    // 1. Marker dragging (isDraggingRef)
    // 2. Panning (isPanningRef)
    // 3. Placement/Resizing (if onCanvasMouseMove is present and we are interacting)
    // Note: For placement, we don't have a local ref tracking "isPlacing", but the parent does.
    // However, we can just forward the event if onCanvasMouseMove is defined.
    // But we should probably only do it if we are "active"? 
    // Actually, for "hover" effects we want local move.
    // For "drag to create", we want global move.
    // Let's rely on the fact that onCanvasMouseMove is passed.

    // Use requestAnimationFrame to throttle updates for smoother performance
    requestAnimationFrame(() => {
      if (!svgRef.current) return; // Re-check ref inside RAF

      const svgPoint = screenToSVG(svgRef.current, event.clientX, event.clientY);
      const clampedPoint = clampToFloorPlan(svgPoint, floorPlan);

      if (isDraggingRef.current && draggedMarkerRef.current && onMarkerDrag) {
        onMarkerDrag(draggedMarkerRef.current, clampedPoint);
      } else if (isPanningRef.current && panStartRef.current && onViewBoxChange) {
        const deltaX = panStartRef.current.x - clampedPoint.x;
        const deltaY = panStartRef.current.y - clampedPoint.y;

        const newViewBox: ViewBox = {
          ...viewBox,
          x: viewBox.x + deltaX,
          y: viewBox.y + deltaY
        };

        onViewBoxChange(newViewBox);
        // Update ref for continuous panning
        panStartRef.current = clampedPoint;
        setPanStartState(clampedPoint); // Sync state for potential UI updates
      } else if (onCanvasMouseMove) {
        // Forward to parent for placement/resizing logic
        // We only want to do this if we are "interacting" (mouse down).
        // But we don't track "canvas mouse down" state here fully.
        // However, the parent (FloorPlanEditor) tracks `state.draftMarker` or `state.isResizing`.
        // So it's safe to call this, and the parent will decide if it needs to act.
        // BUT: Calling this on *every* window mouse move might be too much if just hovering?
        // "Hover" usually only matters inside the SVG.
        // "Drag" matters outside.
        // Let's only call this if buttons are pressed?
        if (event.buttons === 1) {
          onCanvasMouseMove(clampedPoint);
        }
      }
    });
  }, [floorPlan, viewBox, onMarkerDrag, onViewBoxChange, onCanvasMouseMove]);

  // Handle global mouse up (end drag)
  const handleWindowMouseUp = useCallback((event: MouseEvent) => {
    if (!svgRef.current) return;

    const svgPoint = screenToSVG(svgRef.current, event.clientX, event.clientY);
    const clampedPoint = clampToFloorPlan(svgPoint, floorPlan);

    // 1. End Marker Drag
    if (isDraggingRef.current && draggedMarkerRef.current && onMarkerDragEnd) {
      onMarkerDragEnd(draggedMarkerRef.current, clampedPoint);
    }

    // 2. End Panning
    if (isPanningRef.current) {
      isPanningRef.current = false;
      panStartRef.current = null;
      setIsPanningState(false);
      setPanStartState(null);
    }

    // 3. End Placement/Resize
    if (onCanvasMouseUp) {
      // Always forward mouse up to parent to finish placement/resize
      onCanvasMouseUp(clampedPoint, event as any);
    }

    // Reset refs
    isDraggingRef.current = false;
    draggedMarkerRef.current = null;

    // Sync state
    setIsDraggingState(false);
    setDraggedMarkerState(null);
  }, [floorPlan, onMarkerDragEnd, onCanvasMouseUp]);

  // Attach global listeners ONCE on mount
  useEffect(() => {
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [handleWindowMouseMove, handleWindowMouseUp]);

  // Handle marker drag start
  const handleMarkerMouseDown = useCallback((marker: Marker, event: React.MouseEvent) => {
    // Allow dragging in any mode except active placement modes with draft markers
    const isPlacingNew = (mode === 'place-point' || mode === 'place-area' || mode === 'place-line') && draftMarker;
    if (isPlacingNew) {
      return;
    }

    if (!svgRef.current) return;

    event.stopPropagation();
    event.preventDefault();

    const svgPoint = screenToSVG(svgRef.current, event.clientX, event.clientY);

    // Set refs immediately
    isDraggingRef.current = true;
    draggedMarkerRef.current = marker;

    // Update state for UI
    setIsDraggingState(true);
    setDraggedMarkerState(marker);

    if (onMarkerDragStart) {
      onMarkerDragStart(marker, svgPoint);
    }
  }, [mode, draftMarker, onMarkerDragStart]);

  // Local mouse move for hover effects (when not dragging)
  const handleSvgMouseMove = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    if (isDraggingRef.current || isPanningRef.current) return; // Handled by window listeners

    const svgPoint = screenToSVG(svgRef.current, event.clientX, event.clientY);
    const clampedPoint = clampToFloorPlan(svgPoint, floorPlan);

    if (onCanvasMouseMove) {
      onCanvasMouseMove(clampedPoint);
    }
  }, [floorPlan, onCanvasMouseMove]);

  // Handle wheel for zoom
  const handleWheel = useCallback((event: React.WheelEvent<SVGSVGElement>) => {
    if (!svgRef.current || !onViewBoxChange) return;

    event.preventDefault();
    const svgPoint = screenToSVG(svgRef.current, event.clientX, event.clientY);

    // Zoom factor based on wheel delta
    const zoomFactor = event.deltaY > 0 ? 1.2 : 0.83;

    const newWidth = viewBox.width * zoomFactor;
    const newHeight = viewBox.height * zoomFactor;

    // Zoom towards mouse position
    const newViewBox: ViewBox = {
      x: svgPoint.x - (svgPoint.x - viewBox.x) * zoomFactor,
      y: svgPoint.y - (svgPoint.y - viewBox.y) * zoomFactor,
      width: newWidth,
      height: newHeight
    };

    onViewBoxChange(newViewBox);
  }, [viewBox, onViewBoxChange]);

  // Generate grid lines
  const renderGrid = () => {
    if (!showGrid) return null;

    const lines: JSX.Element[] = [];
    const width = floorPlan.original_width || 1920;
    const height = floorPlan.original_height || 1080;

    // Vertical lines
    for (let x = 0; x <= width; x += gridSize) {
      lines.push(
        <line
          key={`v-${x}`}
          x1={x}
          y1={0}
          x2={x}
          y2={height}
          stroke="hsl(var(--primary))"
          strokeWidth={1}
          opacity={0.2}
        />
      );
    }

    // Horizontal lines
    for (let y = 0; y <= height; y += gridSize) {
      lines.push(
        <line
          key={`h-${y}`}
          x1={0}
          y1={y}
          x2={width}
          y2={y}
          stroke="hsl(var(--primary))"
          strokeWidth={1}
          opacity={0.2}
        />
      );
    }

    return <g className="grid-lines">{lines}</g>;
  };

  const viewBoxStr = `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;

  return (
    <svg
      ref={svgRef}
      className={`floor-plan-canvas ${className}`}
      viewBox={viewBoxStr}
      preserveAspectRatio="xMidYMid meet"
      style={{
        width: '100%',
        height: '100%',
        cursor: mode === 'view' ? 'default' : mode === 'select' ? 'move' : 'crosshair',
        touchAction: 'none'
      }}
      onClick={handleSvgClick}
      onMouseDown={handleSvgMouseDown}
      onMouseMove={handleSvgMouseMove}
      onMouseUp={() => { }} // Handled by window listener if dragging, but we might need it for local clicks? No, click handles clicks.
      // onMouseLeave={handleMouseUp} // Removed, using window listeners
      onWheel={handleWheel}
    >
      {/* Floor plan image */}
      <image
        href={floorPlan.image_url}
        x={0}
        y={0}
        width={floorPlan.original_width || 1920}
        height={floorPlan.original_height || 1080}
        preserveAspectRatio="xMidYMid slice"
      />

      {/* Grid overlay */}
      {renderGrid()}

      {/* Existing markers */}
      {markers.map(marker => (
        <FloorPlanMarker
          key={marker.id}
          marker={marker}
          isSelected={selectedMarkerIds.includes(marker.id)}
          isDragging={isDraggingState && draggedMarkerState?.id === marker.id}
          dimmed={mode.startsWith('place-')}
          onMouseDown={(event) => handleMarkerMouseDown(marker, event)}
          onResizeStart={onResizeStart ? (handle, event) => onResizeStart(handle, marker, event) : undefined}
        />
      ))}

      {/* Draft marker being placed */}
      {draftMarker && draftMarker.x !== undefined && draftMarker.y !== undefined && (
        <FloorPlanMarker
          marker={draftMarker as Marker}
          isSelected={false}
          isDragging={false}
          isDraft={true}
        />
      )}
    </svg>
  );
});

export default FloorPlanCanvas;

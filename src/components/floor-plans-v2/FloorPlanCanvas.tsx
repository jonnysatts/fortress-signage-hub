/**
 * Floor Plan Module V2 - Core Canvas Component
 *
 * SVG-native floor plan renderer with pixel-based coordinates.
 * Handles all rendering, zooming, and interaction.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
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
  className?: string;
}

export default function FloorPlanCanvas({
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
  onMarkerDragStart,
  onMarkerDrag,
  onMarkerDragEnd,
  onViewBoxChange,
  className = ''
}: FloorPlanCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDraggingMarker, setIsDraggingMarker] = useState(false);
  const [draggedMarker, setDraggedMarker] = useState<Marker | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<SVGPoint | null>(null);

  // Handle SVG click
  const handleSvgClick = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    if (isDraggingMarker || isPanning) return;

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
  }, [floorPlan, markers, mode, draftMarker, isDraggingMarker, isPanning, onMarkerClick, onCanvasClick]);

  // Handle marker drag start
  const handleMarkerMouseDown = useCallback((marker: Marker, event: React.MouseEvent) => {
    // Allow dragging in any mode except active placement modes with draft markers
    const isPlacingNew = (mode === 'place-point' || mode === 'place-area' || mode === 'place-line') && draftMarker;
    if (isPlacingNew) return;  // Don't interfere with placement workflow

    if (!svgRef.current) return;

    event.stopPropagation();
    event.preventDefault();

    const svgPoint = screenToSVG(svgRef.current, event.clientX, event.clientY);
    setIsDraggingMarker(true);
    setDraggedMarker(marker);

    if (onMarkerDragStart) {
      onMarkerDragStart(marker, svgPoint);
    }
  }, [mode, draftMarker, onMarkerDragStart]);

  // Handle mouse move (for dragging)
  const handleMouseMove = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;

    const svgPoint = screenToSVG(svgRef.current, event.clientX, event.clientY);
    const clampedPoint = clampToFloorPlan(svgPoint, floorPlan);

    if (isDraggingMarker && draggedMarker && onMarkerDrag) {
      onMarkerDrag(draggedMarker, clampedPoint);
    }

    if (isPanning && panStart && onViewBoxChange) {
      // Calculate pan delta in SVG coordinates
      const deltaX = panStart.x - clampedPoint.x;
      const deltaY = panStart.y - clampedPoint.y;

      const newViewBox: ViewBox = {
        ...viewBox,
        x: viewBox.x + deltaX,
        y: viewBox.y + deltaY
      };

      onViewBoxChange(newViewBox);
      setPanStart(clampedPoint);
    }

    // Always call onCanvasMouseMove for draft marker updates
    if (onCanvasMouseMove && !isDraggingMarker && !isPanning) {
      onCanvasMouseMove(clampedPoint);
    }
  }, [floorPlan, isDraggingMarker, draggedMarker, isPanning, panStart, viewBox, onMarkerDrag, onViewBoxChange, onCanvasMouseMove]);

  // Handle mouse up (end drag)
  const handleMouseUp = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;

    if (isDraggingMarker && draggedMarker && onMarkerDragEnd) {
      const svgPoint = screenToSVG(svgRef.current, event.clientX, event.clientY);
      const clampedPoint = clampToFloorPlan(svgPoint, floorPlan);
      onMarkerDragEnd(draggedMarker, clampedPoint);
    }

    setIsDraggingMarker(false);
    setDraggedMarker(null);
    setIsPanning(false);
    setPanStart(null);
  }, [floorPlan, isDraggingMarker, draggedMarker, onMarkerDragEnd]);

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
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
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
          isDragging={isDraggingMarker && draggedMarker?.id === marker.id}
          onMouseDown={(event) => handleMarkerMouseDown(marker, event)}
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
}

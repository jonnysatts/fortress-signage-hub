/**
 * Floor Plan Module V2 - Marker Component
 *
 * Renders individual markers on the floor plan (point, area, line types)
 */

import { Marker, PointMarker, AreaMarker, LineMarker } from './types';
import { getMarkerColor } from './utils';

interface FloorPlanMarkerProps {
  marker: Partial<Marker> | Marker;
  isSelected: boolean;
  isDragging: boolean;
  isDraft?: boolean;
  dimmed?: boolean;
  onMouseDown?: (event: React.MouseEvent) => void;
  onResizeStart?: (handle: string, event: React.MouseEvent) => void;
  onClick?: (event: React.MouseEvent) => void;
}

export default function FloorPlanMarker({
  marker,
  isSelected,
  isDragging,
  isDraft = false,
  dimmed = false,
  onMouseDown,
  onResizeStart,
  onClick
}: FloorPlanMarkerProps) {
  // Get color based on status
  const baseColor = getMarkerColor(marker as Marker);
  const fill = isDraft ? 'hsl(var(--primary))' : baseColor;
  const stroke = isSelected ? 'hsl(var(--primary))' : 'white';
  const strokeWidth = isSelected ? 5 : 2;
  const opacity = dimmed ? 0.5 : isDraft ? 0.6 : isDragging ? 0.8 : 1;
  const cursor = onMouseDown ? 'move' : 'pointer';

  // Common props for all marker types
  const commonProps = {
    fill,
    stroke,
    strokeWidth,
    opacity,
    style: { cursor, pointerEvents: 'all' as const },
    onMouseDown,
    className: `floor-plan-marker ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`,
    onClick
  };

  // Render based on marker type
  if (marker.type === 'point' || (!marker.type && 'radius' in marker)) {
    const pointMarker = marker as Partial<PointMarker>;
    if (pointMarker.x === undefined || pointMarker.y === undefined || !pointMarker.radius) {
      return null;
    }

    return (
      <>
        {/* Pulsing ring for selected markers */}
        {isSelected && (
          <circle
            cx={pointMarker.x}
            cy={pointMarker.y}
            r={pointMarker.radius + 15}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="3"
            opacity="0.6"
            className="animate-pulse"
            style={{ cursor, pointerEvents: 'all' as const }}
            onMouseDown={onMouseDown}
          />
        )}
        <circle
          cx={pointMarker.x}
          cy={pointMarker.y}
          r={pointMarker.radius}
          {...commonProps}
        />
      </>
    );
  }

  if (marker.type === 'area') {
    const areaMarker = marker as Partial<AreaMarker>;
    if (
      areaMarker.x === undefined ||
      areaMarker.y === undefined ||
      !areaMarker.width ||
      !areaMarker.height
    ) {
      return null;
    }

    const rotation = areaMarker.rotation || 0;
    const halfW = areaMarker.width / 2;
    const halfH = areaMarker.height / 2;

    return (
      <>
        {/* Pulsing outline for selected markers */}
        {isSelected && (
          <>
            <rect
              x={areaMarker.x - halfW - 15}
              y={areaMarker.y - halfH - 15}
              width={areaMarker.width + 30}
              height={areaMarker.height + 30}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="3"
              opacity="0.6"
              className="animate-pulse"
              transform={rotation !== 0 ? `rotate(${rotation} ${areaMarker.x} ${areaMarker.y})` : undefined}
              style={{ cursor, pointerEvents: 'all' as const }}
              onMouseDown={onMouseDown}
            />
            {/* Resize Handles */}
            {!isDragging && onResizeStart && (
              <g transform={rotation !== 0 ? `rotate(${rotation} ${areaMarker.x} ${areaMarker.y})` : undefined}>
                {/* Corners */}
                <circle
                  cx={areaMarker.x - halfW}
                  cy={areaMarker.y - halfH}
                  r={6}
                  fill="white"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  style={{ cursor: 'nw-resize' }}
                  onMouseDown={(e) => onResizeStart('nw', e)}
                />
                <circle
                  cx={areaMarker.x + halfW}
                  cy={areaMarker.y - halfH}
                  r={6}
                  fill="white"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  style={{ cursor: 'ne-resize' }}
                  onMouseDown={(e) => onResizeStart('ne', e)}
                />
                <circle
                  cx={areaMarker.x + halfW}
                  cy={areaMarker.y + halfH}
                  r={6}
                  fill="white"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  style={{ cursor: 'se-resize' }}
                  onMouseDown={(e) => onResizeStart('se', e)}
                />
                <circle
                  cx={areaMarker.x - halfW}
                  cy={areaMarker.y + halfH}
                  r={6}
                  fill="white"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  style={{ cursor: 'sw-resize' }}
                  onMouseDown={(e) => onResizeStart('sw', e)}
                />
              </g>
            )}
          </>
        )}
        <rect
          x={areaMarker.x - halfW}
          y={areaMarker.y - halfH}
          width={areaMarker.width}
          height={areaMarker.height}
          transform={rotation !== 0 ? `rotate(${rotation} ${areaMarker.x} ${areaMarker.y})` : undefined}
          {...commonProps}
        />
      </>
    );
  }

  if (marker.type === 'line') {
    const lineMarker = marker as Partial<LineMarker>;
    if (
      lineMarker.x === undefined ||
      lineMarker.y === undefined ||
      lineMarker.x2 === undefined ||
      lineMarker.y2 === undefined
    ) {
      return null;
    }

    return (
      <>
        {/* Pulsing outline for selected line markers */}
        {isSelected && (
          <>
            <line
              x1={lineMarker.x}
              y1={lineMarker.y}
              x2={lineMarker.x2}
              y2={lineMarker.y2}
              stroke="hsl(var(--primary))"
              strokeWidth={40}
              strokeLinecap="round"
              opacity="0.4"
              className="animate-pulse"
              style={{ cursor, pointerEvents: 'all' as const }}
              onMouseDown={onMouseDown}
            />
            {/* Endpoint Handles */}
            {!isDragging && onResizeStart && (
              <>
                <circle
                  cx={lineMarker.x}
                  cy={lineMarker.y}
                  r={6}
                  fill="white"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  style={{ cursor: 'move' }}
                  onMouseDown={(e) => onResizeStart('start', e)}
                />
                <circle
                  cx={lineMarker.x2}
                  cy={lineMarker.y2}
                  r={6}
                  fill="white"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  style={{ cursor: 'move' }}
                  onMouseDown={(e) => onResizeStart('end', e)}
                />
              </>
            )}
          </>
        )}
        <g className={`floor-plan-marker line ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}>
          {/* Invisible thick hit area */}
          <line
            x1={lineMarker.x}
            y1={lineMarker.y}
            x2={lineMarker.x2}
            y2={lineMarker.y2}
            stroke="transparent"
            strokeWidth={40}
            strokeLinecap="round"
            style={{ cursor, pointerEvents: 'all' as const }}
            onMouseDown={onMouseDown}
            onClick={onClick}
          />
          {/* Visible line */}
          <line
            x1={lineMarker.x}
            y1={lineMarker.y}
            x2={lineMarker.x2}
            y2={lineMarker.y2}
            stroke={fill}
            strokeWidth={12}
            strokeLinecap="round"
            opacity={opacity}
            style={{ pointerEvents: 'none' }} // Events handled by hit area
          />
        </g>
      </>
    );
  }

  return null;
}

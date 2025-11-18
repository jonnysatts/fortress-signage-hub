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
  onMouseDown?: (event: React.MouseEvent) => void;
}

export default function FloorPlanMarker({
  marker,
  isSelected,
  isDragging,
  isDraft = false,
  onMouseDown
}: FloorPlanMarkerProps) {
  // Get color based on status
  const baseColor = getMarkerColor(marker as Marker);
  const fill = isDraft ? 'hsl(var(--primary))' : baseColor;
  const stroke = isSelected ? 'hsl(var(--primary))' : 'white';
  const strokeWidth = isSelected ? 5 : 2;
  const opacity = isDraft ? 0.6 : isDragging ? 0.8 : 1;
  const cursor = onMouseDown ? 'move' : 'pointer';

  // Common props for all marker types
  const commonProps = {
    fill,
    stroke,
    strokeWidth,
    opacity,
    style: { cursor },
    onMouseDown,
    className: `floor-plan-marker ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`
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
          />
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
          <line
            x1={lineMarker.x}
            y1={lineMarker.y}
            x2={lineMarker.x2}
            y2={lineMarker.y2}
            stroke="hsl(var(--primary))"
            strokeWidth={20}
            strokeLinecap="round"
            opacity="0.4"
            className="animate-pulse"
          />
        )}
        <line
          x1={lineMarker.x}
          y1={lineMarker.y}
          x2={lineMarker.x2}
          y2={lineMarker.y2}
          stroke={fill}
          strokeWidth={12}
          strokeLinecap="round"
          opacity={opacity}
          style={{ cursor }}
          onMouseDown={onMouseDown}
          className={`floor-plan-marker line ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
        />
      </>
    );
  }

  return null;
}

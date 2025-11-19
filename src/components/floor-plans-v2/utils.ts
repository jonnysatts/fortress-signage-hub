/**
 * Floor Plan Module V2 - Utility Functions
 *
 * SVG-native coordinate conversion and helper functions.
 * All coordinates are in PIXELS relative to original floor plan image.
 */

import { SVGPoint, ViewBox, Marker, FloorPlan } from './types';

/**
 * Convert screen coordinates (from mouse event) to SVG coordinates
 * This handles all zoom/pan transforms automatically
 *
 * @param svgElement - The SVG element
 * @param clientX - Mouse X position from event.clientX
 * @param clientY - Mouse Y position from event.clientY
 * @returns Point in SVG coordinate space (pixels on original image)
 */
export function screenToSVG(
  svgElement: SVGSVGElement,
  clientX: number,
  clientY: number
): SVGPoint {
  const point = svgElement.createSVGPoint();
  point.x = clientX;
  point.y = clientY;

  // Get the inverse of the screen CTM (Current Transformation Matrix)
  const ctm = svgElement.getScreenCTM();
  if (!ctm) {
    console.error('Failed to get screen CTM');
    return { x: 0, y: 0 };
  }

  // Transform from screen space to SVG space
  const svgPoint = point.matrixTransform(ctm.inverse());

  return {
    x: svgPoint.x,
    y: svgPoint.y
  };
}

/**
 * Clamp a point to be within the floor plan boundaries
 */
export function clampToFloorPlan(
  point: SVGPoint,
  floorPlan: FloorPlan
): SVGPoint {
  const width = floorPlan.original_width || 1920;
  const height = floorPlan.original_height || 1080;

  return {
    x: Math.max(0, Math.min(width, point.x)),
    y: Math.max(0, Math.min(height, point.y))
  };
}

/**
 * Calculate distance between two points
 */
export function distance(p1: SVGPoint, p2: SVGPoint): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate angle between two points in degrees
 */
export function angleBetween(p1: SVGPoint, p2: SVGPoint): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/**
 * Create initial viewBox for a floor plan
 * Handles legacy floor plans without dimensions by using sensible defaults
 */
export function createInitialViewBox(floorPlan: FloorPlan): ViewBox {
  // Use original dimensions if available, otherwise default to 1920x1080
  const width = floorPlan.original_width || 1920;
  const height = floorPlan.original_height || 1080;

  return {
    x: 0,
    y: 0,
    width,
    height
  };
}

/**
 * Zoom viewBox in by a factor
 */
export function zoomViewBox(
  currentViewBox: ViewBox,
  zoomFactor: number,
  centerX?: number,
  centerY?: number
): ViewBox {
  const newWidth = currentViewBox.width / zoomFactor;
  const newHeight = currentViewBox.height / zoomFactor;

  // If center is provided, zoom towards that point
  // Otherwise zoom towards current viewBox center
  const cx = centerX !== undefined ? centerX : currentViewBox.x + currentViewBox.width / 2;
  const cy = centerY !== undefined ? centerY : currentViewBox.y + currentViewBox.height / 2;

  return {
    x: cx - newWidth / 2,
    y: cy - newHeight / 2,
    width: newWidth,
    height: newHeight
  };
}

/**
 * Pan viewBox by delta pixels
 */
export function panViewBox(
  currentViewBox: ViewBox,
  deltaX: number,
  deltaY: number
): ViewBox {
  return {
    ...currentViewBox,
    x: currentViewBox.x + deltaX,
    y: currentViewBox.y + deltaY
  };
}

/**
 * Constrain viewBox to stay within floor plan boundaries
 */
export function constrainViewBox(
  viewBox: ViewBox,
  floorPlan: FloorPlan
): ViewBox {
  const maxWidth = floorPlan.original_width || 1920;
  const maxHeight = floorPlan.original_height || 1080;

  // Don't allow zooming out past full image
  const width = Math.min(viewBox.width, maxWidth);
  const height = Math.min(viewBox.height, maxHeight);

  // Don't allow panning outside image bounds
  const x = Math.max(0, Math.min(viewBox.x, maxWidth - width));
  const y = Math.max(0, Math.min(viewBox.y, maxHeight - height));

  return { x, y, width, height };
}

/**
 * Check if a point is inside a marker's clickable area
 */
export function isPointInMarker(point: SVGPoint, marker: Marker): boolean {
  if (marker.type === 'point') {
    const dist = distance(point, { x: marker.x, y: marker.y });
    return dist <= marker.radius;
  }

  if (marker.type === 'area') {
    const rotation = marker.rotation || 0;
    if (rotation === 0) {
      // Simple axis-aligned rectangle
      const halfW = marker.width / 2;
      const halfH = marker.height / 2;
      return (
        point.x >= marker.x - halfW &&
        point.x <= marker.x + halfW &&
        point.y >= marker.y - halfH &&
        point.y <= marker.y + halfH
      );
    } else {
      // Rotated rectangle - more complex hit detection
      // For now, use bounding circle approximation
      const maxDim = Math.max(marker.width, marker.height);
      return distance(point, { x: marker.x, y: marker.y }) <= maxDim / 2;
    }
  }

  if (marker.type === 'line') {
    // Distance from point to line segment
    const lineLength = distance({ x: marker.x, y: marker.y }, { x: marker.x2, y: marker.y2 });
    if (lineLength === 0) return distance(point, { x: marker.x, y: marker.y }) <= 5;

    const t = Math.max(
      0,
      Math.min(
        1,
        ((point.x - marker.x) * (marker.x2 - marker.x) +
          (point.y - marker.y) * (marker.y2 - marker.y)) /
          (lineLength * lineLength)
      )
    );

    const projX = marker.x + t * (marker.x2 - marker.x);
    const projY = marker.y + t * (marker.y2 - marker.y);

    const dist = distance(point, { x: projX, y: projY });
    return dist <= 10; // 10 pixel tolerance for line clicks
  }

  return false;
}

/**
 * Find marker at a given point (for click detection)
 * Returns topmost marker (last in array) if multiple overlap
 */
export function findMarkerAtPoint(point: SVGPoint, markers: Marker[]): Marker | null {
  // Iterate backwards to get topmost marker
  for (let i = markers.length - 1; i >= 0; i--) {
    if (isPointInMarker(point, markers[i])) {
      return markers[i];
    }
  }
  return null;
}

/**
 * Get marker color based on status
 */
export function getMarkerColor(marker: Marker): string {
  if (marker.status === 'empty') return 'hsl(var(--muted-foreground))';

  // Check for scheduled future content
  if (marker.next_planned_date) {
    const scheduledDate = new Date(marker.next_planned_date);
    if (scheduledDate > new Date()) {
      return 'hsl(var(--primary))'; // scheduled
    }
  }

  // Check if overdue
  if (marker.expiry_date) {
    const expiryDate = new Date(marker.expiry_date);
    if (expiryDate < new Date()) {
      return 'hsl(var(--destructive))'; // overdue
    }

    // Check if expiring soon (within 7 days)
    const daysUntilExpiry = Math.floor(
      (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilExpiry >= 0 && daysUntilExpiry <= 7) {
      return 'hsl(var(--warning))'; // expiring
    }
  }

  return 'hsl(var(--success))'; // current
}

/**
 * Convert viewBox to zoom level (1.0 = fit full image)
 */
export function viewBoxToZoomLevel(viewBox: ViewBox, floorPlan: FloorPlan): number {
  const width = floorPlan.original_width || 1920;
  const height = floorPlan.original_height || 1080;

  const xZoom = width / viewBox.width;
  const yZoom = height / viewBox.height;
  return Math.min(xZoom, yZoom);
}

/**
 * Format coordinate for display
 */
export function formatCoordinate(value: number): string {
  return Math.round(value).toString() + 'px';
}

/**
 * Snap value to grid
 */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Snap point to grid
 */
export function snapPointToGrid(point: SVGPoint, gridSize: number): SVGPoint {
  return {
    x: snapToGrid(point.x, gridSize),
    y: snapToGrid(point.y, gridSize)
  };
}

/**
 * Floor Plan Coordinate System Utilities
 *
 * COORDINATE SYSTEM DESIGN:
 * - Database stores marker positions as percentages (0-100) in marker_x and marker_y
 * - Percentages are ALWAYS relative to the original floor plan image dimensions
 * - When rendering, we convert percentages to pixels based on the current rendered size
 * - This ensures marker positions are consistent regardless of zoom level
 *
 * MIGRATION PATH:
 * - New floor plans: Store original_width and original_height when uploading
 * - Legacy floor plans: original_width/original_height will be null, fallback to current behavior
 * - Future: Backfill original dimensions for existing floor plans
 */

/**
 * Convert pixel coordinates to percentage (0-100) relative to original image dimensions
 * Use this when placing markers from user clicks
 */
export function pixelToPercent(
  pixelX: number,
  pixelY: number,
  imageWidth: number,
  imageHeight: number
): { x: number; y: number } {
  return {
    x: (pixelX / imageWidth) * 100,
    y: (pixelY / imageHeight) * 100
  };
}

/**
 * Convert percentage (0-100) to pixel coordinates for rendering
 * Use this when displaying markers on the floor plan
 *
 * @param percentX - Marker X position as percentage (0-100)
 * @param percentY - Marker Y position as percentage (0-100)
 * @param renderedWidth - Current rendered width of the image element
 * @param renderedHeight - Current rendered height of the image element
 */
export function percentToPixel(
  percentX: number,
  percentY: number,
  renderedWidth: number,
  renderedHeight: number
): { x: number; y: number } {
  return {
    x: (percentX / 100) * renderedWidth,
    y: (percentY / 100) * renderedHeight
  };
}

/**
 * Convert click event coordinates to percentage relative to the image element
 * Handles zoom/pan transforms by using image element's bounding rect
 *
 * @param event - Mouse event from click
 * @param imageElement - The img element displaying the floor plan
 * @returns Percentage coordinates (0-100) or null if image not loaded
 */
export function eventToPercent(
  event: React.MouseEvent,
  imageElement: HTMLImageElement | null
): { x: number; y: number } | null {
  if (!imageElement) return null;

  const rect = imageElement.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;

  const pixelX = event.clientX - rect.left;
  const pixelY = event.clientY - rect.top;

  return pixelToPercent(pixelX, pixelY, rect.width, rect.height);
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Clamp percentage coordinates to valid range (0-100)
 */
export function clampPercent(coords: { x: number; y: number }): { x: number; y: number } {
  return {
    x: clamp(coords.x, 0, 100),
    y: clamp(coords.y, 0, 100)
  };
}

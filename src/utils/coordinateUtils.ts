// Convert pixel coordinates to percentage (0-100)
export function pixelToPercent(
  pixelX: number,
  pixelY: number,
  containerWidth: number,
  containerHeight: number
): { x: number; y: number } {
  return {
    x: (pixelX / containerWidth) * 100,
    y: (pixelY / containerHeight) * 100
  };
}

// Convert percentage to pixel coordinates
export function percentToPixel(
  percentX: number,
  percentY: number,
  containerWidth: number,
  containerHeight: number
): { x: number; y: number } {
  return {
    x: (percentX / 100) * containerWidth,
    y: (percentY / 100) * containerHeight
  };
}

// Clamp value between min and max
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

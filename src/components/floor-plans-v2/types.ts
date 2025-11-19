/**
 * Floor Plan Module V2 - Type Definitions
 *
 * Complete rewrite using pixel-based SVG-native coordinate system.
 * All coordinates are in PIXELS relative to the original floor plan image dimensions.
 */

export interface FloorPlan {
  id: string;
  venue: string;
  level: string;
  display_name: string;
  image_url: string;
  original_width: number | null;   // Image width in pixels (e.g., 1920) - null for legacy plans
  original_height: number | null;  // Image height in pixels (e.g., 1080) - null for legacy plans
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

export type MarkerType = 'point' | 'area' | 'line';

export interface MarkerBase {
  id: string;
  signage_spot_id: string;
  floor_plan_id: string;
  location_name: string;
  type: MarkerType;
  x: number;          // X coordinate in pixels (relative to original image)
  y: number;          // Y coordinate in pixels (relative to original image)
  rotation?: number;  // Rotation in degrees (0-360)

  // Status/display properties
  status: string;
  expiry_date: string | null;
  next_planned_date: string | null;
  current_image_url: string | null;
  show_on_map: boolean;
}

export interface PointMarker extends MarkerBase {
  type: 'point';
  radius: number;     // Radius in pixels
}

export interface AreaMarker extends MarkerBase {
  type: 'area';
  width: number;      // Width in pixels
  height: number;     // Height in pixels
}

export interface LineMarker extends MarkerBase {
  type: 'line';
  x2: number;         // End X coordinate in pixels
  y2: number;         // End Y coordinate in pixels
}

export type Marker = PointMarker | AreaMarker | LineMarker;

export type EditorMode =
  | 'view'           // Read-only viewing
  | 'select'         // Select and move existing markers
  | 'place-point'    // Placing new point marker
  | 'place-area'     // Placing new area marker
  | 'place-line'     // Placing new line marker
  | 'edit';          // Editing selected marker

export interface EditorState {
  mode: EditorMode;
  selectedMarkerIds: string[];
  placementType: MarkerType | null;
  placementSpotId: string | null;  // Signage spot being placed
  placementSpotName: string | null;
  draftMarker: Partial<Marker> | null;  // Marker being placed/edited
  draggedMarkerOverride: Partial<Marker> | null; // Optimistic update for dragged marker
  history: HistoryEntry[];
  historyIndex: number;
  viewBox: ViewBox;
  isDragging: boolean;
  dragStartPos: SVGPoint | null;
  dragOffset: SVGPoint | null; // Offset from mouse position to marker center
  isResizing: boolean;
  resizeHandle: string | null;
  resizeStartMarker: Marker | null; // Original state before resize

}

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HistoryEntry {
  type: 'add' | 'update' | 'delete' | 'batch';
  markers: Marker[];
  timestamp: number;
}

export type EditorAction =
  | { type: 'SET_MODE'; mode: EditorMode }
  | { type: 'SELECT_MARKER'; markerId: string; multiSelect?: boolean }
  | { type: 'DESELECT_ALL' }
  | { type: 'START_PLACEMENT'; markerType: MarkerType; spotId: string; spotName: string }
  | { type: 'SET_DRAFT_MARKER'; marker: Partial<Marker> }
  | { type: 'COMMIT_DRAFT_MARKER'; marker: Marker }
  | { type: 'SET_FOCUS_CONTEXT'; spotId: string; spotName: string }
  | { type: 'CANCEL_DRAFT' }
  | { type: 'DELETE_MARKER'; markerId: string }
  | { type: 'UPDATE_MARKER'; marker: Marker }
  | { type: 'SET_VIEW_BOX'; viewBox: ViewBox }
  | { type: 'ZOOM_IN'; centerX?: number; centerY?: number }
  | { type: 'ZOOM_OUT'; centerX?: number; centerY?: number }
  | { type: 'RESET_VIEW' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'START_DRAG'; x: number; y: number; markerId: string; marker: Marker }
  | { type: 'DRAG'; x: number; y: number }
  | { type: 'END_DRAG' }
  | { type: 'START_RESIZE'; handle: string; markerId: string; marker: Marker }
  | { type: 'RESIZE'; x: number; y: number }
  | { type: 'END_RESIZE' };

export interface SVGPoint {
  x: number;
  y: number;
}

export interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  markerIds: string[];
  originalPositions: Map<string, SVGPoint>;
}

export interface MarkerStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  cursor: string;
}

export interface MarkerColorConfig {
  current: string;
  expiring: string;
  overdue: string;
  empty: string;
  scheduled: string;
}

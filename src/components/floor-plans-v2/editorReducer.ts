/**
 * Floor Plan Module V2 - Editor State Reducer
 *
 * Manages all editor state changes with undo/redo support
 */

import { EditorState, EditorAction, ViewBox, Marker, HistoryEntry, FloorPlan, AreaMarker, LineMarker } from './types';
import { createInitialViewBox, zoomViewBox, panViewBox, constrainViewBox } from './utils';

const MAX_HISTORY = 50;

export function createInitialEditorState(floorPlan: FloorPlan): EditorState {
  return {
    mode: 'view',
    selectedMarkerIds: [],
    placementType: null,
    placementSpotId: null,
    placementSpotName: null,
    draftMarker: null,
    history: [],
    historyIndex: -1,
    viewBox: createInitialViewBox(floorPlan),
    isDragging: false,
    dragStartPos: null,
    dragOffset: null,
    isResizing: false,
    resizeHandle: null,
    resizeStartMarker: null,
    draggedMarkerOverride: null,
    dragStartMarker: null
  };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_MODE':
      return {
        ...state,
        mode: action.mode,
        selectedMarkerIds: action.mode === 'view' ? [] : state.selectedMarkerIds,
        draftMarker: null
      };

    case 'SELECT_MARKER':
      if (action.multiSelect) {
        // Toggle selection with Ctrl/Cmd
        const isSelected = state.selectedMarkerIds.includes(action.markerId);
        return {
          ...state,
          selectedMarkerIds: isSelected
            ? state.selectedMarkerIds.filter(id => id !== action.markerId)
            : [...state.selectedMarkerIds, action.markerId],
          mode: 'select'
        };
      } else {
        // Single selection
        return {
          ...state,
          selectedMarkerIds: [action.markerId],
          mode: 'select'
        };
      }

    case 'DESELECT_ALL':
      return {
        ...state,
        selectedMarkerIds: [],
        mode: 'view'
      };

    case 'START_PLACEMENT': {
      const placementMode = `place-${action.markerType}` as EditorMode;
      return {
        ...state,
        mode: placementMode,
        placementType: action.markerType,
        placementSpotId: action.spotId,
        placementSpotName: action.spotName,
        selectedMarkerIds: [],
        draftMarker: null
      };
    }

    case 'SET_DRAFT_MARKER':
      return {
        ...state,
        draftMarker: action.marker
      };

    case 'COMMIT_DRAFT_MARKER': {
      // Add to history
      const newHistory: HistoryEntry[] = [
        ...state.history.slice(0, state.historyIndex + 1),
        {
          type: 'add' as const,
          markers: [action.marker],
          timestamp: Date.now()
        }
      ].slice(-MAX_HISTORY);

      return {
        ...state,
        draftMarker: null,
        mode: 'select', // Switch to select mode to allow moving/resizing
        selectedMarkerIds: [action.marker.id], // Auto-select the new marker
        history: newHistory,
        historyIndex: newHistory.length - 1
      };
    }

    case 'SET_FOCUS_CONTEXT':
      return {
        ...state,
        placementSpotId: action.spotId,
        placementSpotName: action.spotName
      };

    case 'CANCEL_DRAFT': {
      const preserveContext = action.preserveContext;
      return {
        ...state,
        draftMarker: null,
        placementType: null,
        placementSpotId: preserveContext ? state.placementSpotId : null,
        placementSpotName: preserveContext ? state.placementSpotName : null,
        mode: preserveContext ? state.mode : 'view'
      };
    }

    case 'DELETE_MARKER':
      // This is handled at component level with database delete
      // But we track it in history
      return state;

    case 'UPDATE_MARKER': {
      // Track in history
      const updateHistory: HistoryEntry[] = [
        ...state.history.slice(0, state.historyIndex + 1),
        {
          type: 'update' as const,
          markers: [action.marker],
          timestamp: Date.now()
        }
      ].slice(-MAX_HISTORY);

      return {
        ...state,
        history: updateHistory,
        historyIndex: updateHistory.length - 1
      };
    }

    case 'SET_VIEW_BOX':
      return {
        ...state,
        viewBox: action.viewBox
      };

    case 'ZOOM_IN': {
      const newViewBox = zoomViewBox(
        state.viewBox,
        1.5,
        action.centerX,
        action.centerY
      );
      return {
        ...state,
        viewBox: newViewBox
      };
    }

    case 'ZOOM_OUT': {
      const newViewBox = zoomViewBox(
        state.viewBox,
        0.67,
        action.centerX,
        action.centerY
      );
      return {
        ...state,
        viewBox: newViewBox
      };
    }

    case 'RESET_VIEW':
      // Reset will be handled by parent component with floor plan dimensions
      return state;

    case 'UNDO':
      if (state.historyIndex > 0) {
        return {
          ...state,
          historyIndex: state.historyIndex - 1
        };
      }
      return state;

    case 'REDO':
      if (state.historyIndex < state.history.length - 1) {
        return {
          ...state,
          historyIndex: state.historyIndex + 1
        };
      }
      return state;

    case 'START_DRAG':
      return {
        ...state,
        isDragging: true,
        dragStartPos: { x: action.x, y: action.y },
        // Calculate offset: Mouse Pos - Marker Pos
        // When dragging, we want: New Marker Pos = New Mouse Pos - Offset
        dragOffset: {
          x: action.x - action.marker.x,
          y: action.y - action.marker.y
        },
        draggedMarkerOverride: action.marker,
        dragStartMarker: action.marker
      };

    case 'DRAG': {
      if (
        !state.isDragging ||
        !state.draggedMarkerOverride ||
        !state.dragOffset ||
        !state.dragStartMarker
      ) {
        return state;
      }

      const nextX = action.x - state.dragOffset.x;
      const nextY = action.y - state.dragOffset.y;
      const startMarker = state.dragStartMarker;
      const deltaX = nextX - startMarker.x;
      const deltaY = nextY - startMarker.y;

      let updatedMarker: Marker = {
        ...state.draggedMarkerOverride,
        x: nextX,
        y: nextY
      };

      if (startMarker.type === 'line') {
        const lineStart = startMarker as LineMarker;
        updatedMarker = {
          ...updatedMarker,
          x2: lineStart.x2 + deltaX,
          y2: lineStart.y2 + deltaY
        };
      }

      return {
        ...state,
        draggedMarkerOverride: updatedMarker
      };
    }

    case 'END_DRAG':
      return {
        ...state,
        isDragging: false,
        dragStartPos: null,
        dragOffset: null,
        draggedMarkerOverride: null,
        dragStartMarker: null
      };

    case 'START_RESIZE':
      return {
        ...state,
        isResizing: true,
        resizeHandle: action.handle,
        resizeStartMarker: action.marker,
        draggedMarkerOverride: action.marker // Initialize override
      };

    case 'RESIZE': {
      if (!state.isResizing || !state.resizeStartMarker || !state.resizeHandle) return state;

      const original = state.resizeStartMarker;
      const currentX = action.x;
      const currentY = action.y;
      let newMarker = { ...original };

      if (original.type === 'area') {
        const area = original as AreaMarker;
        const rotation = area.rotation || 0;

        // Calculate original corner positions (without rotation for simplicity)
        // When we support rotation, we'll need to rotate these points
        const halfW = area.width / 2;
        const halfH = area.height / 2;

        // Define the four corners (relative to center)
        const corners = {
          nw: { x: area.x - halfW, y: area.y - halfH },
          ne: { x: area.x + halfW, y: area.y - halfH },
          se: { x: area.x + halfW, y: area.y + halfH },
          sw: { x: area.x - halfW, y: area.y + halfH }
        };

        // Determine which corner stays fixed (opposite of the handle being dragged)
        let fixedCorner: { x: number; y: number };
        let movingCorner: { x: number; y: number };

        if (state.resizeHandle === 'nw') {
          fixedCorner = corners.se;
          movingCorner = { x: currentX, y: currentY };
        } else if (state.resizeHandle === 'ne') {
          fixedCorner = corners.sw;
          movingCorner = { x: currentX, y: currentY };
        } else if (state.resizeHandle === 'se') {
          fixedCorner = corners.nw;
          movingCorner = { x: currentX, y: currentY };
        } else if (state.resizeHandle === 'sw') {
          fixedCorner = corners.ne;
          movingCorner = { x: currentX, y: currentY };
        } else {
          return state;
        }

        // Calculate new dimensions and center
        const newWidth = Math.abs(movingCorner.x - fixedCorner.x);
        const newHeight = Math.abs(movingCorner.y - fixedCorner.y);
        const newCenterX = (fixedCorner.x + movingCorner.x) / 2;
        const newCenterY = (fixedCorner.y + movingCorner.y) / 2;

        // Enforce minimum size
        const MIN_SIZE = 20;
        if (newWidth < MIN_SIZE || newHeight < MIN_SIZE) {
          return state; // Don't update if too small
        }

        newMarker = {
          ...area,
          x: newCenterX,
          y: newCenterY,
          width: newWidth,
          height: newHeight
        };
      } else if (original.type === 'line') {
        const line = original as LineMarker;
        if (state.resizeHandle === 'start') {
          newMarker = { ...line, x: currentX, y: currentY };
        } else if (state.resizeHandle === 'end') {
          newMarker = { ...line, x2: currentX, y2: currentY };
        }
      }

      return {
        ...state,
        draggedMarkerOverride: newMarker
      };
    }

    case 'END_RESIZE':
      return {
        ...state,
        isResizing: false,
        resizeHandle: null,
        resizeStartMarker: null,
        draggedMarkerOverride: null
      };

    default:
      return state;
  }
}

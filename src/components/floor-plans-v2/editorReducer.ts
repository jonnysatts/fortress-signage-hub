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
        // Calculate new dimensions based on handle
        // This is a simplified implementation - for rotation support it gets complex
        // Assuming 0 rotation for now or simple bounding box resizing

        if (state.resizeHandle === 'se') {
          newMarker = {
            ...area,
            width: Math.max(10, currentX - area.x + area.width / 2),
            height: Math.max(10, currentY - area.y + area.height / 2)
          };
        } else if (state.resizeHandle === 'sw') {
          const newWidth = Math.max(10, area.x + area.width / 2 - currentX);
          newMarker = {
            ...area,
            x: area.x - (newWidth - area.width) / 2, // Adjust center X
            width: newWidth,
            height: Math.max(10, currentY - area.y + area.height / 2)
          };
        } else if (state.resizeHandle === 'ne') {
          const newHeight = Math.max(10, area.y + area.height / 2 - currentY);
          newMarker = {
            ...area,
            y: area.y - (newHeight - area.height) / 2, // Adjust center Y
            width: Math.max(10, currentX - area.x + area.width / 2),
            height: newHeight
          };
        } else if (state.resizeHandle === 'nw') {
          const newWidth = Math.max(10, area.x + area.width / 2 - currentX);
          const newHeight = Math.max(10, area.y + area.height / 2 - currentY);
          newMarker = {
            ...area,
            x: area.x - (newWidth - area.width) / 2,
            y: area.y - (newHeight - area.height) / 2,
            width: newWidth,
            height: newHeight
          };
        }
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

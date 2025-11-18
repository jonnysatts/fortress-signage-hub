/**
 * Floor Plan Module V2 - Editor State Reducer
 *
 * Manages all editor state changes with undo/redo support
 */

import { EditorState, EditorAction, ViewBox, Marker, HistoryEntry, FloorPlan } from './types';
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
    dragStartPos: null
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

    case 'START_PLACEMENT':
      return {
        ...state,
        mode: `place-${action.markerType}` as any,
        placementType: action.markerType,
        placementSpotId: action.spotId,
        placementSpotName: action.spotName,
        selectedMarkerIds: [],
        draftMarker: null
      };

    case 'SET_DRAFT_MARKER':
      return {
        ...state,
        draftMarker: action.marker
      };

    case 'COMMIT_DRAFT_MARKER':
      // Add to history
      const newHistory: HistoryEntry[] = [
        ...state.history.slice(0, state.historyIndex + 1),
        {
          type: 'add',
          markers: [action.marker],
          timestamp: Date.now()
        }
      ].slice(-MAX_HISTORY);

      return {
        ...state,
        draftMarker: null,
        placementType: null,
        placementSpotId: null,
        placementSpotName: null,
        mode: 'view',
        history: newHistory,
        historyIndex: newHistory.length - 1
      };

    case 'CANCEL_DRAFT':
      return {
        ...state,
        draftMarker: null,
        placementType: null,
        placementSpotId: null,
        placementSpotName: null,
        mode: 'view'
      };

    case 'DELETE_MARKER':
      // This is handled at component level with database delete
      // But we track it in history
      return state;

    case 'UPDATE_MARKER':
      // Track in history
      const updateHistory: HistoryEntry[] = [
        ...state.history.slice(0, state.historyIndex + 1),
        {
          type: 'update',
          markers: [action.marker],
          timestamp: Date.now()
        }
      ].slice(-MAX_HISTORY);

      return {
        ...state,
        history: updateHistory,
        historyIndex: updateHistory.length - 1
      };

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
        dragStartPos: { x: action.x, y: action.y }
      };

    case 'DRAG':
      // Dragging is handled in component with live SVG updates
      return state;

    case 'END_DRAG':
      return {
        ...state,
        isDragging: false,
        dragStartPos: null
      };

    default:
      return state;
  }
}

/**
 * Floor Plan Module V2 - Controls Component
 *
 * Zoom, pan, tool selection, and utility controls
 */

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Move,
  MousePointer2,
  Circle,
  Square,
  Minus,
  Grid3x3,
  Undo2,
  Redo2,
  Save,
  X,
  Trash2
} from 'lucide-react';
import { EditorMode } from './types';

interface FloorPlanControlsProps {
  mode: EditorMode;
  canUndo: boolean;
  canRedo: boolean;
  showGrid: boolean;
  zoomLevel: number;
  selectedCount?: number;
  placementSpotName?: string | null;
  onModeChange: (mode: EditorMode) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleGrid: () => void;
  onDeleteSelected?: () => void;
  onCancelPlacement?: () => void;
  onSave?: () => void;
}

export default function FloorPlanControls({
  mode,
  canUndo,
  canRedo,
  showGrid,
  zoomLevel,
  selectedCount = 0,
  placementSpotName,
  onModeChange,
  onZoomIn,
  onZoomOut,
  onResetView,
  onUndo,
  onRedo,
  onToggleGrid,
  onDeleteSelected,
  onCancelPlacement,
  onSave
}: FloorPlanControlsProps) {
  const isPlacementMode = mode.startsWith('place-');

  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-background border-b">
      {/* Left: Mode/Tool Selection */}
      <div className="flex items-center gap-2">
        {isPlacementMode && placementSpotName ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg">
            <span className="text-sm font-medium">Placing: {placementSpotName}</span>
            <Badge variant="outline" className="ml-2">
              {mode === 'place-point' ? 'Circle' : mode === 'place-area' ? 'Rectangle' : 'Line'}
            </Badge>
            {onCancelPlacement && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancelPlacement}
                className="ml-2"
              >
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
            )}
          </div>
        ) : (
          <>
            <Button
              variant={mode === 'view' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onModeChange('view')}
              title="View mode - read only"
            >
              <MousePointer2 className="w-4 h-4" />
            </Button>

            <Button
              variant={mode === 'select' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onModeChange('select')}
              title="Select mode - move markers"
            >
              <Move className="w-4 h-4" />
            </Button>

            <Separator orientation="vertical" className="h-6" />

            <Button
              variant={mode === 'place-point' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onModeChange('place-point')}
              title="Place circle marker"
            >
              <Circle className="w-4 h-4" />
            </Button>

            <Button
              variant={mode === 'place-area' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onModeChange('place-area')}
              title="Place rectangle marker"
            >
              <Square className="w-4 h-4" />
            </Button>

            <Button
              variant={mode === 'place-line' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onModeChange('place-line')}
              title="Place line marker"
            >
              <Minus className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>

      {/* Center: Zoom Controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onZoomOut}
          title="Zoom out (or scroll down)"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>

        <span className="text-sm text-muted-foreground min-w-[60px] text-center">
          {Math.round(zoomLevel * 100)}%
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={onZoomIn}
          title="Zoom in (or scroll up)"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onResetView}
          title="Reset zoom and pan"
        >
          <Maximize className="w-4 h-4" />
        </Button>
      </div>

      {/* Right: Utility Controls */}
      <div className="flex items-center gap-2">
        <Button
          variant={showGrid ? 'default' : 'outline'}
          size="sm"
          onClick={onToggleGrid}
          title="Toggle grid overlay"
        >
          <Grid3x3 className="w-4 h-4" />
        </Button>

        <Separator orientation="vertical" className="h-6" />

        <Button
          variant="outline"
          size="sm"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 className="w-4 h-4" />
        </Button>

        {selectedCount > 0 && onDeleteSelected && (
          <>
            <Separator orientation="vertical" className="h-6" />
            <Button
              variant="destructive"
              size="sm"
              onClick={onDeleteSelected}
              title={`Delete ${selectedCount} selected marker${selectedCount > 1 ? 's' : ''} (Delete/Backspace)`}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete ({selectedCount})
            </Button>
          </>
        )}

        {onSave && (
          <>
            <Separator orientation="vertical" className="h-6" />
            <Button
              variant="default"
              size="sm"
              onClick={onSave}
              title="Save changes"
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

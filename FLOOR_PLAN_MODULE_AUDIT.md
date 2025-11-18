# Floor Plan Module - Comprehensive Audit & Issues

## Executive Summary
The floor plan module is fundamentally broken due to:
1. **Multiple coordinate system bugs** - markers drift, disappear, or appear in wrong locations
2. **Code duplication** - same components exist in multiple places with slight variations
3. **Confusing UX** - placement workflow is not intuitive, buttons don't work as expected
4. **Zoom breaks everything** - coordinate calculations don't account for zoom properly
5. **No undo/recovery** - mistakes are permanent and hard to fix
6. **SVG vs HTML mixing** - inconsistent coordinate spaces

**Recommendation**: REWRITE from scratch with clear architecture.

---

## File Inventory

### Pages
1. `/src/pages/FloorPlans.tsx` - **View mode** (read-only floor plan viewer)
2. `/src/pages/FloorPlanManager.tsx` - **Upload manager** (create/edit/delete floor plans)
3. `/src/pages/FloorPlanEditor.tsx` - **Edit mode** (place & move markers)

### Components
4. `/src/components/FloorPlanViewer.tsx` - **DUPLICATE** viewer component (292 lines)
5. `/src/components/floor-plans/FloorPlanViewer.tsx` - **DUPLICATE** viewer (296 lines)
6. `/src/components/FloorPlanViewerHighlight.tsx` - Viewer with spot highlighting
7. `/src/components/FloorPlanMiniWidget.tsx` - Thumbnail in signage detail page
8. `/src/components/AddToFloorPlanDialog.tsx` - Dialog to select floor plan for a spot

### Utilities
9. `/src/utils/coordinateUtils.ts` - Coordinate conversion functions
10. `/src/utils/markerUtils.ts` - Marker color/status functions

---

## Critical Issues

### 🔴 ISSUE #1: Dual FloorPlanViewer Components
**Location**: `/src/components/FloorPlanViewer.tsx` AND `/src/components/floor-plans/FloorPlanViewer.tsx`

**Problem**: Two nearly identical components exist. They have slightly different logic:
- One uses zoom compensation (OLD, buggy)
- One doesn't (NEW, from my recent fix)

**Impact**: Developers edit one but the other gets used, causing confusion.

**Fix**: DELETE one, consolidate into single source of truth.

---

### 🔴 ISSUE #2: Zoom Breaks Marker Positioning (FloorPlanEditor.tsx)

**Location**: `/src/pages/FloorPlanEditor.tsx`

**Problem**:
- Uses `react-zoom-pan-pinch` library for zoom/pan
- TransformWrapper applies CSS transforms to entire container
- Marker coordinates stored as percentages (0-100)
- BUT: Click events use `getBoundingClientRect()` which gives ZOOMED pixel positions
- Conversion from click → percentage → pixels happens in wrong order

**Example Bug Flow**:
1. User zooms in 2x on floor plan
2. User clicks at pixel (400, 300) on screen
3. Code converts (400, 300) to percentage using ZOOMED container size
4. Percentage is wrong because container is 2x larger than original
5. Marker appears in wrong spot

**Current Code**:
```typescript
// Line 214: This gets percent from event
const coords = eventToPercent(e, imageRef.current);

// But eventToPercent uses getBoundingClientRect() which includes zoom!
const rect = imageElement.getBoundingClientRect();
const pixelX = event.clientX - rect.left; // ← WRONG when zoomed
const pixelY = event.clientY - rect.top;  // ← WRONG when zoomed
```

**Fix Needed**:
- Get UNZOOMED image dimensions
- Account for transform state from TransformWrapper
- Convert click coordinates through transform matrix first

---

### 🔴 ISSUE #3: Line Markers Use Different Coordinate System

**Location**: `/src/pages/FloorPlanEditor.tsx` lines 241-288

**Problem**:
- Circle/rectangle markers: Position stored as (x%, y%)
- Line markers: Position stored as (x%, y%) + length in PIXELS + rotation angle
- Length calculation uses container rect width/height which changes with zoom
- Line doesn't render at correct length when viewed later

**Current Code**:
```typescript
// Line 244: Calculate length using CURRENT container size
const rect = imageRef.current.getBoundingClientRect();
const dxPx = ((draftEnd.x - draftStart.x) / 100) * rect.width;
const length = Math.max(5, Math.round(Math.hypot(dxPx, dyPx)));
```

**Problem**: `rect.width` changes every time user zooms. Length should be stored as percentage or relative to original image dimensions.

---

### 🔴 ISSUE #4: FloorPlanMiniWidget Uses SVG Percentage Coords Wrong

**Location**: `/src/components/FloorPlanMiniWidget.tsx` lines 146-222

**Problem**:
- SVG viewBox is in percentage space (0-100)
- Marker coordinates are percentages
- But marker_size is in PIXELS
- Conversion `marker_size / 20` is arbitrary and breaks at different zoom levels

**Current Code**:
```typescript
// Line 189: Circle radius in SVG with arbitrary division
r={spotData.marker_size / 20}

// Line 214: Line length also arbitrary
y2={spotData.marker_y + (spotData.marker_size / 10)}
```

**Fix**: Marker size should be percentage-based OR SVG should use pixel viewBox.

---

### 🔴 ISSUE #5: No Transform Matrix Handling

**Location**: All components using `react-zoom-pan-pinch`

**Problem**:
- TransformWrapper applies CSS transforms: `translate()` and `scale()`
- Click events give screen coordinates
- Need to convert screen → SVG coordinates accounting for transform
- Current code ignores transform matrix completely

**What's Needed**:
```typescript
// Get transform state from TransformWrapper
const { state } = useTransformContext(); // scale, positionX, positionY

// Convert screen click to SVG coordinates
const screenX = event.clientX;
const screenY = event.clientY;
const svgX = (screenX - state.positionX) / state.scale;
const svgY = (screenY - state.positionY) / state.scale;
```

**Current code doesn't do this AT ALL**.

---

### 🔴 ISSUE #6: Markers Mysteriously Disappear

**Root Cause**: Multiple issues compound:
1. Marker coordinates stored as percentages relative to container
2. Container size changes with window resize, zoom, or CSS
3. If marker stored at 105% or -5% (outside 0-100 range), it's off-screen
4. No validation or clamping when coordinates saved
5. `show_on_map` flag can be false, hiding marker
6. `marker_x` or `marker_y` can be NULL

**Scenarios**:
- User places marker near edge → resizes window → marker % now >100 → disappears
- User accidentally drags marker off-canvas → saves NULL → disappears
- Database trigger or migration sets show_on_map=false → disappears

---

### 🟡 ISSUE #7: Confusing Placement Workflow

**User Journey**:
1. User clicks "Add to Floor Plan" button on signage detail page
2. Dialog opens to select floor plan and marker type
3. User clicks "Continue to Place Marker"
4. Navigates to FloorPlanEditor with `?spotToPlace=<id>&markerType=<type>`
5. User must click on floor plan to place marker (for circle/rectangle)
6. OR user must click-drag-release-submit (for lines)
7. After placement, redirects back to signage detail

**Problems**:
- Step 4-6 not obvious - no clear visual instructions
- "Placement mode" isn't clearly indicated
- Line placement requires reading instructions, very unintuitive
- No preview before confirming
- Can't cancel easily - must navigate away manually

---

### 🟡 ISSUE #8: Dragging Markers is Janky

**Location**: `/src/pages/FloorPlanEditor.tsx` lines 348-361

**Problem**:
1. User clicks marker → `handleMarkerDragStart` sets `isDragging: true`
2. Mouse move → `handleMarkerDrag` updates marker position in state
3. Re-render happens → marker jumps around
4. Mouse up → `handleMarkerDragEnd` saves to database

**Issues**:
- No debouncing - re-renders on every mouse pixel movement
- State updates cause jank
- Zoom breaks drag calculations (same transform matrix issue)
- No visual feedback during drag (no ghost/preview)

---

### 🟡 ISSUE #9: Grid Overlay Doesn't Help

**Location**: `/src/pages/FloorPlanEditor.tsx` lines 871-895

**Current**: Shows 10x10 percentage grid using SVG lines

**Problems**:
- Grid doesn't account for floor plan aspect ratio
- Percentages aren't useful for physical measurements
- Should show measurements in feet/meters if floor plan has scale
- Grid doesn't snap markers

---

### 🟡 ISSUE #10: Calibration Overlay Not Integrated

**Location**: `/src/pages/FloorPlanEditor.tsx` line 922

**Status**: Calibration overlay component exists but:
- Shows crosshair, scale bar, pixel readout
- BUT doesn't DO anything
- No way to set scale (e.g., "100px = 10 feet")
- Markers not validated against calibration
- Just visual reference, not functional

---

### 🟡 ISSUE #11: No Undo/Redo

**Problem**: Once marker placed or moved, can't undo.

**Impact**:
- User accidentally drags marker → permanent mistake
- Must manually remember old position and drag back
- Or delete and re-add (loses marker_id)

**Needed**: History stack with undo/redo buttons.

---

### 🟡 ISSUE #12: No Marker Validation

**Missing Checks**:
- Marker coordinates can be negative or >100
- Marker can overlap other markers (no collision detection)
- No warning if marker placed off visible area
- No validation that floor_plan_id exists
- Can have duplicate markers for same spot on different plans

---

## Architecture Problems

### Problem A: Mixing SVG and HTML Coordinate Spaces

**SVG**: Uses viewBox coordinate system (can be any units)
**HTML**: Uses pixel coordinates (client/screen space)
**CSS Transforms**: Apply matrix transforms to HTML

**Current Approach**:
- Floor plan image rendered in `<img>` tag (HTML)
- Markers rendered in `<svg>` overlay (SVG)
- Click events from HTML container
- Coordinates stored as percentages (abstract)
- Zoom applied as CSS transform (HTML)

**This is a MESS**. Should pick ONE coordinate system.

---

### Problem B: Percentage Storage Without Image Dimensions

**Current**: Markers stored as percentages (marker_x: 0-100, marker_y: 0-100)
**Issue**: Percentage of WHAT?

If floor plan image is:
- 1000x500px → 50% = 500px, 250px
- 2000x1000px → 50% = 1000px, 500px

**Database doesn't store original image dimensions**.

My migration added `original_width` and `original_height` columns but:
1. Not populated for existing floor plans
2. Not used in coordinate calculations yet
3. Upload flow doesn't capture dimensions

---

### Problem C: State Management Chaos

**FloorPlanEditor has too much state**:
```typescript
const [markers, setMarkers] = useState<Marker[]>([]);
const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
const [selectedSpotToAdd, setSelectedSpotToAdd] = useState<string>("");
const [markerType, setMarkerType] = useState<string>("circle");
const [markerSize, setMarkerSize] = useState<number>(30);
const [placementMode, setPlacementMode] = useState(false);
const [draftStart, setDraftStart] = useState<...>(null);
const [draftEnd, setDraftEnd] = useState<...>(null);
const [isDrawingDraft, setIsDrawingDraft] = useState(false);
const [containerSize, setContainerSize] = useState({...});
// ... 15+ state variables
```

**Result**: Hard to debug, easy to get into invalid states.

---

## Recommended Solution: REWRITE

### Option 1: Fix Incrementally (NOT RECOMMENDED)
- Fix coordinate calculations
- Add transform matrix handling
- Consolidate duplicate components
- Add undo/redo
- Fix line marker coordinate system

**Estimate**: 3-5 days, high risk of new bugs

---

### Option 2: Rewrite from Scratch (RECOMMENDED)

**New Architecture**:

#### 1. **Single Coordinate System: SVG Native**
- Floor plan rendered as SVG `<image>`
- Store original image dimensions in DB
- All coordinates in PIXELS relative to original image
- Render using SVG viewBox (no CSS transforms)
- Zoom = change viewBox, not CSS scale

**Example**:
```typescript
// Database stores pixel coords relative to original image
marker_x: 450 (pixels on 1920x1080 image)
marker_y: 320

// Render with viewBox
<svg viewBox="0 0 1920 1080">
  <image href="floor-plan.jpg" width="1920" height="1080" />
  <circle cx="450" cy="320" r="20" />
</svg>

// Zoom: change viewBox, not CSS
<svg viewBox="200 100 800 600"> <!-- zoomed to show subset -->
```

#### 2. **Simplified Marker Model**
```typescript
interface Marker {
  id: string;
  signage_spot_id: string;
  floor_plan_id: string;
  x: number;          // pixels on original image
  y: number;          // pixels on original image
  type: 'point' | 'area' | 'line';

  // For 'point' type
  radius?: number;    // pixels

  // For 'area' type (rectangle)
  width?: number;     // pixels
  height?: number;    // pixels
  rotation?: number;  // degrees

  // For 'line' type
  x2?: number;        // end point x
  y2?: number;        // end point y
}
```

No more separate `marker_size` in pixels mixed with percentage positions.

#### 3. **Clean Component Structure**
```
FloorPlanCanvas.tsx          <- Single canvas component
  ├─ FloorPlanImage          <- Renders floor plan image
  ├─ FloorPlanMarkers        <- Renders all markers
  ├─ FloorPlanControls       <- Zoom, pan, mode controls
  └─ FloorPlanInteraction    <- Handles clicks, drags

FloorPlanEditor.tsx          <- Page wrapper with tools panel
FloorPlanViewer.tsx          <- Read-only page wrapper
```

#### 4. **State Management with Reducer**
```typescript
type EditorState = {
  mode: 'view' | 'place' | 'edit' | 'select';
  selectedMarkers: string[];
  placementType: MarkerType | null;
  history: Marker[][];  // for undo/redo
  historyIndex: number;
};

const [state, dispatch] = useReducer(editorReducer, initialState);
```

#### 5. **SVG Click to Marker Coords**
```typescript
const handleSvgClick = (event: React.MouseEvent<SVGSVGElement>) => {
  const svg = event.currentTarget;
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;

  // Get transform from screen to SVG coordinates
  const ctm = svg.getScreenCTM();
  const svgPoint = point.matrixTransform(ctm.inverse());

  // svgPoint.x and svgPoint.y are now in SVG coordinates (pixels)
  placeMarker(svgPoint.x, svgPoint.y);
};
```

**No more coordinate conversion bugs!**

---

## Migration Plan

### Phase 1: Database Schema
1. Add new columns to `signage_spots`:
   ```sql
   ALTER TABLE signage_spots
   ADD COLUMN marker_x_px INTEGER,
   ADD COLUMN marker_y_px INTEGER,
   ADD COLUMN marker_x2_px INTEGER,  -- for line endpoints
   ADD COLUMN marker_y2_px INTEGER;
   ```

2. Add image dimensions to `floor_plans` (already done in migration)

3. Backfill pixel coordinates from percentages:
   ```sql
   -- For each marker, convert % to pixels
   -- Need original image dimensions first
   ```

### Phase 2: New Components
1. Build new `FloorPlanCanvas.tsx` with SVG-native approach
2. Test thoroughly with one floor plan
3. Add undo/redo
4. Add snap-to-grid

### Phase 3: Replace Old Components
1. Swap new canvas into FloorPlanEditor
2. Swap new canvas into FloorPlanViewer
3. Update FloorPlanMiniWidget
4. Delete duplicate components

### Phase 4: Polish
1. Add keyboard shortcuts
2. Add marker templates
3. Add batch operations
4. Add export/import

**Estimate**: 5-7 days for full rewrite

---

## Quick Wins (If Not Rewriting)

If you want to fix the WORST issues without full rewrite:

### Quick Fix #1: Delete Duplicate FloorPlanViewer
```bash
rm src/components/FloorPlanViewer.tsx
# Update imports to use src/components/floor-plans/FloorPlanViewer.tsx
```

### Quick Fix #2: Fix Zoom Coordinate Bug
In `FloorPlanEditor.tsx`, get transform state:
```typescript
import { useTransformContext } from "react-zoom-pan-pinch";

const Controls = () => {
  const { zoomIn, zoomOut, resetTransform, transformState } = useControls();

  // Pass transformState down to coordinate calculations
};
```

### Quick Fix #3: Clamp Marker Coordinates
Before saving:
```typescript
const clampedX = Math.max(0, Math.min(100, coords.x));
const clampedY = Math.max(0, Math.min(100, coords.y));
```

### Quick Fix #4: Add Placement Instructions
Show modal when entering placement mode:
```
┌─────────────────────────────────────┐
│ Placing Marker: "Bar Sign #3"      │
├─────────────────────────────────────┤
│ Click anywhere on the floor plan to│
│ place this marker.                  │
│                                     │
│ [Cancel] [✓ Place Marker]          │
└─────────────────────────────────────┘
```

---

## Conclusion

The floor plan module is **fundamentally broken** due to architectural problems:
- Wrong coordinate system approach
- Zoom breaks everything
- Code duplication
- No proper SVG coordinate handling

**My recommendation**:
1. **Short term**: Apply Quick Fixes #1-4 above (1 day)
2. **Medium term**: Full rewrite with SVG-native architecture (5-7 days)

The rewrite will be cleaner, faster, and actually work correctly.

Do you want me to proceed with:
- A) Quick fixes only
- B) Full rewrite
- C) Something else

Let me know and I'll implement whatever you prefer.

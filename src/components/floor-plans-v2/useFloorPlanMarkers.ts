/**
 * Floor Plan Module V2 - Markers Hook
 *
 * Manages loading, saving, and syncing markers with database
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Marker, PointMarker, AreaMarker, LineMarker } from './types';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type SignageSpotRow = Database['public']['Tables']['signage_spots']['Row'];
type SignageSpotUpdate = Database['public']['Tables']['signage_spots']['Update'];
type FloorPlanRow = Database['public']['Tables']['floor_plans']['Row'];
type MarkerRow = SignageSpotRow & {
  floor_plans?: Pick<FloorPlanRow, 'original_width' | 'original_height'> | null;
};

interface UseFloorPlanMarkersResult {
  markers: Marker[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  saveMarker: (marker: Marker) => Promise<boolean>;
  updateMarker: (marker: Marker) => Promise<boolean>;
  deleteMarker: (markerId: string) => Promise<boolean>;
}

/**
 * Hook to manage floor plan markers with database sync
 */
export function useFloorPlanMarkers(floorPlanId: string): UseFloorPlanMarkersResult {
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Convert database row to Marker object
  const dbToMarker = useCallback((row: MarkerRow): Marker | null => {
    // Use new pixel-based columns if available, otherwise fall back to percentage
    const hasPixelData = row.marker_x_pixels !== null;

    if (!hasPixelData && row.marker_x === null) {
      // No position data at all
      return null;
    }

    // Get floor plan dimensions for conversion (default to 1920x1080 if missing)
    // The query now joins floor_plans, so we can access it via row.floor_plans
    const floorWidth = row.floor_plans?.original_width || 1920;
    const floorHeight = row.floor_plans?.original_height || 1080;

    const baseMarker = {
      id: row.id,
      signage_spot_id: row.id,  // In our schema, marker IS the spot
      floor_plan_id: row.floor_plan_id,
      location_name: row.location_name,
      rotation: row.marker_rotation || 0,
      status: row.status,
      expiry_date: row.expiry_date,
      next_planned_date: row.next_planned_date,
      current_image_url: row.current_image_url,
      show_on_map: row.show_on_map
    };

    // Helper to get X coordinate (pixels or converted percentage)
    const getX = (pixelVal: number | null | undefined, percentVal: number | null | undefined) => {
      if (pixelVal !== null) return pixelVal;
      if (percentVal !== null) return (percentVal / 100) * floorWidth;
      return 0;
    };

    // Helper to get Y coordinate (pixels or converted percentage)
    const getY = (pixelVal: number | null | undefined, percentVal: number | null | undefined) => {
      if (pixelVal !== null) return pixelVal;
      if (percentVal !== null) return (percentVal / 100) * floorHeight;
      return 0;
    };

    // Determine marker type and create appropriate object
    const markerType = row.marker_type || 'point';

    if (markerType === 'point' || markerType === 'circle') {
      return {
        ...baseMarker,
        type: 'point',
        x: getX(row.marker_x_pixels, row.marker_x),
        y: getY(row.marker_y_pixels, row.marker_y),
        radius: row.marker_radius_pixels || (row.marker_size ? row.marker_size / 2 : 15)
      } as PointMarker;
    }

    if (markerType === 'area' || markerType === 'rectangle') {
      return {
        ...baseMarker,
        type: 'area',
        x: getX(row.marker_x_pixels, row.marker_x),
        y: getY(row.marker_y_pixels, row.marker_y),
        width: row.marker_width_pixels || row.marker_size || 30,
        height: row.marker_height_pixels || row.marker_size || 30
      } as AreaMarker;
    }

    if (markerType === 'line') {
      const x1 = getX(row.marker_x_pixels, row.marker_x);
      const y1 = getY(row.marker_y_pixels, row.marker_y);

      // For legacy lines, we need to estimate the second point if it doesn't exist
      // Usually legacy lines were just points, but if we have to render them as lines:
      let x2, y2;

      if (row.marker_x2_pixels !== null) {
        x2 = row.marker_x2_pixels;
      } else {
        // Default length for converted lines
        x2 = x1 + 50;
      }

      if (row.marker_y2_pixels !== null) {
        y2 = row.marker_y2_pixels;
      } else {
        y2 = y1;
      }

      return {
        ...baseMarker,
        type: 'line',
        x: x1,
        y: y1,
        x2: x2,
        y2: y2
      } as LineMarker;
    }

    return null;
  }, []);

  // Load markers from database
  const loadMarkers = useCallback(async () => {
    // Don't attempt to load if floor plan ID is missing/invalid
    if (!floorPlanId || floorPlanId === '') {
      console.warn('Cannot load markers: floor plan ID is empty');
      setMarkers([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('signage_spots')
        .select(`
          id, location_name, floor_plan_id, marker_type, 
          marker_x, marker_y, marker_x_pixels, marker_y_pixels, 
          marker_x2_pixels, marker_y2_pixels, marker_width_pixels, 
          marker_height_pixels, marker_radius_pixels, marker_size, 
          marker_rotation, status, expiry_date, next_planned_date, 
          current_image_url, show_on_map,
          floor_plans (
            original_width,
            original_height
          )
        `)
        .eq('floor_plan_id', floorPlanId)
        .eq('show_on_map', true)
        // Don't filter out markers without pixel data - we'll handle both old and new
        .order('location_name');

      if (fetchError) throw fetchError;

      const loadedMarkers = (data || [])
        .map(dbToMarker)
        .filter((m): m is Marker => m !== null);

      setMarkers(loadedMarkers);
    } catch (err) {
      console.error('Error loading markers:', err);
      setError(err as Error);
      toast.error('Failed to load floor plan markers');
    } finally {
      setLoading(false);
    }
  }, [floorPlanId, dbToMarker]);

  // Save new marker to database
  const saveMarker = useCallback(async (marker: Marker): Promise<boolean> => {
    try {
      // Prepare data for Supabase
      // We are updating an existing signage_spot record, not creating a new one
      // The ID is the signage_spot_id
      const dbRow: SignageSpotUpdate = {
        floor_plan_id: marker.floor_plan_id,
        location_name: marker.location_name,
        marker_type: marker.type,
        marker_x_pixels: Math.round(marker.x),
        marker_y_pixels: Math.round(marker.y),
        marker_rotation: marker.rotation || 0,
        show_on_map: true,
        status: marker.status || 'empty',
        // Set legacy fields to null or calculated defaults if strictly required
        marker_x: null,
        marker_y: null
      };

      // Add type-specific fields
      if (marker.type === 'point') {
        Object.assign(dbRow, {
          marker_radius_pixels: Math.round((marker as PointMarker).radius)
        });
      } else if (marker.type === 'area') {
        Object.assign(dbRow, {
          marker_width_pixels: Math.round((marker as AreaMarker).width),
          marker_height_pixels: Math.round((marker as AreaMarker).height)
        });
      } else if (marker.type === 'line') {
        Object.assign(dbRow, {
          marker_x2_pixels: Math.round((marker as LineMarker).x2),
          marker_y2_pixels: Math.round((marker as LineMarker).y2)
        });
      }

      const { error: saveError } = await supabase
        .from('signage_spots')
        .update(dbRow)
        .eq('id', marker.signage_spot_id);

      if (saveError) {
        throw saveError;
      }

      // Reload to get fresh data including any DB-side triggers/defaults
      await loadMarkers();

      return true;
    } catch (err) {
      console.error('Error saving marker:', err);
      console.error('Full error object:', JSON.stringify(err, null, 2));

      let errorMessage = 'Unknown error';
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'object' && err !== null) {
        // Try to extract error details from Supabase error object
        const errObj = err as Record<string, unknown>;
        if (typeof errObj.message === 'string') errorMessage = errObj.message;
        else if (typeof errObj.error_description === 'string') errorMessage = errObj.error_description;
        else if (typeof errObj.hint === 'string') errorMessage = errObj.hint;
        else if (typeof errObj.details === 'string') errorMessage = errObj.details;
        else errorMessage = JSON.stringify(errObj);
      }

      toast.error(`Failed to save marker: ${errorMessage}`);
      return false;
    }
  }, [loadMarkers]);

  // Update existing marker
  const updateMarker = useCallback(async (marker: Marker): Promise<boolean> => {
    return saveMarker(marker);  // Same logic
  }, [saveMarker]);

  // Delete marker
  const deleteMarker = useCallback(async (markerId: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase
        .from('signage_spots')
        .update({
          show_on_map: false,
          marker_x_pixels: null,
          marker_y_pixels: null,
          marker_x2_pixels: null,
          marker_y2_pixels: null,
          marker_width_pixels: null,
          marker_height_pixels: null,
          marker_radius_pixels: null
        })
        .eq('id', markerId);

      if (deleteError) throw deleteError;

      await loadMarkers();  // Refresh
      toast.success('Marker removed');
      return true;
    } catch (err) {
      console.error('Error deleting marker:', err);
      toast.error('Failed to remove marker');
      return false;
    }
  }, [loadMarkers]);

  // Load on mount and when floor plan changes
  useEffect(() => {
    loadMarkers();

    // Subscribe to real-time changes
    const subscription = supabase
      .channel(`floor-plan-${floorPlanId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'signage_spots',
          filter: `floor_plan_id=eq.${floorPlanId}`
        },
        () => {
          loadMarkers();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [floorPlanId, loadMarkers]);

  return {
    markers,
    loading,
    error,
    refetch: loadMarkers,
    saveMarker,
    updateMarker,
    deleteMarker
  };
}

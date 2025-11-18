/**
 * Floor Plan Module V2 - Markers Hook
 *
 * Manages loading, saving, and syncing markers with database
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Marker, PointMarker, AreaMarker, LineMarker } from './types';
import { toast } from 'sonner';

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
  const dbToMarker = useCallback((row: any): Marker | null => {
    // Use new pixel-based columns if available, otherwise fall back to percentage
    const hasPixelData = row.marker_x_pixels !== null;

    if (!hasPixelData && row.marker_x === null) {
      // No position data at all
      return null;
    }

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

    // Determine marker type and create appropriate object
    const markerType = row.marker_type || 'point';

    if (markerType === 'point' || markerType === 'circle') {
      return {
        ...baseMarker,
        type: 'point',
        x: hasPixelData ? row.marker_x_pixels : row.marker_x,
        y: hasPixelData ? row.marker_y_pixels : row.marker_y,
        radius: row.marker_radius_pixels || row.marker_size / 2 || 15
      } as PointMarker;
    }

    if (markerType === 'area' || markerType === 'rectangle') {
      return {
        ...baseMarker,
        type: 'area',
        x: hasPixelData ? row.marker_x_pixels : row.marker_x,
        y: hasPixelData ? row.marker_y_pixels : row.marker_y,
        width: row.marker_width_pixels || row.marker_size || 30,
        height: row.marker_height_pixels || row.marker_size || 30
      } as AreaMarker;
    }

    if (markerType === 'line') {
      return {
        ...baseMarker,
        type: 'line',
        x: hasPixelData ? row.marker_x_pixels : row.marker_x,
        y: hasPixelData ? row.marker_y_pixels : row.marker_y,
        x2: hasPixelData ? row.marker_x2_pixels : (row.marker_x + 50),
        y2: hasPixelData ? row.marker_y2_pixels : row.marker_y
      } as LineMarker;
    }

    return null;
  }, []);

  // Load markers from database
  const loadMarkers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('signage_spots')
        .select('id, location_name, floor_plan_id, marker_type, marker_x, marker_y, marker_x_pixels, marker_y_pixels, marker_x2_pixels, marker_y2_pixels, marker_width_pixels, marker_height_pixels, marker_radius_pixels, marker_size, marker_rotation, status, expiry_date, next_planned_date, current_image_url, show_on_map')
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
      const updateData: any = {
        floor_plan_id: marker.floor_plan_id,
        marker_type: marker.type,
        marker_x_pixels: Math.round(marker.x),
        marker_y_pixels: Math.round(marker.y),
        marker_rotation: marker.rotation || 0,
        show_on_map: true
      };

      if (marker.type === 'point') {
        updateData.marker_radius_pixels = Math.round(marker.radius);
      } else if (marker.type === 'area') {
        updateData.marker_width_pixels = Math.round(marker.width);
        updateData.marker_height_pixels = Math.round(marker.height);
      } else if (marker.type === 'line') {
        updateData.marker_x2_pixels = Math.round(marker.x2);
        updateData.marker_y2_pixels = Math.round(marker.y2);
      }

      const { error: saveError, data: updateResult } = await supabase
        .from('signage_spots')
        .update(updateData)
        .eq('id', marker.signage_spot_id)
        .select();

      if (saveError) {
        console.error('Database error saving marker:', saveError);
        console.error('Update data:', updateData);
        console.error('Signage spot ID:', marker.signage_spot_id);
        throw saveError;
      }

      if (!updateResult || updateResult.length === 0) {
        throw new Error(`Signage spot not found: ${marker.signage_spot_id}`);
      }

      await loadMarkers();  // Refresh
      toast.success('Marker placed successfully');
      return true;
    } catch (err) {
      console.error('Error saving marker:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
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

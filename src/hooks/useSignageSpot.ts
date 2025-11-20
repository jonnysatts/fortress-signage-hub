/**
 * React Query hooks for signage spot data
 * Provides shared state management with automatic refetching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SignageSpotData {
  id: string;
  location_name: string;
  venue_id: string;
  floor_plan_id: string | null;
  show_on_map: boolean;
  marker_x_pixels: number | null;
  marker_y_pixels: number | null;
  marker_x2_pixels: number | null;
  marker_y2_pixels: number | null;
  marker_width_pixels: number | null;
  marker_height_pixels: number | null;
  marker_radius_pixels: number | null;
  marker_x: number | null;
  marker_y: number | null;
  marker_size: number | null;
  marker_rotation: number | null;
  marker_type: string | null;
  status: string | null;
  expiry_date: string | null;
  next_planned_date: string | null;
  current_image_url: string | null;
}

/**
 * Hook to fetch a single signage spot by ID
 */
export function useSignageSpot(spotId: string | undefined) {
  return useQuery({
    queryKey: ['signage-spot', spotId],
    queryFn: async () => {
      if (!spotId) throw new Error('Spot ID is required');

      const { data, error } = await supabase
        .from('signage_spots')
        .select('*')
        .eq('id', spotId)
        .single();

      if (error) throw error;
      return data as SignageSpotData;
    },
    enabled: !!spotId,
    staleTime: 0, // Always refetch to ensure fresh data
  });
}

/**
 * Hook to fetch all signage spots for a floor plan
 */
export function useFloorPlanSpots(floorPlanId: string | undefined) {
  return useQuery({
    queryKey: ['floor-plan-spots', floorPlanId],
    queryFn: async () => {
      if (!floorPlanId) throw new Error('Floor plan ID is required');

      const { data, error } = await supabase
        .from('signage_spots')
        .select('*')
        .eq('floor_plan_id', floorPlanId)
        .eq('show_on_map', true)
        .order('location_name');

      if (error) throw error;
      return data as SignageSpotData[];
    },
    enabled: !!floorPlanId,
    staleTime: 0,
  });
}

/**
 * Hook to update a signage spot
 */
export function useUpdateSignageSpot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ spotId, updates }: { spotId: string; updates: Partial<SignageSpotData> }) => {
      const validUpdates: any = { ...updates };
      
      const { data, error } = await supabase
        .from('signage_spots')
        .update(validUpdates)
        .eq('id', spotId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['signage-spot', data.id] });
      if (data.floor_plan_id) {
        queryClient.invalidateQueries({ queryKey: ['floor-plan-spots', data.floor_plan_id] });
      }
      toast.success('Spot updated successfully');
    },
    onError: (error) => {
      console.error('Error updating spot:', error);
      toast.error('Failed to update spot');
    },
  });
}

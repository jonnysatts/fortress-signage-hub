/**
 * Floor Plan Module V2 - Viewer Page (Read-Only)
 *
 * Simple viewer for floor plans with markers
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Edit, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { toast } from 'sonner';

import { FloorPlan } from '@/components/floor-plans-v2/types';
import { useFloorPlanMarkers } from '@/components/floor-plans-v2/useFloorPlanMarkers';
import { createInitialViewBox, zoomViewBox, constrainViewBox, viewBoxToZoomLevel } from '@/components/floor-plans-v2/utils';
import FloorPlanCanvas from '@/components/floor-plans-v2/FloorPlanCanvas';

export default function FloorPlanViewerV2() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [floorPlan, setFloorPlan] = useState<FloorPlan | null>(null);
  const [viewBox, setViewBox] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const { markers } = useFloorPlanMarkers(selectedPlanId);

  // Load floor plans
  useEffect(() => {
    const loadFloorPlans = async () => {
      try {
        const { data, error } = await supabase
          .from('floor_plans')
          .select('*')
          .order('display_order');

        if (error) throw error;

        setFloorPlans(data || []);

        // Auto-select from URL or first plan
        const planId = searchParams.get('plan');
        if (planId && data?.find(p => p.id === planId)) {
          setSelectedPlanId(planId);
        } else if (data && data.length > 0) {
          setSelectedPlanId(data[0].id);
        }
      } catch (error) {
        console.error('Error loading floor plans:', error);
        toast.error('Failed to load floor plans');
      } finally {
        setLoading(false);
      }
    };

    loadFloorPlans();
  }, [searchParams]);

  // Load selected floor plan details
  useEffect(() => {
    if (!selectedPlanId) return;

    const plan = floorPlans.find(p => p.id === selectedPlanId);
    if (plan) {
      setFloorPlan(plan);
      setViewBox(createInitialViewBox(plan));
    }
  }, [selectedPlanId, floorPlans]);

  const handleZoomIn = () => {
    if (!floorPlan || !viewBox) return;
    const newViewBox = constrainViewBox(zoomViewBox(viewBox, 1.5), floorPlan);
    setViewBox(newViewBox);
  };

  const handleZoomOut = () => {
    if (!floorPlan || !viewBox) return;
    const newViewBox = constrainViewBox(zoomViewBox(viewBox, 0.67), floorPlan);
    setViewBox(newViewBox);
  };

  const handleResetView = () => {
    if (!floorPlan) return;
    setViewBox(createInitialViewBox(floorPlan));
  };

  const handleMarkerClick = (marker: any) => {
    navigate(`/signage/${marker.signage_spot_id}`);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (floorPlans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-muted-foreground">No floor plans uploaded yet</p>
        <Button onClick={() => navigate('/settings')}>
          Upload Floor Plans
        </Button>
      </div>
    );
  }

  const zoomLevel = floorPlan && viewBox ? viewBoxToZoomLevel(viewBox, floorPlan) : 1;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select floor plan..." />
            </SelectTrigger>
            <SelectContent>
              {floorPlans.map(plan => (
                <SelectItem key={plan.id} value={plan.id}>
                  {plan.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground min-w-[60px] text-center">
            {Math.round(zoomLevel * 100)}%
          </span>
          <Button variant="outline" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleResetView}>
            <Maximize className="w-4 h-4" />
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => navigate(`/floor-plans/${selectedPlanId}/edit`)}
            className="ml-4"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Canvas */}
      {floorPlan && viewBox && (
        <div className="flex-1 overflow-hidden bg-muted">
          <FloorPlanCanvas
            floorPlan={floorPlan}
            markers={markers}
            viewBox={viewBox}
            mode="view"
            selectedMarkerIds={[]}
            draftMarker={null}
            onMarkerClick={handleMarkerClick}
            onViewBoxChange={setViewBox}
            className="w-full h-full"
          />
        </div>
      )}

      {/* Status */}
      <div className="flex items-center justify-between p-2 text-xs text-muted-foreground border-t">
        <div>
          {markers.length} marker{markers.length !== 1 ? 's' : ''}
        </div>
        <div>
          Click any marker to view signage details
        </div>
      </div>
    </div>
  );
}

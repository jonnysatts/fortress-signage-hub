import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface StaleSpot {
  spot_id: string;
  location_name: string;
  venue_name: string;
  last_update_date: string;
  days_since_update: number;
  assigned_user_id: string;
}

export default function StaleContentWarnings() {
  const [staleSpots, setStaleSpots] = useState<StaleSpot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStaleSpots();
  }, []);

  const fetchStaleSpots = async () => {
    try {
      const { data, error } = await supabase.rpc('get_stale_spots_without_replacements');

      if (error) throw error;
      setStaleSpots(data || []);
    } catch (error: unknown) {
      console.error("Failed to load stale spots:", error);
      toast.error("Failed to load stale content warnings");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="p-8">Loading stale content warnings...</div>;
  }

  if (staleSpots.length === 0) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="py-6">
          <p className="text-center text-sm text-muted-foreground">
            ✓ All spots are up to date or have planned replacements
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-fortress text-3xl font-bold">Stale Content Warnings</h1>
        <span className="text-sm text-muted-foreground">
          {staleSpots.length} spot{staleSpots.length !== 1 ? 's' : ''} need{staleSpots.length === 1 ? 's' : ''} attention
        </span>
      </div>

      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-800">
            <AlertTriangle className="h-5 w-5" />
            Content Older Than 6 Months Without Replacement Scheduled
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {staleSpots.map((spot) => (
              <div
                key={spot.spot_id}
                className="flex items-center justify-between p-4 bg-white border rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="flex-1">
                  <p className="font-semibold">{spot.location_name}</p>
                  <p className="text-sm text-muted-foreground">{spot.venue_name}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" />
                      Last updated: {format(new Date(spot.last_update_date), 'MMM d, yyyy')}
                    </span>
                    <span className="font-semibold text-yellow-700">
                      {spot.days_since_update} days ago
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/signage/${spot.spot_id}?tab=upload`)}
                  >
                    Schedule Replacement
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => navigate(`/signage/${spot.spot_id}`)}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

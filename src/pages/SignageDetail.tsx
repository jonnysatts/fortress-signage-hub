import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function SignageDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [spot, setSpot] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSpot();
  }, [id]);

  const fetchSpot = async () => {
    try {
      const { data, error } = await supabase
        .from("signage_spots")
        .select("*, venues(*)")
        .eq("id", id)
        .single();

      if (error) throw error;
      setSpot(data);
    } catch (error: any) {
      toast.error("Failed to load signage spot");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!spot) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Signage spot not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Image Section */}
          <Card>
            <CardHeader>
              <CardTitle>Current Image</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden mb-4">
                {spot.current_image_url ? (
                  <img
                    src={spot.current_image_url}
                    alt={spot.location_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <Upload className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No image uploaded</p>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button className="flex-1">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Image
                </Button>
                {spot.current_image_url && (
                  <Button variant="outline" size="icon">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Details Section */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl mb-2">{spot.location_name}</CardTitle>
                    <p className="text-muted-foreground">{spot.venues?.name}</p>
                  </div>
                  <StatusBadge status={spot.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {spot.width_cm && spot.height_cm && (
                  <div>
                    <h4 className="font-semibold text-sm text-muted-foreground mb-1">Dimensions</h4>
                    <p>{spot.width_cm}cm × {spot.height_cm}cm</p>
                  </div>
                )}

                {spot.content_category && (
                  <div>
                    <h4 className="font-semibold text-sm text-muted-foreground mb-1">Category</h4>
                    <p className="capitalize">{spot.content_category}</p>
                  </div>
                )}

                {spot.priority_level && (
                  <div>
                    <h4 className="font-semibold text-sm text-muted-foreground mb-1">Priority</h4>
                    <p className="capitalize">{spot.priority_level}</p>
                  </div>
                )}

                {spot.supplier_vendor && (
                  <div>
                    <h4 className="font-semibold text-sm text-muted-foreground mb-1">Supplier</h4>
                    <p>{spot.supplier_vendor}</p>
                  </div>
                )}

                {spot.creative_brief && (
                  <div>
                    <h4 className="font-semibold text-sm text-muted-foreground mb-1">Creative Brief</h4>
                    <p className="text-sm">{spot.creative_brief}</p>
                  </div>
                )}

                {spot.recommendations && (
                  <div>
                    <h4 className="font-semibold text-sm text-muted-foreground mb-1">Recommendations</h4>
                    <p className="text-sm">{spot.recommendations}</p>
                  </div>
                )}

                {spot.notes && (
                  <div>
                    <h4 className="font-semibold text-sm text-muted-foreground mb-1">Notes</h4>
                    <p className="text-sm">{spot.notes}</p>
                  </div>
                )}

                {spot.legacy_drive_link && (
                  <div>
                    <h4 className="font-semibold text-sm text-muted-foreground mb-1">Drive Link</h4>
                    <a
                      href={spot.legacy_drive_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      View in Google Drive
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
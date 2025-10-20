import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, Upload, Trash2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

export default function SignageDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [spot, setSpot] = useState<any>(null);
  const [photoHistory, setPhotoHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCaption, setUploadCaption] = useState("");
  const [imageType, setImageType] = useState<"current" | "before" | "after" | "reference">("current");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkUser();
    fetchSpot();
    fetchPhotoHistory();
  }, [id]);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user);
  };

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

  const fetchPhotoHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("photo_history")
        .select("*")
        .eq("signage_spot_id", id)
        .order("upload_date", { ascending: false });

      if (error) throw error;
      setPhotoHistory(data || []);
    } catch (error: any) {
      console.error("Failed to load photo history:", error);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('signage')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('signage')
        .getPublicUrl(fileName);

      // Save to photo_history
      const { error: historyError } = await supabase
        .from('photo_history')
        .insert({
          signage_spot_id: id,
          image_url: publicUrl,
          image_type: imageType,
          caption: uploadCaption || null,
          uploaded_by: user.id
        });

      if (historyError) throw historyError;

      // If image type is "current", update the signage_spot
      if (imageType === "current") {
        const { error: updateError } = await supabase
          .from('signage_spots')
          .update({ 
            current_image_url: publicUrl,
            last_update_date: new Date().toISOString().split('T')[0]
          })
          .eq('id', id);

        if (updateError) throw updateError;
      }

      toast.success("Image uploaded successfully!");
      setUploadCaption("");
      fetchSpot();
      fetchPhotoHistory();
    } catch (error: any) {
      toast.error("Failed to upload image: " + error.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteImage = async (photoId: string, imageUrl: string, isCurrent: boolean) => {
    try {
      // Extract file path from URL
      const urlParts = imageUrl.split('/signage/');
      if (urlParts.length < 2) throw new Error("Invalid image URL");
      const filePath = urlParts[1].split('?')[0];

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('signage')
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete from photo_history
      const { error: deleteError } = await supabase
        .from('photo_history')
        .delete()
        .eq('id', photoId);

      if (deleteError) throw deleteError;

      // If it was the current image, clear it from signage_spot
      if (isCurrent) {
        const { error: updateError } = await supabase
          .from('signage_spots')
          .update({ current_image_url: null })
          .eq('id', id);

        if (updateError) throw updateError;
      }

      toast.success("Image deleted successfully!");
      fetchSpot();
      fetchPhotoHistory();
    } catch (error: any) {
      toast.error("Failed to delete image: " + error.message);
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

        <Tabs defaultValue="details" className="space-y-6">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="upload">Upload Image</TabsTrigger>
            <TabsTrigger value="history">Photo History ({photoHistory.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Current Image */}
              <Card>
                <CardHeader>
                  <CardTitle>Current Image</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                    {spot.current_image_url ? (
                      <img
                        src={spot.current_image_url}
                        alt={spot.location_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No image uploaded</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Details */}
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
          </TabsContent>

          <TabsContent value="upload">
            <Card>
              <CardHeader>
                <CardTitle>Upload New Image</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="imageType">Image Type</Label>
                  <Select value={imageType} onValueChange={(value: any) => setImageType(value)}>
                    <SelectTrigger id="imageType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current">Current (Main Display)</SelectItem>
                      <SelectItem value="before">Before</SelectItem>
                      <SelectItem value="after">After</SelectItem>
                      <SelectItem value="reference">Reference</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="caption">Caption (Optional)</Label>
                  <Textarea
                    id="caption"
                    placeholder="Add a description or notes about this image..."
                    value={uploadCaption}
                    onChange={(e) => setUploadCaption(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Select Image File</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    disabled={isUploading}
                    className="block w-full text-sm text-muted-foreground
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-md file:border-0
                      file:text-sm file:font-semibold
                      file:bg-primary file:text-primary-foreground
                      hover:file:bg-primary/90
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                {isUploading && (
                  <p className="text-sm text-muted-foreground">Uploading...</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Photo History</CardTitle>
              </CardHeader>
              <CardContent>
                {photoHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No photos uploaded yet</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {photoHistory.map((photo) => (
                      <Card key={photo.id} className="overflow-hidden">
                        <div className="aspect-video bg-muted">
                          <img
                            src={photo.image_url}
                            alt={photo.caption || "Signage photo"}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <p className="text-sm font-semibold capitalize">{photo.image_type}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(photo.upload_date).toLocaleDateString()}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteImage(photo.id, photo.image_url, photo.image_type === 'current')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          {photo.caption && (
                            <p className="text-sm text-muted-foreground mt-2">{photo.caption}</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
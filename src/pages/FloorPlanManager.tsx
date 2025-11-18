import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Edit, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";

interface FloorPlan {
  id: string;
  venue: string;
  level: string;
  display_name: string;
  image_url: string;
  display_order: number;
}

export default function FloorPlanManager() {
  const navigate = useNavigate();
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<FloorPlan | null>(null);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    venue: '',
    level: '',
    display_name: '',
    display_order: 0
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    loadFloorPlans();
  }, []);

  const loadFloorPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('floor_plans')
        .select('*')
        .order('venue')
        .order('display_order');

      if (error) throw error;
      setFloorPlans(data || []);
    } catch (error) {
      console.error('Error loading floor plans:', error);
      toast.error('Failed to load floor plans');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file type
      if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
        toast.error('Invalid file type. Please upload JPEG or PNG.');
        return;
      }
      
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File too large. Maximum size is 10MB.');
        return;
      }
      
      setSelectedFile(file);
      
      // Auto-fill display name if not set
      if (!formData.display_name && formData.venue && formData.level) {
        setFormData(prev => ({
          ...prev,
          display_name: `${formData.venue} - ${formData.level}`
        }));
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !formData.venue || !formData.level || !formData.display_name) {
      toast.error('Please fill in all required fields');
      return;
    }

    setUploading(true);
    try {
      // Load image to get dimensions
      const img = new Image();
      const imageUrl = URL.createObjectURL(selectedFile);

      const imageDimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        img.onload = () => {
          URL.revokeObjectURL(imageUrl);
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => {
          URL.revokeObjectURL(imageUrl);
          reject(new Error('Failed to load image'));
        };
        img.src = imageUrl;
      });

      // Upload file to storage
      const fileName = `${formData.venue.toLowerCase()}-${formData.level.toLowerCase()}-${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('floor-plans')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('floor-plans')
        .getPublicUrl(fileName);

      // Insert floor plan record with image dimensions
      const { error: insertError } = await supabase
        .from('floor_plans')
        .insert({
          venue: formData.venue,
          level: formData.level,
          display_name: formData.display_name,
          image_url: publicUrl,
          display_order: formData.display_order,
          original_width: imageDimensions.width,
          original_height: imageDimensions.height
        });

      if (insertError) throw insertError;

      toast.success(`Floor plan uploaded successfully! (${imageDimensions.width}×${imageDimensions.height}px)`);
      setUploadDialogOpen(false);
      resetForm();
      loadFloorPlans();
    } catch (error) {
      console.error('Error uploading floor plan:', error);
      toast.error('Failed to upload floor plan');
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedPlan) return;

    try {
      const { error } = await supabase
        .from('floor_plans')
        .update({
          venue: formData.venue,
          level: formData.level,
          display_name: formData.display_name,
          display_order: formData.display_order
        })
        .eq('id', selectedPlan.id);

      if (error) throw error;

      toast.success('Floor plan updated successfully!');
      setEditDialogOpen(false);
      setSelectedPlan(null);
      resetForm();
      loadFloorPlans();
    } catch (error) {
      console.error('Error updating floor plan:', error);
      toast.error('Failed to update floor plan');
    }
  };

  const handleDelete = async () => {
    if (!selectedPlan) return;

    try {
      // Check for existing markers
      const { data: spots } = await supabase
        .from('signage_spots')
        .select('id')
        .eq('floor_plan_id', selectedPlan.id);

      if (spots && spots.length > 0) {
        toast.error(`This floor plan has ${spots.length} markers. Remove markers first.`);
        return;
      }

      // Delete floor plan
      const { error } = await supabase
        .from('floor_plans')
        .delete()
        .eq('id', selectedPlan.id);

      if (error) throw error;

      // Delete image from storage
      const fileName = selectedPlan.image_url.split('/').pop();
      if (fileName) {
        await supabase.storage
          .from('floor-plans')
          .remove([fileName]);
      }

      toast.success('Floor plan deleted successfully!');
      setDeleteDialogOpen(false);
      setSelectedPlan(null);
      loadFloorPlans();
    } catch (error) {
      console.error('Error deleting floor plan:', error);
      toast.error('Failed to delete floor plan');
    }
  };

  const resetForm = () => {
    setFormData({
      venue: '',
      level: '',
      display_name: '',
      display_order: 0
    });
    setSelectedFile(null);
  };

  const openEditDialog = (plan: FloorPlan) => {
    setSelectedPlan(plan);
    setFormData({
      venue: plan.venue,
      level: plan.level,
      display_name: plan.display_name,
      display_order: plan.display_order
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (plan: FloorPlan) => {
    setSelectedPlan(plan);
    setDeleteDialogOpen(true);
  };

  const groupedPlans = floorPlans.reduce((acc, plan) => {
    if (!acc[plan.venue]) {
      acc[plan.venue] = [];
    }
    acc[plan.venue].push(plan);
    return acc;
  }, {} as Record<string, FloorPlan[]>);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MapPin className="w-8 h-8" />
            Floor Plan Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Upload and manage venue floor plans
          </p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Upload className="w-4 h-4 mr-2" />
          Upload New Floor Plan
        </Button>
      </div>

      {loading ? (
        <div className="text-center p-8">Loading floor plans...</div>
      ) : Object.keys(groupedPlans).length === 0 ? (
        <Card className="p-8 text-center">
          <MapPin className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">No Floor Plans Yet</h2>
          <p className="text-muted-foreground mb-4">
            Upload your first floor plan to get started
          </p>
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Upload Floor Plan
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedPlans).map(([venue, plans]) => (
            <Card key={venue} className="p-6">
              <h2 className="text-xl font-bold mb-4">{venue}</h2>
              <div className="space-y-2">
                {plans.map(plan => (
                  <div
                    key={plan.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={plan.image_url}
                        alt={plan.display_name}
                        className="w-16 h-16 object-cover rounded"
                      />
                      <div>
                        <div className="font-medium">{plan.level}</div>
                        <div className="text-sm text-muted-foreground">
                          {plan.display_name}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(plan)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDeleteDialog(plan)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Floor Plan</DialogTitle>
            <DialogDescription>
              Upload a floor plan image for a venue level
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="venue">Venue</Label>
              <Select
                value={formData.venue}
                onValueChange={(value) => setFormData(prev => ({ ...prev, venue: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select venue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Melbourne">Melbourne</SelectItem>
                  <SelectItem value="Sydney">Sydney</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="level">Level</Label>
              <Input
                id="level"
                value={formData.level}
                onChange={(e) => setFormData(prev => ({ ...prev, level: e.target.value }))}
                placeholder="e.g., Arena, Tavern, Upper Level"
              />
            </div>
            <div>
              <Label htmlFor="display_name">Display Name</Label>
              <Input
                id="display_name"
                value={formData.display_name}
                onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                placeholder="e.g., Melbourne - Arena"
              />
            </div>
            <div>
              <Label htmlFor="file">Floor Plan Image</Label>
              <Input
                id="file"
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleFileSelect}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Accepts JPEG or PNG (max 10MB)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload & Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Floor Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-venue">Venue</Label>
              <Select
                value={formData.venue}
                onValueChange={(value) => setFormData(prev => ({ ...prev, venue: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Melbourne">Melbourne</SelectItem>
                  <SelectItem value="Sydney">Sydney</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-level">Level</Label>
              <Input
                id="edit-level"
                value={formData.level}
                onChange={(e) => setFormData(prev => ({ ...prev, level: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit-display-name">Display Name</Label>
              <Input
                id="edit-display-name"
                value={formData.display_name}
                onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Floor Plan</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this floor plan? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

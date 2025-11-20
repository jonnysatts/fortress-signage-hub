import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type ContentCategory = Database['public']['Enums']['content_category'];
type OrientationType = Database['public']['Enums']['orientation_type'];
type PriorityLevel = Database['public']['Enums']['priority_level'];

interface Venue {
  id: string;
  name: string;
}

interface CreateSignageDialogProps {
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function CreateSignageDialog({ onSuccess, trigger }: CreateSignageDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [venues, setVenues] = useState<Venue[]>([]);

  // Basic required fields
  const [locationName, setLocationName] = useState("");
  const [venueId, setVenueId] = useState("");

  // Physical specifications
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [depthCm, setDepthCm] = useState("");
  const [orientation, setOrientation] = useState<OrientationType | "">("");

  // Categorization
  const [contentCategory, setContentCategory] = useState<ContentCategory | "">("");
  const [priorityLevel, setPriorityLevel] = useState<PriorityLevel>("medium");

  // Additional details
  const [materialType, setMaterialType] = useState("");
  const [mountingType, setMountingType] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      fetchVenues();
    }
  }, [open]);

  const fetchVenues = async () => {
    const { data, error } = await supabase
      .from('venues')
      .select('id, name')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching venues:', error);
      toast.error('Failed to load venues');
      return;
    }

    setVenues(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!locationName.trim()) {
      toast.error('Location name is required');
      return;
    }

    if (!venueId) {
      toast.error('Please select a venue');
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const signageData = {
        location_name: locationName.trim(),
        venue_id: venueId,
        width_cm: widthCm ? parseFloat(widthCm) : null,
        height_cm: heightCm ? parseFloat(heightCm) : null,
        depth_cm: depthCm ? parseFloat(depthCm) : null,
        orientation: orientation || null,
        content_category: contentCategory || null,
        priority_level: priorityLevel,
        material_type: materialType || null,
        mounting_type: mountingType || null,
        notes: notes || null,
        status: 'empty' as const,
        created_by: user?.id,
        is_opportunity: false,
        show_on_map: false,
      };

      const { data, error } = await supabase
        .from('signage_spots')
        .insert([signageData])
        .select()
        .single();

      if (error) throw error;

      toast.success('Signage spot created successfully');
      
      // Reset form
      setLocationName("");
      setVenueId("");
      setWidthCm("");
      setHeightCm("");
      setDepthCm("");
      setOrientation("");
      setContentCategory("");
      setPriorityLevel("medium");
      setMaterialType("");
      setMountingType("");
      setNotes("");
      
      setOpen(false);
      onSuccess?.();

      // Optional: Navigate to the new spot
      if (data?.id) {
        setTimeout(() => {
          window.location.href = `/signage/${data.id}`;
        }, 500);
      }
    } catch (error) {
      console.error('Error creating signage spot:', error);
      toast.error('Failed to create signage spot');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create Signage Spot
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Signage Spot</DialogTitle>
          <DialogDescription>
            Add a new signage location to your venue inventory
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Required Fields */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Required Information</h3>
            
            <div className="space-y-2">
              <Label htmlFor="location-name">
                Location Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="location-name"
                placeholder="e.g., Main Entrance Display"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="venue">
                Venue <span className="text-destructive">*</span>
              </Label>
              <Select value={venueId} onValueChange={setVenueId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a venue" />
                </SelectTrigger>
                <SelectContent>
                  {venues.map((venue) => (
                    <SelectItem key={venue.id} value={venue.id}>
                      {venue.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Physical Specifications */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Physical Specifications</h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="width">Width (cm)</Label>
                <Input
                  id="width"
                  type="number"
                  step="0.1"
                  placeholder="0"
                  value={widthCm}
                  onChange={(e) => setWidthCm(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height">Height (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  step="0.1"
                  placeholder="0"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="depth">Depth (cm)</Label>
                <Input
                  id="depth"
                  type="number"
                  step="0.1"
                  placeholder="0"
                  value={depthCm}
                  onChange={(e) => setDepthCm(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orientation">Orientation</Label>
              <Select value={orientation} onValueChange={(v) => setOrientation(v as OrientationType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select orientation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="landscape">Landscape</SelectItem>
                  <SelectItem value="square">Square</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Categorization */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Categorization</h3>
            
            <div className="space-y-2">
              <Label htmlFor="content-category">Content Category</Label>
              <Select value={contentCategory} onValueChange={(v) => setContentCategory(v as ContentCategory)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="evergreen">Evergreen</SelectItem>
                  <SelectItem value="event_based">Event Based</SelectItem>
                  <SelectItem value="seasonal">Seasonal</SelectItem>
                  <SelectItem value="partnership">Partnership</SelectItem>
                  <SelectItem value="theming">Theming</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority Level</Label>
              <Select value={priorityLevel} onValueChange={(v) => setPriorityLevel(v as PriorityLevel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Installation Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Installation Details</h3>
            
            <div className="space-y-2">
              <Label htmlFor="material">Material Type</Label>
              <Input
                id="material"
                placeholder="e.g., Acrylic, Vinyl, LED, Fabric"
                value={materialType}
                onChange={(e) => setMaterialType(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mounting">Mounting Type</Label>
              <Input
                id="mounting"
                placeholder="e.g., Wall-mounted, Free-standing, Hanging"
                value={mountingType}
                onChange={(e) => setMountingType(e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes about this signage spot..."
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Signage Spot"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

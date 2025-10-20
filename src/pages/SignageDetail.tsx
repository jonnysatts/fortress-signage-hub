import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/StatusBadge";
import { TagSelector } from "@/components/TagSelector";
import { GroupSelector } from "@/components/GroupSelector";
import { CampaignLinker } from "@/components/CampaignLinker";
import { ArrowLeft, Trash2, Image as ImageIcon, Edit2, Save, X, CheckCircle2, Maximize2, QrCode, Download, DollarSign } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function SignageDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [spot, setSpot] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [photoHistory, setPhotoHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCaption, setUploadCaption] = useState("");
  const [imageType, setImageType] = useState<"current" | "before" | "after" | "reference">("current");
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedSpot, setEditedSpot] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [defaultTab, setDefaultTab] = useState("details");
  const [spotGroups, setSpotGroups] = useState<any[]>([]);

  useEffect(() => {
    checkUser();
    fetchSpot();
    fetchCampaigns();
    fetchPhotoHistory();
    fetchUsers();
    fetchSpotGroups();
    
    // Check for tab param in URL
    const tab = searchParams.get('tab');
    if (tab === 'upload') {
      setDefaultTab('upload');
    }
  }, [id]);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);

      // Get all roles for the user from user_roles (secure)
      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id);

      const roleList = roles?.map(r => r.role) || [];
      const effectiveRole = roleList.includes('admin')
        ? 'admin'
        : roleList.includes('manager')
        ? 'manager'
        : roleList.includes('staff')
        ? 'staff'
        : null;

      console.info('Auth debug', {
        userId: session.user.id,
        roles: roleList,
        effectiveRole,
      });

      setUserRole(effectiveRole);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('is_active', true)
        .order('full_name');
      
      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error('Failed to load users:', error);
    }
  };

  const fetchSpot = async () => {
    try {
      const { data, error } = await supabase
        .from("signage_spots")
        .select("*, venues(*), profiles!signage_spots_assigned_user_id_fkey(id, full_name, email)")
        .eq("id", id)
        .single();

      if (error) throw error;
      setSpot(data);
      setEditedSpot(data);
    } catch (error: any) {
      toast.error("Failed to load signage spot");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from("signage_campaigns")
        .select("*, campaigns(*)")
        .eq("signage_spot_id", id);

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error: any) {
      console.error("Failed to load campaigns:", error);
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

  const fetchSpotGroups = async () => {
    try {
      const { data, error } = await supabase
        .from("signage_spot_groups")
        .select("*, signage_groups(*)")
        .eq("signage_spot_id", id);

      if (error) throw error;
      setSpotGroups(data || []);
    } catch (error: any) {
      console.error("Failed to load spot groups:", error);
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

  const handleEditToggle = () => {
    if (isEditMode) {
      setEditedSpot(spot);
    }
    setIsEditMode(!isEditMode);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('signage_spots')
        .update({
          location_name: editedSpot.location_name,
          status: editedSpot.status,
          priority_level: editedSpot.priority_level,
          content_category: editedSpot.content_category,
          width_cm: editedSpot.width_cm,
          height_cm: editedSpot.height_cm,
          depth_cm: editedSpot.depth_cm,
          orientation: editedSpot.orientation,
          material_type: editedSpot.material_type,
          mounting_type: editedSpot.mounting_type,
          supplier_vendor: editedSpot.supplier_vendor,
          creative_brief: editedSpot.creative_brief,
          recommendations: editedSpot.recommendations,
          notes: editedSpot.notes,
          specs_notes: editedSpot.specs_notes,
          assigned_user_id: editedSpot.assigned_user_id,
          expiry_date: editedSpot.expiry_date,
          expiry_behavior: editedSpot.expiry_behavior,
          tags: editedSpot.tags || [],
          production_cost: editedSpot.production_cost,
          installation_cost: editedSpot.installation_cost,
          budget_notes: editedSpot.budget_notes,
          updated_by: user?.id
        })
        .eq('id', id);

      if (error) throw error;

      toast.success("Changes saved successfully!");
      setIsEditMode(false);
      fetchSpot();
    } catch (error: any) {
      toast.error("Failed to save changes: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkAsUpdated = async () => {
    try {
      const { error } = await supabase
        .from('signage_spots')
        .update({
          status: 'current',
          last_update_date: new Date().toISOString().split('T')[0],
          updated_by: user?.id
        })
        .eq('id', id);

      if (error) throw error;

      toast.success("Marked as updated!");
      fetchSpot();
    } catch (error: any) {
      toast.error("Failed to update status: " + error.message);
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('signage_spots')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success("Signage spot deleted");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error("Failed to delete: " + error.message);
    }
  };

  const canEdit = userRole === 'admin' || userRole === 'manager' || spot?.assigned_user_id === user?.id;
  const canDelete = userRole === 'admin';

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
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>

          <div className="flex gap-2">
            {canEdit && !isEditMode && (
              <>
                <Button onClick={handleMarkAsUpdated} variant="outline">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Mark as Updated
                </Button>
                <Button onClick={handleEditToggle}>
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              </>
            )}
            {isEditMode && (
              <>
                <Button onClick={handleEditToggle} variant="outline">
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </>
            )}
          </div>
        </div>

        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="upload">Upload Image</TabsTrigger>
            <TabsTrigger value="history">Photo History ({photoHistory.length})</TabsTrigger>
            <TabsTrigger value="qrcode">
              <QrCode className="w-4 h-4 mr-2" />
              QR Code
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Current Image */}
              <Card>
                <CardHeader>
                  <CardTitle>Current Image</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative bg-muted rounded-lg flex items-center justify-center overflow-hidden min-h-[300px]">
                    {spot.current_image_url ? (
                      <>
                        <img
                          src={spot.current_image_url}
                          alt={spot.location_name}
                          className="max-w-full max-h-[600px] w-auto h-auto object-contain cursor-pointer"
                          onClick={() => setExpandedImage(spot.current_image_url)}
                        />
                        <Button
                          variant="secondary"
                          size="icon"
                          className="absolute top-2 right-2"
                          onClick={() => setExpandedImage(spot.current_image_url)}
                        >
                          <Maximize2 className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No image uploaded</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="location_name">Location Name</Label>
                    {isEditMode ? (
                      <Input
                        id="location_name"
                        value={editedSpot.location_name}
                        onChange={(e) => setEditedSpot({ ...editedSpot, location_name: e.target.value })}
                      />
                    ) : (
                      <p className="font-medium">{spot.location_name}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Venue</Label>
                    <p className="text-muted-foreground">{spot.venues?.name}</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    {isEditMode ? (
                      <Select
                        value={editedSpot.status}
                        onValueChange={(value) => setEditedSpot({ ...editedSpot, status: value })}
                      >
                        <SelectTrigger id="status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="current">Current</SelectItem>
                          <SelectItem value="expiring_soon">Expiring Soon</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                          <SelectItem value="empty">Empty</SelectItem>
                          <SelectItem value="planned">Planned</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div>
                        <StatusBadge status={spot.status} />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority_level">Priority Level</Label>
                    {isEditMode ? (
                      <Select
                        value={editedSpot.priority_level || ""}
                        onValueChange={(value) => setEditedSpot({ ...editedSpot, priority_level: value })}
                      >
                        <SelectTrigger id="priority_level">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="capitalize">{spot.priority_level || "Not set"}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="content_category">Content Category</Label>
                    {isEditMode ? (
                      <Select
                        value={editedSpot.content_category || ""}
                        onValueChange={(value) => setEditedSpot({ ...editedSpot, content_category: value })}
                      >
                        <SelectTrigger id="content_category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="evergreen">Evergreen</SelectItem>
                          <SelectItem value="event_based">Event-Based</SelectItem>
                          <SelectItem value="seasonal">Seasonal</SelectItem>
                          <SelectItem value="partnership">Partnership</SelectItem>
                          <SelectItem value="theming">Theming</SelectItem>
                          <SelectItem value="marketing">Marketing</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="capitalize">{spot.content_category?.replace('_', '-') || "Not set"}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="assigned_user">Assigned To</Label>
                    {isEditMode ? (
                      <Select
                        value={editedSpot.assigned_user_id || "unassigned"}
                        onValueChange={(value) => setEditedSpot({ ...editedSpot, assigned_user_id: value === "unassigned" ? null : value })}
                      >
                        <SelectTrigger id="assigned_user">
                          <SelectValue placeholder="Select user" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {users.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.full_name || u.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p>{spot.profiles?.full_name || spot.profiles?.email || "Unassigned"}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Tags</Label>
                    <TagSelector
                      tags={editedSpot?.tags || []}
                      onChange={(tags) => setEditedSpot({ ...editedSpot, tags })}
                      disabled={!isEditMode}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Groups</Label>
                    <GroupSelector
                      signageSpotId={id!}
                      selectedGroups={spotGroups.map(sg => sg.signage_groups)}
                      onChange={() => {
                        fetchSpotGroups();
                        fetchSpot();
                      }}
                      disabled={!isEditMode}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Campaign Linking Card */}
              <CampaignLinker
                signageSpotId={id!}
                linkedCampaigns={campaigns}
                onUpdate={() => {
                  fetchCampaigns();
                  fetchSpot();
                }}
                disabled={!isEditMode && userRole !== 'admin' && userRole !== 'manager'}
              />
            </div>

            {/* Physical Specifications */}
            <Card>
              <CardHeader>
                <CardTitle>Physical Specifications</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="width">Width (cm)</Label>
                  {isEditMode ? (
                    <Input
                      id="width"
                      type="number"
                      value={editedSpot.width_cm || ""}
                      onChange={(e) => setEditedSpot({ ...editedSpot, width_cm: e.target.value ? parseFloat(e.target.value) : null })}
                    />
                  ) : (
                    <p>{spot.width_cm ? `${spot.width_cm} cm` : "Not set"}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="height">Height (cm)</Label>
                  {isEditMode ? (
                    <Input
                      id="height"
                      type="number"
                      value={editedSpot.height_cm || ""}
                      onChange={(e) => setEditedSpot({ ...editedSpot, height_cm: e.target.value ? parseFloat(e.target.value) : null })}
                    />
                  ) : (
                    <p>{spot.height_cm ? `${spot.height_cm} cm` : "Not set"}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="depth">Depth (cm)</Label>
                  {isEditMode ? (
                    <Input
                      id="depth"
                      type="number"
                      value={editedSpot.depth_cm || ""}
                      onChange={(e) => setEditedSpot({ ...editedSpot, depth_cm: e.target.value ? parseFloat(e.target.value) : null })}
                    />
                  ) : (
                    <p>{spot.depth_cm ? `${spot.depth_cm} cm` : "Not set"}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="orientation">Orientation</Label>
                  {isEditMode ? (
                    <Select
                      value={editedSpot.orientation || ""}
                      onValueChange={(value) => setEditedSpot({ ...editedSpot, orientation: value })}
                    >
                      <SelectTrigger id="orientation">
                        <SelectValue placeholder="Select orientation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="portrait">Portrait</SelectItem>
                        <SelectItem value="landscape">Landscape</SelectItem>
                        <SelectItem value="square">Square</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="capitalize">{spot.orientation || "Not set"}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="material">Material Type</Label>
                  {isEditMode ? (
                    <Input
                      id="material"
                      value={editedSpot.material_type || ""}
                      onChange={(e) => setEditedSpot({ ...editedSpot, material_type: e.target.value })}
                      placeholder="e.g., Vinyl, Fabric, Acrylic"
                    />
                  ) : (
                    <p>{spot.material_type || "Not set"}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mounting">Mounting Type</Label>
                  {isEditMode ? (
                    <Input
                      id="mounting"
                      value={editedSpot.mounting_type || ""}
                      onChange={(e) => setEditedSpot({ ...editedSpot, mounting_type: e.target.value })}
                      placeholder="e.g., Wall-mounted, Hanging"
                    />
                  ) : (
                    <p>{spot.mounting_type || "Not set"}</p>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                  <Label htmlFor="specs_notes">Specifications Notes</Label>
                  {isEditMode ? (
                    <Textarea
                      id="specs_notes"
                      value={editedSpot.specs_notes || ""}
                      onChange={(e) => setEditedSpot({ ...editedSpot, specs_notes: e.target.value })}
                      placeholder="Additional specifications or installation notes"
                      rows={2}
                    />
                  ) : (
                    <p className="text-sm">{spot.specs_notes || "No additional notes"}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Budget Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Budget
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditMode ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="production_cost">Production Cost (AUD)</Label>
                      <Input
                        id="production_cost"
                        type="number"
                        step="0.01"
                        min="0"
                        value={editedSpot.production_cost || ''}
                        onChange={(e) => setEditedSpot({...editedSpot, production_cost: e.target.value})}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="installation_cost">Installation Cost (AUD)</Label>
                      <Input
                        id="installation_cost"
                        type="number"
                        step="0.01"
                        min="0"
                        value={editedSpot.installation_cost || ''}
                        onChange={(e) => setEditedSpot({...editedSpot, installation_cost: e.target.value})}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="budget_notes">Budget Notes</Label>
                      <Textarea
                        id="budget_notes"
                        value={editedSpot.budget_notes || ''}
                        onChange={(e) => setEditedSpot({...editedSpot, budget_notes: e.target.value})}
                        placeholder="Optional notes about costs..."
                        rows={2}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Production Cost</p>
                        <p className="text-lg font-semibold">
                          ${spot.production_cost ? Number(spot.production_cost).toFixed(2) : '0.00'} AUD
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Installation Cost</p>
                        <p className="text-lg font-semibold">
                          ${spot.installation_cost ? Number(spot.installation_cost).toFixed(2) : '0.00'} AUD
                        </p>
                      </div>
                    </div>
                    <div className="pt-2 border-t">
                      <p className="text-sm text-muted-foreground">Total Cost per Update</p>
                      <p className="text-xl font-bold text-primary">
                        ${((Number(spot.production_cost) || 0) + (Number(spot.installation_cost) || 0)).toFixed(2)} AUD
                      </p>
                    </div>
                    {spot.budget_notes && (
                      <div className="pt-2">
                        <p className="text-sm text-muted-foreground">Notes</p>
                        <p className="text-sm">{spot.budget_notes}</p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Expiry Management */}
            <Card>
              <CardHeader>
                <CardTitle>Expiry Management</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="expiry_behavior">Expiry Behavior</Label>
                  {isEditMode ? (
                    <Select
                      value={editedSpot.expiry_behavior || "auto_6_months"}
                      onValueChange={(value) => setEditedSpot({ ...editedSpot, expiry_behavior: value })}
                    >
                      <SelectTrigger id="expiry_behavior">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto_6_months">Auto 6 months from last update</SelectItem>
                        <SelectItem value="custom_date">Custom date</SelectItem>
                        <SelectItem value="event_based">Event-based</SelectItem>
                        <SelectItem value="never">Never expires</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="capitalize">{spot.expiry_behavior?.replace('_', ' ') || "Auto 6 months"}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expiry_date">Expiry Date</Label>
                  {isEditMode && editedSpot.expiry_behavior === 'custom_date' ? (
                    <Input
                      id="expiry_date"
                      type="date"
                      value={editedSpot.expiry_date || ""}
                      onChange={(e) => setEditedSpot({ ...editedSpot, expiry_date: e.target.value })}
                    />
                  ) : (
                    <p>{spot.expiry_date ? new Date(spot.expiry_date).toLocaleDateString() : "Auto-calculated"}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Install Date</Label>
                  <p>{spot.install_date ? new Date(spot.install_date).toLocaleDateString() : "Not set"}</p>
                </div>

                <div className="space-y-2">
                  <Label>Last Update Date</Label>
                  <p>{spot.last_update_date ? new Date(spot.last_update_date).toLocaleDateString() : "Not set"}</p>
                </div>
              </CardContent>
            </Card>

            {/* Content Management */}
            <Card>
              <CardHeader>
                <CardTitle>Content Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="supplier">Supplier/Vendor</Label>
                  {isEditMode ? (
                    <Input
                      id="supplier"
                      value={editedSpot.supplier_vendor || ""}
                      onChange={(e) => setEditedSpot({ ...editedSpot, supplier_vendor: e.target.value })}
                      placeholder="Supplier or vendor name"
                    />
                  ) : (
                    <p>{spot.supplier_vendor || "Not set"}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="creative_brief">Creative Brief</Label>
                  {isEditMode ? (
                    <Textarea
                      id="creative_brief"
                      value={editedSpot.creative_brief || ""}
                      onChange={(e) => setEditedSpot({ ...editedSpot, creative_brief: e.target.value })}
                      placeholder="Creative direction and ideas"
                      rows={3}
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{spot.creative_brief || "No brief provided"}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recommendations">Recommendations</Label>
                  {isEditMode ? (
                    <Textarea
                      id="recommendations"
                      value={editedSpot.recommendations || ""}
                      onChange={(e) => setEditedSpot({ ...editedSpot, recommendations: e.target.value })}
                      placeholder="Recommendations and suggestions"
                      rows={3}
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{spot.recommendations || "No recommendations"}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">General Notes</Label>
                  {isEditMode ? (
                    <Textarea
                      id="notes"
                      value={editedSpot.notes || ""}
                      onChange={(e) => setEditedSpot({ ...editedSpot, notes: e.target.value })}
                      placeholder="Additional notes and comments"
                      rows={3}
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{spot.notes || "No notes"}</p>
                  )}
                </div>

                {spot.legacy_drive_link && (
                  <div className="space-y-2">
                    <Label>Legacy Drive Link</Label>
                    <a
                      href={spot.legacy_drive_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline block"
                    >
                      View in Google Drive
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Delete Button */}
            {canDelete && (
              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="text-destructive">Danger Zone</CardTitle>
                </CardHeader>
                <CardContent>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Signage Spot
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete this signage spot
                          and all associated photo history.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            )}
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
                        <div className="relative bg-muted min-h-[200px] flex items-center justify-center">
                          <img
                            src={photo.image_url}
                            alt={photo.caption || "Signage photo"}
                            className="max-w-full max-h-[300px] w-auto h-auto object-contain cursor-pointer"
                            onClick={() => setExpandedImage(photo.image_url)}
                          />
                          <Button
                            variant="secondary"
                            size="icon"
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setExpandedImage(photo.image_url)}
                          >
                            <Maximize2 className="w-4 h-4" />
                          </Button>
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

          <TabsContent value="qrcode">
            <Card>
              <CardHeader>
                <CardTitle>QR Code for Quick Access</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>Print this QR code and stick it on the physical signage location.</p>
                  <p>Staff can scan it with their phone camera to instantly access this spot and upload new photos.</p>
                </div>

                <div className="flex flex-col items-center space-y-4 p-8 bg-muted rounded-lg">
                  <div className="bg-white p-6 rounded-lg shadow-lg" id="qr-code-container">
                    <QRCodeSVG
                      value={`${window.location.origin}/signage/${id}`}
                      size={256}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  
                  <div className="text-center space-y-2">
                    <p className="font-medium">{spot?.location_name}</p>
                    <p className="text-xs text-muted-foreground font-mono break-all max-w-md">
                      {`${window.location.origin}/signage/${id}`}
                    </p>
                  </div>

                  <Button
                    onClick={() => {
                      const svg = document.querySelector('#qr-code-container svg');
                      if (svg) {
                        const svgData = new XMLSerializer().serializeToString(svg);
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        const img = new Image();
                        
                        img.onload = () => {
                          canvas.width = img.width;
                          canvas.height = img.height;
                          ctx?.drawImage(img, 0, 0);
                          
                          canvas.toBlob((blob) => {
                            if (blob) {
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `qr-code-${spot?.location_name?.replace(/\s+/g, '-').toLowerCase() || id}.png`;
                              a.click();
                              URL.revokeObjectURL(url);
                              toast.success('QR code downloaded!');
                            }
                          });
                        };
                        
                        img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
                      }
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download QR Code
                  </Button>
                </div>

                <div className="border-t pt-6">
                  <h4 className="font-semibold mb-3">How to use QR codes:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Download the QR code using the button above</li>
                    <li>Print it on a sticker or label (recommended size: 5cm x 5cm minimum)</li>
                    <li>Stick the QR code on or near the physical signage location</li>
                    <li>Staff can scan it with their phone camera to open this page directly</li>
                    <li>They can then upload new photos without searching through the dashboard</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Full Image Viewer Dialog */}
        {expandedImage && (
          <div 
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setExpandedImage(null)}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-white hover:bg-white/20"
              onClick={() => setExpandedImage(null)}
            >
              <X className="w-6 h-6" />
            </Button>
            <img
              src={expandedImage}
              alt="Expanded view"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    </div>
  );
}
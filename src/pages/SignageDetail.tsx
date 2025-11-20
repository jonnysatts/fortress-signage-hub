import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
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
import { ArrowLeft, Trash2, Image as ImageIcon, Edit2, Save, X, CheckCircle2, Maximize2, QrCode, Download, DollarSign, Calendar, Clock, Printer, Undo, MapPin, Upload, AlertCircle } from "lucide-react";
import { QuickIssueDialog } from "@/components/QuickIssueDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ApprovalWorkflow } from "@/components/ApprovalWorkflow";
import FloorPlanMiniWidget from "@/components/FloorPlanMiniWidget";
import { CommentsPanel } from "@/components/CommentsPanel";
import { format } from "date-fns";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type SignageSpot = Database['public']['Tables']['signage_spots']['Row'] & {
  venues?: Database['public']['Tables']['venues']['Row'] | null;
  profiles?: { id: string; full_name: string | null; email: string | null } | null;
};

type SignageCampaign = Database['public']['Tables']['signage_campaigns']['Row'] & {
  campaigns?: Database['public']['Tables']['campaigns']['Row'] | null;
};

type PhotoHistory = Database['public']['Tables']['photo_history']['Row'];
type SpotGroup = Database['public']['Tables']['signage_spot_groups']['Row'] & {
  signage_groups?: Database['public']['Tables']['signage_groups']['Row'] | null;
};

type UserProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export default function SignageDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const locationPhotoInputRef = useRef<HTMLInputElement>(null);

  const [spot, setSpot] = useState<SignageSpot | null>(null);
  const [campaigns, setCampaigns] = useState<SignageCampaign[]>([]);
  const [photoHistory, setPhotoHistory] = useState<PhotoHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingLocationPhoto, setIsUploadingLocationPhoto] = useState(false);
  const [uploadCaption, setUploadCaption] = useState("");
  const [imageType, setImageType] = useState<"current" | "before" | "after" | "reference" | "planned" | "location">("current");
  const [showQuickIssueDialog, setShowQuickIssueDialog] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [autoPromote, setAutoPromote] = useState<boolean>(true);
  const [printRequired, setPrintRequired] = useState<boolean>(false);
  const [printVendor, setPrintVendor] = useState<string>("");
  const [printDueDate, setPrintDueDate] = useState<string>("");
  const [printNotes, setPrintNotes] = useState<string>("");
  const [historyFilter, setHistoryFilter] = useState<'all' | 'current' | 'planned' | 'reference' | 'before'>('all');
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedSpot, setEditedSpot] = useState<SignageSpot | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [defaultTab, setDefaultTab] = useState("details");
  const [spotGroups, setSpotGroups] = useState<SpotGroup[]>([]);

  const fetchUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error: unknown) {
      console.error('Failed to load users:', error);
    }
  }, []);

  const fetchSpot = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from("signage_spots")
        .select("*, venues(*), profiles!signage_spots_assigned_user_id_fkey(id, full_name, email)")
        .eq("id", id)
        .single();

      if (error) throw error;

      // Cast the response to match our extended type
      // The Supabase client types are correct but the join makes it tricky to infer automatically without a complex query type
      const typedData = data as unknown as SignageSpot;

      setSpot(typedData);
      setEditedSpot(typedData);
    } catch (error: unknown) {
      toast.error("Failed to load signage spot");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  const fetchCampaigns = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from("signage_campaigns")
        .select("*, campaigns(*)")
        .eq("signage_spot_id", id);

      if (error) throw error;
      setCampaigns((data as unknown as SignageCampaign[]) || []);
    } catch (error: unknown) {
      console.error("Failed to load campaigns:", error);
    }
  }, [id]);

  const fetchPhotoHistory = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from("photo_history")
        .select("*")
        .eq("signage_spot_id", id)
        .order("upload_date", { ascending: false });

      if (error) throw error;
      setPhotoHistory(data || []);
    } catch (error: unknown) {
      console.error("Failed to load photo history:", error);
    }
  }, [id]);

  const fetchSpotGroups = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from("signage_spot_groups")
        .select("*, signage_groups(*)")
        .eq("signage_spot_id", id);

      if (error) throw error;
      setSpotGroups((data as unknown as SpotGroup[]) || []);
    } catch (error: unknown) {
      console.error("Failed to load spot groups:", error);
    }
  }, [id]);

  const checkUser = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);

      // Get all roles for the user from user_roles (secure)
      const { data: roles } = await supabase
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
  }, []);

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
  }, [id, searchParams, checkUser, fetchSpot, fetchCampaigns, fetchPhotoHistory, fetchUsers, fetchSpotGroups]);

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

      // Handle location photos separately (don't save to photo_history)
      if (imageType === "location") {
        const { error: updateError } = await supabase
          .from('signage_spots')
          .update({
            location_photo_url: publicUrl
          })
          .eq('id', id);

        if (updateError) throw updateError;
      } else {
        // Save to photo_history for content images
        const { error: historyError } = await supabase
          .from('photo_history')
          .insert({
            signage_spot_id: id,
            image_url: publicUrl,
            image_type: imageType,
            caption: uploadCaption || null,
            uploaded_by: user.id,
            scheduled_date: imageType === 'planned' ? scheduledDate || null : null,
            auto_promote: imageType === 'planned' ? autoPromote : false,
            print_status: printRequired ? 'pending' : 'not_required',
            print_vendor: printRequired ? printVendor : null,
            print_due_date: printRequired ? printDueDate : null,
            print_notes: printRequired ? printNotes : null,
          });

        if (historyError) throw historyError;

        // Note: For 'current' image types, the database trigger 'handle_photo_upload()'
        // automatically updates signage_spots.current_image_url and last_update_date.
        // No need to manually update here to avoid race conditions.

        // Update signage_spot based on image type
        if (imageType === "planned" && scheduledDate) {
          // Update next planned image if this is earlier than existing, no existing, or existing is in the past
          const { data: currentSpot } = await supabase
            .from('signage_spots')
            .select('next_planned_date')
            .eq('id', id)
            .single();

          const today = new Date().toISOString().split('T')[0];
          const shouldUpdate = !currentSpot?.next_planned_date ||
            currentSpot.next_planned_date < today ||
            scheduledDate < currentSpot.next_planned_date;

          if (shouldUpdate) {
            const { error: updateError } = await supabase
              .from('signage_spots')
              .update({
                next_planned_image_url: publicUrl,
                next_planned_date: scheduledDate
              })
              .eq('id', id);

            if (updateError) throw updateError;
          }
        }
      }

      toast.success("Image uploaded successfully!");
      setUploadCaption("");
      setScheduledDate("");
      setAutoPromote(true);
      setPrintRequired(false);
      setPrintVendor("");
      setPrintDueDate("");
      setPrintNotes("");
      fetchSpot();
      fetchPhotoHistory();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to upload image: " + errorMessage);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleLocationPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLocationPhoto(true);
    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${id}/location-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('signage')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('signage')
        .getPublicUrl(fileName);

      // Add to photo history as location type
      const { error: historyError } = await supabase
        .from('photo_history')
        .insert({
          signage_spot_id: id,
          image_url: publicUrl,
          image_type: 'location',
          uploaded_by: user?.id,
          approval_status: 'approved',
        });

      if (historyError) throw historyError;

      // Also update signage spot for backward compatibility
      await supabase
        .from('signage_spots')
        .update({ location_photo_url: publicUrl })
        .eq('id', id);

      toast.success("Location photo uploaded successfully!");
      fetchSpot();
      fetchPhotoHistory();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to upload location photo: " + errorMessage);
    } finally {
      setIsUploadingLocationPhoto(false);
      if (locationPhotoInputRef.current) {
        locationPhotoInputRef.current.value = '';
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to delete image: " + errorMessage);
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to save changes: " + errorMessage);
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to update status: " + errorMessage);
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to delete: " + errorMessage);
    }
  };

  const handleQuickIssueSubmit = async (issueText: string, mentionedUserIds: string[]) => {
    if (!user?.id) return;

    try {
      // Insert comment with mentions
      const { data: comment, error: commentError } = await supabase
        .from('comments')
        .insert({
          signage_spot_id: id!,
          body: issueText,
          author_id: user.id,
          mentions: mentionedUserIds,
          needs_attention: true,
          status: 'open',
        })
        .select()
        .single();

      if (commentError) throw commentError;

      // Send Slack notification
      await supabase.functions.invoke('send-comment-notification', {
        body: {
          comment_id: comment.id,
          signage_spot_id: id,
          body: issueText,
          author_id: user.id,
          mentions: mentionedUserIds,
        }
      });

      toast.success("Issue reported and notifications sent");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to report issue: " + errorMessage);
      throw error;
    }
  };

  const handlePromotePlannedImage = async (photoId: string) => {
    try {
      const { data, error } = await supabase.rpc('promote_planned_to_current', {
        p_photo_id: photoId,
        p_promoted_by: user?.id
      });

      if (error) throw error;

      toast.success("Image promoted to current!");
      fetchSpot();
      fetchPhotoHistory();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to promote image: " + errorMessage);
    }
  };

  const handleRollback = async () => {
    try {
      const { data, error } = await supabase.rpc('rollback_to_previous', {
        p_spot_id: id,
        p_user_id: user?.id
      });

      if (error) throw error;

      toast.success("Rolled back to previous image!");
      fetchSpot();
      fetchPhotoHistory();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to rollback: " + errorMessage);
    }
  };

  const canEdit = userRole === 'admin' || userRole === 'manager' || spot?.assigned_user_id === user?.id;
  const canDelete = userRole === 'admin';
  const canPromote = userRole === 'admin' || userRole === 'manager';

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
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>

          <h1 className="text-3xl font-bold tracking-tight mb-2">{spot?.location_name}</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge status={spot?.status} />
            {spot?.venues && (
              <Badge variant="outline" className="text-sm">
                {spot.venues.name}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <Button
            onClick={() => setShowQuickIssueDialog(true)}
            variant="destructive"
            size="lg"
          >
            <AlertCircle className="w-4 h-4 mr-2" />
            Report Issue
          </Button>
          
          <div className="flex gap-2">
            {canEdit && !isEditMode && (
              <>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={handleMarkAsUpdated} variant="outline">
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Refresh Status
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Mark this spot as current and reset the "days active" counter. Use when signage was physically updated but no new photo was taken.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
            <TabsTrigger value="comments">
              <AlertCircle className="w-4 h-4 mr-2" />
              Issues
            </TabsTrigger>
            <TabsTrigger value="qrcode">
              <QrCode className="w-4 h-4 mr-2" />
              QR Code
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Location Photo */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Location Photo
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Photo of the physical space (wall, frame, window)
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                     <div className="relative bg-muted rounded-lg flex items-center justify-center overflow-hidden min-h-[200px]">
                      {(() => {
                        // Get latest location photo from photo history
                        const locationPhoto = photoHistory.find(p => p.image_type === 'location');
                        const locationPhotoUrl = locationPhoto?.image_url || spot.location_photo_url;
                        
                        return locationPhotoUrl ? (
                          <>
                            <img
                              src={locationPhotoUrl}
                              alt={`${spot.location_name} location`}
                              className="max-w-full max-h-[400px] w-auto h-auto object-contain cursor-pointer"
                              onClick={() => setExpandedImage(locationPhotoUrl)}
                            />
                            <Button
                              variant="secondary"
                              size="icon"
                              className="absolute top-2 right-2"
                              onClick={() => setExpandedImage(locationPhotoUrl)}
                            >
                              <Maximize2 className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <div className="text-center text-muted-foreground">
                            <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No location photo</p>
                          </div>
                        );
                      })()}
                    </div>
                    {canEdit && (
                      <div>
                        <input
                          ref={locationPhotoInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleLocationPhotoUpload}
                          className="hidden"
                        />
                        <Button
                          onClick={() => locationPhotoInputRef.current?.click()}
                          disabled={isUploadingLocationPhoto}
                          variant="outline"
                          className="w-full"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          {isUploadingLocationPhoto ? "Uploading..." : 
                            (photoHistory.some(p => p.image_type === 'location') || spot.location_photo_url) ? 
                            "Replace Location Photo" : "Upload Location Photo"}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Current Content */}
              <Card>
                <CardHeader>
                  <CardTitle>Current Content</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Design/poster currently displayed
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="relative bg-muted rounded-lg flex items-center justify-center overflow-hidden min-h-[200px]">
                    {spot.current_image_url ? (
                      <>
                        <img
                          src={spot.current_image_url}
                          alt={spot.location_name}
                          className="max-w-full max-h-[400px] w-auto h-auto object-contain cursor-pointer"
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
                        <p>No content uploaded</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Floor Plan Location */}
            <FloorPlanMiniWidget spotId={id!} spotData={spot} />

            {/* Content Timeline */}
            <div className="grid gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Content Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* PREVIOUS */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded-full bg-muted" />
                        <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Previous</h4>
                      </div>
                      {spot.previous_image_url ? (
                        <div className="space-y-2">
                          <div
                            className="relative bg-muted rounded-lg overflow-hidden cursor-pointer border-2 border-transparent hover:border-primary transition-all"
                            onClick={() => setExpandedImage(spot.previous_image_url)}
                          >
                            <img
                              src={spot.previous_image_url}
                              alt="Previous image"
                              className="w-full h-32 object-cover"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {spot.previous_update_date
                              ? `Replaced ${format(new Date(spot.previous_update_date), 'MMM d, yyyy')}`
                              : 'Historical'
                            }
                          </p>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          No previous image
                        </div>
                      )}
                    </div>

                    {/* CURRENT */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <h4 className="font-semibold text-sm uppercase tracking-wide">Current</h4>
                      </div>
                      {spot.current_image_url ? (
                        <div className="space-y-2">
                          <div
                            className="relative bg-muted rounded-lg overflow-hidden cursor-pointer border-2 border-green-500 hover:border-green-600 transition-all"
                            onClick={() => setExpandedImage(spot.current_image_url)}
                          >
                            <img
                              src={spot.current_image_url}
                              alt="Current image"
                              className="w-full h-32 object-cover"
                            />
                            <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-semibold">
                              LIVE
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {spot.last_update_date
                              ? `Updated ${format(new Date(spot.last_update_date), 'MMM d, yyyy')}`
                              : 'Current'
                            }
                          </p>
                          {spot.last_update_date && (
                            <p className="text-xs font-semibold">
                              {Math.floor((Date.now() - new Date(spot.last_update_date).getTime()) / (1000 * 60 * 60 * 24))} days active
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8 border-2 border-dashed border-muted-foreground/30 rounded-lg">
                          <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm text-muted-foreground">Empty</p>
                        </div>
                      )}
                    </div>

                    {/* UPCOMING */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <h4 className="font-semibold text-sm uppercase tracking-wide text-blue-600">Upcoming</h4>
                      </div>
                      {spot.next_planned_image_url ? (
                        <div className="space-y-2">
                          <div
                            className="relative bg-muted rounded-lg overflow-hidden cursor-pointer border-2 border-blue-500 hover:border-blue-600 transition-all"
                            onClick={() => setExpandedImage(spot.next_planned_image_url)}
                          >
                            <img
                              src={spot.next_planned_image_url}
                              alt="Upcoming image"
                              className="w-full h-32 object-cover"
                            />
                            <div className="absolute top-2 right-2 bg-blue-500 text-white px-2 py-1 rounded text-xs font-semibold">
                              PLANNED
                            </div>
                          </div>
                          <p className="text-xs font-semibold text-blue-600">
                            Goes live {format(new Date(spot.next_planned_date), 'MMM d, yyyy')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {Math.ceil((new Date(spot.next_planned_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days away
                          </p>

                          {canPromote && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full"
                              onClick={() => {
                                const plannedPhoto = photoHistory.find(p => p.image_url === spot.next_planned_image_url);
                                if (plannedPhoto) handlePromotePlannedImage(plannedPhoto.id);
                              }}
                            >
                              <CheckCircle2 className="h-3 w-3 mr-2" />
                              Promote to Current Now
                            </Button>
                          )}

                          {spot.previous_image_url && canPromote && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full"
                                >
                                  <Undo className="h-3 w-3 mr-2" />
                                  Rollback to Previous
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Rollback to Previous Image?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will swap the current and previous images. The current image will become the previous, and vice versa.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <div className="grid grid-cols-2 gap-4 my-4">
                                  <div className="space-y-2">
                                    <p className="text-sm font-semibold">Current → Previous</p>
                                    <img
                                      src={spot.current_image_url}
                                      alt="Current"
                                      className="w-full h-24 object-cover rounded border"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <p className="text-sm font-semibold text-green-600">Previous → Current</p>
                                    <img
                                      src={spot.previous_image_url}
                                      alt="Previous"
                                      className="w-full h-24 object-cover rounded border-2 border-green-500"
                                    />
                                  </div>
                                </div>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={handleRollback}>
                                    Confirm Rollback
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          No upcoming update scheduled
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
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
                        value={editedSpot?.location_name || ""}
                        onChange={(e) => editedSpot && setEditedSpot({ ...editedSpot, location_name: e.target.value })}
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
                        value={editedSpot?.status || "empty"}
                        onValueChange={(value) => editedSpot && setEditedSpot({ ...editedSpot, status: value as SignageSpot['status'] })}
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
                        value={editedSpot?.priority_level || ""}
                        onValueChange={(value) => editedSpot && setEditedSpot({ ...editedSpot, priority_level: value as SignageSpot['priority_level'] })}
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
                        value={editedSpot?.content_category || ""}
                        onValueChange={(value) => editedSpot && setEditedSpot({ ...editedSpot, content_category: value as SignageSpot['content_category'] })}
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
                        value={editedSpot?.assigned_user_id || "unassigned"}
                        onValueChange={(value) => editedSpot && setEditedSpot({ ...editedSpot, assigned_user_id: value === "unassigned" ? null : value })}
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
                      onChange={(tags) => editedSpot && setEditedSpot({ ...editedSpot, tags })}
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
                linkedCampaigns={campaigns.filter(c => c.campaigns) as unknown as { id: string; campaign_id: string; campaigns: Database['public']['Tables']['campaigns']['Row'] }[]}
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
                      value={editedSpot?.width_cm || ""}
                      onChange={(e) => editedSpot && setEditedSpot({ ...editedSpot, width_cm: e.target.value ? parseFloat(e.target.value) : null })}
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
                      value={editedSpot?.height_cm || ""}
                      onChange={(e) => editedSpot && setEditedSpot({ ...editedSpot, height_cm: e.target.value ? parseFloat(e.target.value) : null })}
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
                      value={editedSpot?.depth_cm || ""}
                      onChange={(e) => editedSpot && setEditedSpot({ ...editedSpot, depth_cm: e.target.value ? parseFloat(e.target.value) : null })}
                    />
                  ) : (
                    <p>{spot.depth_cm ? `${spot.depth_cm} cm` : "Not set"}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="orientation">Orientation</Label>
                  {isEditMode ? (
                    <Select
                      value={editedSpot?.orientation || ""}
                      onValueChange={(value) => editedSpot && setEditedSpot({ ...editedSpot, orientation: value as SignageSpot['orientation'] })}
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
                      value={editedSpot?.material_type || ""}
                      onChange={(e) => editedSpot && setEditedSpot({ ...editedSpot, material_type: e.target.value })}
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
                      value={editedSpot?.mounting_type || ""}
                      onChange={(e) => editedSpot && setEditedSpot({ ...editedSpot, mounting_type: e.target.value })}
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
                      value={editedSpot?.specs_notes || ""}
                      onChange={(e) => editedSpot && setEditedSpot({ ...editedSpot, specs_notes: e.target.value })}
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
                        value={editedSpot?.production_cost || ''}
                        onChange={(e) => editedSpot && setEditedSpot({ ...editedSpot, production_cost: e.target.value ? parseFloat(e.target.value) : null })}
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
                        value={editedSpot?.installation_cost || ''}
                        onChange={(e) => editedSpot && setEditedSpot({ ...editedSpot, installation_cost: e.target.value ? parseFloat(e.target.value) : null })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="budget_notes">Budget Notes</Label>
                      <Textarea
                        id="budget_notes"
                        value={editedSpot?.budget_notes || ''}
                        onChange={(e) => editedSpot && setEditedSpot({ ...editedSpot, budget_notes: e.target.value })}
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
                      value={editedSpot?.expiry_behavior || "auto_6_months"}
                      onValueChange={(value) => editedSpot && setEditedSpot({ ...editedSpot, expiry_behavior: value as SignageSpot['expiry_behavior'] })}
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
                      value={editedSpot?.expiry_date || ""}
                      onChange={(e) => editedSpot && setEditedSpot({ ...editedSpot, expiry_date: e.target.value })}
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
                      value={editedSpot?.supplier_vendor || ""}
                      onChange={(e) => editedSpot && setEditedSpot({ ...editedSpot, supplier_vendor: e.target.value })}
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
                      value={editedSpot?.creative_brief || ""}
                      onChange={(e) => editedSpot && setEditedSpot({ ...editedSpot, creative_brief: e.target.value })}
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
                      value={editedSpot?.recommendations || ""}
                      onChange={(e) => editedSpot && setEditedSpot({ ...editedSpot, recommendations: e.target.value })}
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
                      value={editedSpot?.notes || ""}
                      onChange={(e) => editedSpot && setEditedSpot({ ...editedSpot, notes: e.target.value })}
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
                  <Select value={imageType} onValueChange={(value) => setImageType(value as "current" | "before" | "after" | "reference" | "planned" | "location")}>
                    <SelectTrigger id="imageType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current">Current</SelectItem>
                      <SelectItem value="planned">Planned (Schedule for Future)</SelectItem>
                      <SelectItem value="location">Location Photo</SelectItem>
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

                {imageType === 'planned' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="scheduledDate">Go Live Date (Optional)</Label>
                      <Input
                        id="scheduledDate"
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                      />
                      <p className="text-xs text-muted-foreground">
                        When should this image replace the current one? Leave blank if uncertain.
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="autoPromote"
                        checked={autoPromote}
                        onCheckedChange={(checked) => setAutoPromote(checked as boolean)}
                      />
                      <Label htmlFor="autoPromote" className="text-sm font-normal">
                        Automatically promote on scheduled date (requires approval)
                      </Label>
                    </div>

                    <Separator />

                    {/* Print Job Section */}
                    <div className="space-y-4 p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <Label>Print Job Required?</Label>
                        <Switch
                          checked={printRequired}
                          onCheckedChange={setPrintRequired}
                        />
                      </div>

                      {printRequired && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="printVendor">Print Vendor</Label>
                            <Select value={printVendor} onValueChange={setPrintVendor}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select vendor" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Senpais">Senpais</SelectItem>
                                <SelectItem value="VistaPrint">VistaPrint</SelectItem>
                                <SelectItem value="Local Print Shop">Local Print Shop</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="printDueDate">Print Due Date</Label>
                            <Input
                              id="printDueDate"
                              type="date"
                              value={printDueDate}
                              onChange={(e) => setPrintDueDate(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                              When do you need the print ready?
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="printNotes">Print Notes</Label>
                            <Textarea
                              id="printNotes"
                              value={printNotes}
                              onChange={(e) => setPrintNotes(e.target.value)}
                              placeholder="Size, material, special requirements..."
                              rows={2}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}

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
                <div className="flex items-center justify-between">
                  <CardTitle>Photo History</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={historyFilter === 'all' ? 'default' : 'outline'}
                      onClick={() => setHistoryFilter('all')}
                    >
                      All ({photoHistory.length})
                    </Button>
                    <Button
                      size="sm"
                      variant={historyFilter === 'current' ? 'default' : 'outline'}
                      onClick={() => setHistoryFilter('current')}
                    >
                      Current ({photoHistory.filter(p => p.image_type === 'current').length})
                    </Button>
                    <Button
                      size="sm"
                      variant={historyFilter === 'planned' ? 'default' : 'outline'}
                      onClick={() => setHistoryFilter('planned')}
                    >
                      Planned ({photoHistory.filter(p => p.image_type === 'planned').length})
                    </Button>
                    <Button
                      size="sm"
                      variant={historyFilter === 'reference' ? 'default' : 'outline'}
                      onClick={() => setHistoryFilter('reference')}
                    >
                      Reference ({photoHistory.filter(p => p.image_type === 'reference').length})
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {photoHistory.filter(p => historyFilter === 'all' || p.image_type === historyFilter).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No {historyFilter === 'all' ? '' : historyFilter} photos uploaded yet</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {photoHistory.filter(p => historyFilter === 'all' || p.image_type === historyFilter).map((photo) => {
                      const statusConfig: Record<string, { color: string; label: string }> = {
                        current: { color: 'bg-green-500', label: 'CURRENT' },
                        planned: { color: 'bg-blue-500', label: 'PLANNED' },
                        reference: { color: 'bg-gray-500', label: 'REFERENCE' },
                        before: { color: 'bg-gray-400', label: 'BEFORE' },
                        after: { color: 'bg-gray-400', label: 'AFTER' },
                      };
                      const config = statusConfig[photo.image_type] || statusConfig.reference;

                      return (
                        <Card key={photo.id} className="overflow-hidden group">
                          <div className="relative bg-muted min-h-[200px] flex items-center justify-center">
                            <img
                              src={photo.image_url}
                              alt={photo.caption || "Signage photo"}
                              className="max-w-full max-h-[300px] w-auto h-auto object-contain cursor-pointer"
                              onClick={() => setExpandedImage(photo.image_url)}
                            />
                            <div className={`absolute top-2 left-2 px-2 py-1 rounded text-xs font-semibold ${config.color} text-white`}>
                              {config.label}
                            </div>
                            <Button
                              variant="secondary"
                              size="icon"
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => setExpandedImage(photo.image_url)}
                            >
                              <Maximize2 className="w-4 h-4" />
                            </Button>
                          </div>
                          <CardContent className="p-4 space-y-2">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-semibold">
                                  Uploaded {format(new Date(photo.upload_date), 'MMM d, yyyy')}
                                </p>

                                {photo.image_type === 'planned' && photo.scheduled_date && (
                                  <p className="text-xs text-blue-600 font-semibold mt-1">
                                    📅 Scheduled: {format(new Date(photo.scheduled_date), 'MMM d, yyyy')}
                                  </p>
                                )}

                                {photo.print_status && photo.print_status !== 'not_required' && (
                                  <div className="mt-2">
                                    <Badge className={
                                      photo.print_status === 'pending' ? 'bg-gray-500' :
                                        photo.print_status === 'ordered' ? 'bg-blue-500' :
                                          photo.print_status === 'in_production' ? 'bg-yellow-500' :
                                            'bg-green-500'
                                    }>
                                      <Printer className="w-3 h-3 mr-1" />
                                      {photo.print_status.replace('_', ' ').toUpperCase()}
                                      {photo.print_vendor && ` • ${photo.print_vendor}`}
                                    </Badge>
                                  </div>
                                )}
                              </div>

                              <div className="flex gap-1">
                                {photo.image_type === 'planned' && canPromote && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handlePromotePlannedImage(photo.id)}
                                    title="Promote to current"
                                  >
                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                  </Button>
                                )}

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteImage(photo.id, photo.image_url, photo.image_type === 'current')}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>

                            {photo.caption && (
                              <p className="text-sm text-muted-foreground">{photo.caption}</p>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comments">
            <CommentsPanel signageSpotId={id!} />
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

        {/* Quick Issue Report Dialog */}
        <QuickIssueDialog
          open={showQuickIssueDialog}
          onOpenChange={setShowQuickIssueDialog}
          onSubmit={handleQuickIssueSubmit}
          locationName={spot?.location_name || "this location"}
        />

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
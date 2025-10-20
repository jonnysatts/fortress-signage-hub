import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { CampaignDialog } from "@/components/CampaignDialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Calendar as CalendarIcon,
  Image as ImageIcon,
  Link as LinkIcon,
  Unlink,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { format, isPast, isFuture } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<any>(null);
  const [linkedSpots, setLinkedSpots] = useState<any[]>([]);
  const [availableSpots, setAvailableSpots] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [selectedSpots, setSelectedSpots] = useState<Set<string>>(new Set());

  useEffect(() => {
    checkAuth();
    fetchCampaignData();
  }, [id]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchCampaignData = async () => {
    setIsLoading(true);
    try {
      // Fetch campaign details
      const { data: campaignData, error: campaignError } = await supabase
        .from("campaigns" as any)
        .select("*")
        .eq("id", id)
        .single();

      if (campaignError) throw campaignError;
      setCampaign(campaignData);

      // Fetch linked signage spots
      const { data: linkedData, error: linkedError } = await supabase
        .from("signage_campaigns" as any)
        .select(`
          signage_spot_id,
          signage_spots(*, venues(*))
        `)
        .eq("campaign_id", id);

      if (linkedError) throw linkedError;
      setLinkedSpots(linkedData?.map((item: any) => item.signage_spots) || []);

      // Fetch available spots (not linked to this campaign)
      const linkedIds = linkedData?.map((item: any) => item.signage_spot_id) || [];
      let query = supabase
        .from("signage_spots" as any)
        .select("*, venues(*)");

      if (linkedIds.length > 0) {
        query = query.not("id", "in", `(${linkedIds.join(",")})`);
      }

      const { data: availableData, error: availableError } = await query;
      if (availableError) throw availableError;
      setAvailableSpots(availableData || []);
    } catch (error: any) {
      toast.error("Failed to load campaign: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from("campaigns" as any)
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Campaign deleted successfully");
      navigate("/campaigns");
    } catch (error: any) {
      toast.error("Failed to delete campaign: " + error.message);
    }
  };

  const handleUnlinkSpot = async (spotId: string) => {
    try {
      const { error } = await supabase
        .from("signage_campaigns" as any)
        .delete()
        .eq("campaign_id", id)
        .eq("signage_spot_id", spotId);

      if (error) throw error;
      toast.success("Signage spot unlinked");
      fetchCampaignData();
    } catch (error: any) {
      toast.error("Failed to unlink spot: " + error.message);
    }
  };

  const handleLinkSpots = async () => {
    if (selectedSpots.size === 0) return;

    try {
      const links = Array.from(selectedSpots).map((spotId) => ({
        campaign_id: id,
        signage_spot_id: spotId,
      }));

      const { error } = await supabase
        .from("signage_campaigns" as any)
        .insert(links);

      if (error) throw error;
      toast.success(`Linked ${selectedSpots.size} signage spot(s)`);
      setSelectedSpots(new Set());
      setShowLinkDialog(false);
      fetchCampaignData();
    } catch (error: any) {
      toast.error("Failed to link spots: " + error.message);
    }
  };

  const getCampaignStatus = () => {
    if (!campaign?.start_date || !campaign?.end_date) return "draft";
    
    const now = new Date();
    const start = new Date(campaign.start_date);
    const end = new Date(campaign.end_date);

    if (isPast(end)) return "ended";
    if (isFuture(start)) return "upcoming";
    return "active";
  };

  const getHealthMetrics = () => {
    if (linkedSpots.length === 0) return { percentage: 0, current: 0, total: 0 };
    const current = linkedSpots.filter((spot) => spot.status === "current").length;
    return {
      percentage: Math.round((current / linkedSpots.length) * 100),
      current,
      total: linkedSpots.length,
    };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-muted-foreground">Loading campaign...</div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Campaign not found</h2>
          <Button onClick={() => navigate("/campaigns")}>Back to Campaigns</Button>
        </div>
      </div>
    );
  }

  const status = getCampaignStatus();
  const health = getHealthMetrics();

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/campaigns")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Campaigns
          </Button>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{campaign.name}</h1>
                <Badge variant={status === "active" ? "default" : "secondary"}>
                  {status}
                </Badge>
              </div>
              {campaign.description && (
                <p className="text-muted-foreground mb-4">{campaign.description}</p>
              )}
              {campaign.start_date && campaign.end_date && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarIcon className="w-4 h-4" />
                  <span>
                    {format(new Date(campaign.start_date), "MMM d, yyyy")} -{" "}
                    {format(new Date(campaign.end_date), "MMM d, yyyy")}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <CampaignDialog
                campaign={campaign}
                onSuccess={fetchCampaignData}
                trigger={
                  <Button variant="outline">
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                }
              />
              <Button variant="outline" onClick={() => setShowDeleteDialog(true)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Health Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Campaign Health</CardDescription>
              <CardTitle className="text-3xl">{health.percentage}%</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {health.current} of {health.total} spots current
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Signage</CardDescription>
              <CardTitle className="text-3xl">{linkedSpots.length}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Available to Link</CardDescription>
              <CardTitle className="text-3xl">{availableSpots.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mb-6">
          <Button onClick={() => setShowLinkDialog(true)}>
            <LinkIcon className="w-4 h-4 mr-2" />
            Link Signage
          </Button>
        </div>

        {/* Linked Signage */}
        <Card>
          <CardHeader>
            <CardTitle>Linked Signage ({linkedSpots.length})</CardTitle>
            <CardDescription>
              Signage spots associated with this campaign
            </CardDescription>
          </CardHeader>
          <CardContent>
            {linkedSpots.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No signage spots linked yet
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {linkedSpots.map((spot) => (
                  <Card key={spot.id} className="border">
                    <CardHeader>
                      <div className="aspect-video bg-muted rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                        {spot.current_image_url ? (
                          <img
                            src={spot.current_image_url}
                            alt={spot.location_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="w-12 h-12 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-base">{spot.location_name}</CardTitle>
                          <CardDescription>{spot.venues?.name}</CardDescription>
                        </div>
                        <StatusBadge status={spot.status} />
                      </div>
                    </CardHeader>
                    <CardContent className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => navigate(`/signage/${spot.id}`)}
                      >
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnlinkSpot(spot.id)}
                      >
                        <Unlink className="w-3 h-3" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Link Dialog */}
        <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Link Signage to Campaign</DialogTitle>
              <DialogDescription>
                Select signage spots to add to this campaign
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {availableSpots.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  No available signage spots to link
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {availableSpots.map((spot) => (
                    <Card
                      key={spot.id}
                      className={`cursor-pointer transition-all ${
                        selectedSpots.has(spot.id) ? "ring-2 ring-primary" : ""
                      }`}
                      onClick={() => {
                        const newSelected = new Set(selectedSpots);
                        if (newSelected.has(spot.id)) {
                          newSelected.delete(spot.id);
                        } else {
                          newSelected.add(spot.id);
                        }
                        setSelectedSpots(newSelected);
                      }}
                    >
                      <CardHeader>
                        <div className="flex items-start gap-3">
                          <Checkbox checked={selectedSpots.has(spot.id)} />
                          <div className="flex-1">
                            <CardTitle className="text-base">{spot.location_name}</CardTitle>
                            <CardDescription>{spot.venues?.name}</CardDescription>
                          </div>
                          <StatusBadge status={spot.status} />
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-4">
                <span className="text-sm text-muted-foreground">
                  {selectedSpots.size} spot{selectedSpots.size !== 1 ? "s" : ""} selected
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleLinkSpots} disabled={selectedSpots.size === 0}>
                    Link Selected
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this campaign? This will also remove all
                signage links. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

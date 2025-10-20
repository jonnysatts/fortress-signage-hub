import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CampaignDialog } from "@/components/CampaignDialog";
import { ImportDataButton } from "@/components/ImportDataButton";
import { 
  Plus, 
  Calendar as CalendarIcon, 
  Edit2, 
  Trash2,
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

export default function Campaigns() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
    fetchCampaigns();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchCampaigns = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("campaigns" as any)
        .select(`
          *,
          signage_campaigns(count)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error: any) {
      toast.error("Failed to load campaigns: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from("campaigns" as any)
        .delete()
        .eq("id", deleteId);

      if (error) throw error;
      toast.success("Campaign deleted successfully");
      fetchCampaigns();
    } catch (error: any) {
      toast.error("Failed to delete campaign: " + error.message);
    } finally {
      setDeleteId(null);
    }
  };

  const getCampaignStatus = (campaign: any) => {
    if (!campaign.start_date || !campaign.end_date) return "draft";
    
    const now = new Date();
    const start = new Date(campaign.start_date);
    const end = new Date(campaign.end_date);

    if (isPast(end)) return "ended";
    if (isFuture(start)) return "upcoming";
    return "active";
  };

  const getStatusBadge = (status: string) => {
    const config = {
      active: { label: "Active", variant: "default" as const },
      upcoming: { label: "Upcoming", variant: "secondary" as const },
      ended: { label: "Ended", variant: "outline" as const },
      draft: { label: "Draft", variant: "outline" as const },
    };
    const { label, variant } = config[status as keyof typeof config] || config.draft;
    return <Badge variant={variant}>{label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Campaigns</h1>
            <p className="text-muted-foreground">
              Organize and manage your signage campaigns
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ImportDataButton />
            <CampaignDialog
              onSuccess={fetchCampaigns}
              trigger={
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  New Campaign
                </Button>
              }
            />
          </div>
        </div>

        {/* Campaigns Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <Card className="border-0 shadow-md">
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                <CalendarIcon className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
              <p className="text-muted-foreground mb-4">Get started by creating your first campaign</p>
              <CampaignDialog onSuccess={fetchCampaigns} />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign) => {
              const status = getCampaignStatus(campaign);
              const signageCount = campaign.signage_campaigns?.[0]?.count || 0;

              return (
                <Card 
                  key={campaign.id} 
                  className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => navigate(`/campaigns/${campaign.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-1">{campaign.name}</CardTitle>
                        {campaign.description && (
                          <CardDescription className="line-clamp-2">
                            {campaign.description}
                          </CardDescription>
                        )}
                      </div>
                      {getStatusBadge(status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {campaign.start_date && campaign.end_date && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarIcon className="w-4 h-4" />
                          <span>
                            {format(new Date(campaign.start_date), "MMM d")} - {format(new Date(campaign.end_date), "MMM d, yyyy")}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <BarChart3 className="w-4 h-4" />
                        <span>{signageCount} signage spot{signageCount !== 1 ? "s" : ""}</span>
                      </div>

                      <div className="flex items-center gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                        <CampaignDialog
                          campaign={campaign}
                          onSuccess={fetchCampaigns}
                          trigger={
                            <Button variant="outline" size="sm" className="flex-1">
                              <Edit2 className="w-3 h-3 mr-1" />
                              Edit
                            </Button>
                          }
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteId(campaign.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this campaign? This action cannot be undone.
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

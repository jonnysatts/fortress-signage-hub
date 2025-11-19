import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Link, Unlink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Campaign {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}

interface LinkedCampaign {
  id: string;
  campaign_id: string;
  campaigns: Campaign;
}

interface CampaignLinkerProps {
  signageSpotId: string;
  linkedCampaigns: LinkedCampaign[];
  onUpdate: () => void;
  disabled?: boolean;
}

export function CampaignLinker({ 
  signageSpotId, 
  linkedCampaigns = [], 
  onUpdate, 
  disabled = false 
}: CampaignLinkerProps) {
  const [allCampaigns, setAllCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isPostgrestError = (error: unknown): error is { code?: string } => {
    return Boolean(error) && typeof error === 'object' && 'code' in error;
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('is_active', true)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setAllCampaigns(data || []);
    } catch (error: unknown) {
      toast.error("Failed to load campaigns");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkCampaign = async (campaignId: string) => {
    try {
      const { error } = await supabase
        .from('signage_campaigns')
        .insert({
          signage_spot_id: signageSpotId,
          campaign_id: campaignId,
        });

      if (error) throw error;
      toast.success("Campaign linked");
      onUpdate();
    } catch (error: unknown) {
      if (isPostgrestError(error) && error.code === '23505') {
        toast.error("This campaign is already linked");
      } else {
        toast.error("Failed to link campaign");
      }
      console.error(error);
    }
  };

  const handleUnlinkCampaign = async (linkId: string) => {
    try {
      const { error } = await supabase
        .from('signage_campaigns')
        .delete()
        .eq('id', linkId);

      if (error) throw error;
      toast.success("Campaign unlinked");
      onUpdate();
    } catch (error: unknown) {
      toast.error("Failed to unlink campaign");
      console.error(error);
    }
  };

  const linkedCampaignIds = linkedCampaigns.map(lc => lc.campaigns.id);
  const availableCampaigns = allCampaigns.filter(
    c => !linkedCampaignIds.includes(c.id)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Link className="w-4 h-4" />
          Linked Campaigns
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {linkedCampaigns.length > 0 ? (
          <div className="space-y-2">
            {linkedCampaigns.map((link) => (
              <div
                key={link.id}
                className="flex items-center justify-between p-3 bg-muted rounded-lg"
              >
                <div className="flex-1">
                  <div className="font-medium">{link.campaigns.name}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Calendar className="w-3 h-3" />
                    {link.campaigns.start_date && format(new Date(link.campaigns.start_date), 'PP')}
                    {link.campaigns.end_date && ` - ${format(new Date(link.campaigns.end_date), 'PP')}`}
                  </div>
                </div>
                {!disabled && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnlinkCampaign(link.id)}
                  >
                    <Unlink className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No campaigns linked</p>
        )}

        {!disabled && availableCampaigns.length > 0 && (
          <div className="pt-2 border-t">
            <Select onValueChange={handleLinkCampaign} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Link to campaign" />
              </SelectTrigger>
              <SelectContent>
                {availableCampaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    <div className="flex items-center gap-2">
                      {campaign.name}
                      {campaign.is_active && (
                        <Badge variant="default" className="text-xs">Active</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

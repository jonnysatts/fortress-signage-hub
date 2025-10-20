import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CampaignDialogProps {
  campaign?: any;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function CampaignDialog({ campaign, onSuccess, trigger }: CampaignDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(campaign?.name || "");
  const [description, setDescription] = useState(campaign?.description || "");
  const [startDate, setStartDate] = useState<Date | undefined>(
    campaign?.start_date ? new Date(campaign.start_date) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    campaign?.end_date ? new Date(campaign.end_date) : undefined
  );
  const [isActive, setIsActive] = useState(campaign?.is_active ?? true);
  const [budgetAllocated, setBudgetAllocated] = useState(campaign?.budget_allocated || "");
  const [budgetNotes, setBudgetNotes] = useState(campaign?.budget_notes || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const campaignData = {
        name,
        description,
        start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
        end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
        is_active: isActive,
        budget_allocated: budgetAllocated ? Number(budgetAllocated) : null,
        budget_notes: budgetNotes || null,
        created_by: user?.id,
      };

      if (campaign) {
        const { error } = await supabase
          .from("campaigns" as any)
          .update(campaignData)
          .eq("id", campaign.id);

        if (error) throw error;
        toast.success("Campaign updated successfully");
      } else {
        const { error } = await supabase
          .from("campaigns" as any)
          .insert(campaignData);

        if (error) throw error;
        toast.success("Campaign created successfully");
      }

      setOpen(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error("Failed to save campaign: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button>Create Campaign</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{campaign ? "Edit Campaign" : "Create Campaign"}</DialogTitle>
          <DialogDescription>
            {campaign ? "Update campaign details" : "Create a new campaign to organize your signage"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Campaign Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Summer Promotion 2025"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Campaign objectives and details..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget">Budget Allocated (AUD) - Optional</Label>
            <Input
              id="budget"
              type="number"
              step="0.01"
              min="0"
              value={budgetAllocated}
              onChange={(e) => setBudgetAllocated(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="budgetNotes">Budget Notes - Optional</Label>
            <Textarea
              id="budgetNotes"
              value={budgetNotes}
              onChange={(e) => setBudgetNotes(e.target.value)}
              placeholder="Optional notes about budget breakdown..."
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : campaign ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

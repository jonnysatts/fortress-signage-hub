import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Save, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TagSelector } from "@/components/TagSelector";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

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
  const [selectedGroups, setSelectedGroups] = useState<string[]>(campaign?.groups || []);
  const [tags, setTags] = useState<string[]>(campaign?.tags || []);
  const [templates, setTemplates] = useState<any[]>([]);
  const [availableGroups, setAvailableGroups] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showTemplateSave, setShowTemplateSave] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");

  useEffect(() => {
    if (open) {
      fetchTemplates();
      fetchGroups();
    }
  }, [open]);

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from('campaign_templates')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    setTemplates(data || []);
  };

  const fetchGroups = async () => {
    const { data } = await supabase
      .from('signage_groups')
      .select('*')
      .order('name');
    
    setAvailableGroups(data || []);
  };

  const handleLoadTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template?.template_config) {
      setSelectedGroups(template.template_config.groups || []);
      setTags(template.template_config.tags || []);
      toast.success(`Loaded template: ${template.name}`);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('campaign_templates')
        .insert({
          name: templateName.trim(),
          description: templateDescription.trim() || null,
          created_by: user?.id,
          template_config: {
            groups: selectedGroups,
            tags: tags,
          }
        });

      if (error) throw error;

      toast.success("Template saved successfully");
      setShowTemplateSave(false);
      setTemplateName("");
      setTemplateDescription("");
      fetchTemplates();
    } catch (error: any) {
      toast.error("Failed to save template");
      console.error(error);
    }
  };

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
        budget_allocated: budgetAllocated || null,
        budget_notes: budgetNotes || null,
        groups: selectedGroups,
        tags: tags,
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
          {/* Template Loader */}
          {templates.length > 0 && !campaign && (
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
              <Label className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Load from Template
              </Label>
              <Select onValueChange={handleLoadTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex flex-col">
                        <span>{template.name}</span>
                        {template.description && (
                          <span className="text-xs text-muted-foreground">{template.description}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
                    className="pointer-events-auto"
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
                    className="pointer-events-auto"
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

          <Separator />

          {/* Groups and Tags */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Groups</Label>
              <div className="space-y-2">
                {selectedGroups.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedGroups.map((groupId) => {
                      const group = availableGroups.find(g => g.id === groupId);
                      return group ? (
                        <Badge
                          key={groupId}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => setSelectedGroups(selectedGroups.filter(id => id !== groupId))}
                        >
                          {group.name} ×
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
                <Select
                  value=""
                  onValueChange={(value) => {
                    if (!selectedGroups.includes(value)) {
                      setSelectedGroups([...selectedGroups, value]);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Add a group..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableGroups
                      .filter(g => !selectedGroups.includes(g.id))
                      .map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <TagSelector
                tags={tags}
                onChange={setTags}
              />
            </div>
          </div>

          <Separator />

          {/* Save as Template */}
          {(selectedGroups.length > 0 || tags.length > 0) && !showTemplateSave && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowTemplateSave(true)}
              className="w-full"
            >
              <Save className="w-4 h-4 mr-2" />
              Save as Template
            </Button>
          )}

          {showTemplateSave && (
            <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
              <div className="space-y-2">
                <Label htmlFor="templateName">Template Name *</Label>
                <Input
                  id="templateName"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Main Floor Posters"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="templateDescription">Description</Label>
                <Textarea
                  id="templateDescription"
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Describe what this template is for..."
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowTemplateSave(false);
                    setTemplateName("");
                    setTemplateDescription("");
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveAsTemplate}
                  className="flex-1"
                >
                  Save Template
                </Button>
              </div>
            </div>
          )}

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

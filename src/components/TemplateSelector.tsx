import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type CampaignTemplate = Database["public"]["Tables"]["campaign_templates"]["Row"];
interface TemplateConfig {
  groups?: string[] | null;
  tags?: string[] | null;
}

interface TemplateSelectorProps {
  onTemplateSelect: (groups: string[], tags: string[]) => void;
  userRole?: string;
}

export function TemplateSelector({ onTemplateSelect, userRole }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  const canEdit = userRole === 'admin' || userRole === 'manager';

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('campaign_templates')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: unknown) {
      toast.error("Failed to load templates");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      const config = template.template_config as TemplateConfig;
      onTemplateSelect(
        config.groups || [],
        config.tags || []
      );
      toast.success(`Applied template: ${template.name}`);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate || !canEdit) return;

    try {
      const { error } = await supabase
        .from('campaign_templates')
        .update({ is_active: false })
        .eq('id', selectedTemplate);

      if (error) throw error;

      toast.success("Template deleted");
      setSelectedTemplate("");
      fetchTemplates();
    } catch (error: unknown) {
      toast.error("Failed to delete template");
      console.error(error);
    }
  };

  if (templates.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div className="flex gap-2 items-center">
      <FileText className="w-4 h-4 text-muted-foreground" />
      <Select value={selectedTemplate} onValueChange={handleTemplateSelect} disabled={isLoading}>
        <SelectTrigger className="w-[250px]">
          <SelectValue placeholder="Load template..." />
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
      {selectedTemplate && canEdit && (
        <Button variant="ghost" size="sm" onClick={handleDeleteTemplate}>
          <Trash2 className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}

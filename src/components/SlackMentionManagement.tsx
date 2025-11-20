import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, UserPlus, Info } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";

interface SlackMention {
  id: string;
  user_name: string;
  slack_user_id: string;
  mention_for_severities: string[];
}

export function SlackMentionManagement({ canEdit }: { canEdit: boolean }) {
  const [mentions, setMentions] = useState<SlackMention[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMention, setEditingMention] = useState<SlackMention | null>(null);
  const [formData, setFormData] = useState({
    user_name: "",
    slack_user_id: "",
    mention_for_severities: ["critical"] as string[],
  });

  useEffect(() => {
    fetchMentions();
  }, []);

  const fetchMentions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("slack_mention_settings")
        .select("*")
        .order("user_name");

      if (error) throw error;
      setMentions(data || []);
    } catch (error) {
      console.error("Error fetching mentions:", error);
      toast.error("Failed to load Slack mention settings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (mention?: SlackMention) => {
    if (mention) {
      setEditingMention(mention);
      setFormData({
        user_name: mention.user_name,
        slack_user_id: mention.slack_user_id,
        mention_for_severities: mention.mention_for_severities,
      });
    } else {
      setEditingMention(null);
      setFormData({
        user_name: "",
        slack_user_id: "",
        mention_for_severities: ["critical"],
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editingMention) {
        const { error } = await supabase
          .from("slack_mention_settings")
          .update(formData)
          .eq("id", editingMention.id);

        if (error) throw error;
        toast.success("Mention settings updated");
      } else {
        const { error } = await supabase
          .from("slack_mention_settings")
          .insert(formData);

        if (error) throw error;
        toast.success("Mention settings added");
      }

      setIsDialogOpen(false);
      fetchMentions();
    } catch (error) {
      console.error("Error saving mention:", error);
      toast.error("Failed to save mention settings");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("slack_mention_settings")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Mention settings deleted");
      fetchMentions();
    } catch (error) {
      console.error("Error deleting mention:", error);
      toast.error("Failed to delete mention settings");
    }
  };

  const toggleSeverity = (severity: string) => {
    setFormData((prev) => ({
      ...prev,
      mention_for_severities: prev.mention_for_severities.includes(severity)
        ? prev.mention_for_severities.filter((s) => s !== severity)
        : [...prev.mention_for_severities, severity],
    }));
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Configure which Slack users should be mentioned (@username) in alert messages based on severity.
          To find a user's Slack ID, right-click their profile in Slack → Copy → Copy member ID.
        </AlertDescription>
      </Alert>

      {mentions.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No mention settings configured yet. Add users to be notified for critical alerts.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {mentions.map((mention) => (
            <Card key={mention.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{mention.user_name}</CardTitle>
                    <CardDescription className="font-mono text-xs">
                      {mention.slack_user_id}
                    </CardDescription>
                  </div>
                  {canEdit && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog(mention)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(mention.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  {mention.mention_for_severities.map((severity) => (
                    <span
                      key={severity}
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        severity === "critical"
                          ? "bg-destructive/10 text-destructive"
                          : severity === "warning"
                          ? "bg-yellow-100 text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-400"
                          : "bg-blue-100 text-blue-900 dark:bg-blue-900/20 dark:text-blue-400"
                      }`}
                    >
                      {severity}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {canEdit && (
        <Button onClick={() => handleOpenDialog()} className="w-full">
          <UserPlus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMention ? "Edit" : "Add"} Slack Mention
            </DialogTitle>
            <DialogDescription>
              Configure which user should be mentioned in Slack alerts and for which severity levels.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="user_name">User Name</Label>
              <Input
                id="user_name"
                value={formData.user_name}
                onChange={(e) =>
                  setFormData({ ...formData, user_name: e.target.value })
                }
                placeholder="e.g., Jon, Beth, Casey"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slack_user_id">Slack User ID</Label>
              <Input
                id="slack_user_id"
                value={formData.slack_user_id}
                onChange={(e) =>
                  setFormData({ ...formData, slack_user_id: e.target.value })
                }
                placeholder="e.g., U1234567890"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Find this by right-clicking the user in Slack → Copy → Copy member ID
              </p>
            </div>

            <div className="space-y-2">
              <Label>Mention for Severity Levels</Label>
              <div className="space-y-2">
                {["critical", "warning", "info"].map((severity) => (
                  <div key={severity} className="flex items-center space-x-2">
                    <Checkbox
                      id={severity}
                      checked={formData.mention_for_severities.includes(severity)}
                      onCheckedChange={() => toggleSeverity(severity)}
                    />
                    <label
                      htmlFor={severity}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize"
                    >
                      {severity}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingMention ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Tag, Folder } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SignageGroup {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  created_at: string | null;
}

interface CategoryTagManagementProps {
  canEdit: boolean;
}

export function CategoryTagManagement({ canEdit }: CategoryTagManagementProps) {
  const [groups, setGroups] = useState<SignageGroup[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState<SignageGroup | null>(null);
  const [groupForm, setGroupForm] = useState({
    name: "",
    description: "",
    color: "#6B7280",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch groups
      const { data: groupsData, error: groupsError } = await supabase
        .from("signage_groups")
        .select("*")
        .order("name");

      if (groupsError) throw groupsError;
      setGroups(groupsData || []);

      // Fetch all unique tags from signage spots
      const { data: spotsData, error: spotsError } = await supabase
        .from("signage_spots")
        .select("tags");

      if (spotsError) throw spotsError;

      const tagsSet = new Set<string>();
      spotsData?.forEach((spot) => {
        spot.tags?.forEach((tag: string) => tagsSet.add(tag));
      });
      setAllTags(Array.from(tagsSet).sort());
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load categories and tags");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupForm.name.trim()) {
      toast.error("Group name is required");
      return;
    }

    try {
      const { error } = await supabase.from("signage_groups").insert({
        name: groupForm.name,
        description: groupForm.description || null,
        color: groupForm.color,
      });

      if (error) throw error;

      toast.success("Group created successfully");
      setShowGroupDialog(false);
      setGroupForm({ name: "", description: "", color: "#6B7280" });
      fetchData();
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error("Failed to create group");
    }
  };

  const handleUpdateGroup = async () => {
    if (!editingGroup || !groupForm.name.trim()) return;

    try {
      const { error } = await supabase
        .from("signage_groups")
        .update({
          name: groupForm.name,
          description: groupForm.description || null,
          color: groupForm.color,
        })
        .eq("id", editingGroup.id);

      if (error) throw error;

      toast.success("Group updated successfully");
      setShowGroupDialog(false);
      setEditingGroup(null);
      setGroupForm({ name: "", description: "", color: "#6B7280" });
      fetchData();
    } catch (error) {
      console.error("Error updating group:", error);
      toast.error("Failed to update group");
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm("Are you sure you want to delete this group?")) return;

    try {
      const { error } = await supabase
        .from("signage_groups")
        .delete()
        .eq("id", groupId);

      if (error) throw error;

      toast.success("Group deleted successfully");
      fetchData();
    } catch (error) {
      console.error("Error deleting group:", error);
      toast.error("Failed to delete group");
    }
  };

  const openEditDialog = (group: SignageGroup) => {
    setEditingGroup(group);
    setGroupForm({
      name: group.name,
      description: group.description || "",
      color: group.color || "#6B7280",
    });
    setShowGroupDialog(true);
  };

  const openCreateDialog = () => {
    setEditingGroup(null);
    setGroupForm({ name: "", description: "", color: "#6B7280" });
    setShowGroupDialog(true);
  };

  if (isLoading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Groups Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Folder className="w-5 h-5" />
                Signage Groups
              </CardTitle>
              <CardDescription>
                Organize signage spots into logical groups for better management
              </CardDescription>
            </div>
            {canEdit && (
              <Button onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Add Group
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No groups created yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Color</TableHead>
                  {canEdit && <TableHead className="w-[100px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium">{group.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {group.description || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded border"
                          style={{ backgroundColor: group.color || "#6B7280" }}
                        />
                        <span className="text-sm text-muted-foreground">
                          {group.color}
                        </span>
                      </div>
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(group)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteGroup(group.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Tags Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5" />
            Tags in Use
          </CardTitle>
          <CardDescription>
            All tags currently applied to signage spots across the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allTags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tags in use yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          <p className="text-sm text-muted-foreground mt-4">
            Tags are managed directly on signage spots. Create or remove tags by editing individual signage spots.
          </p>
        </CardContent>
      </Card>

      {/* Group Dialog */}
      <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingGroup ? "Edit Group" : "Create New Group"}
            </DialogTitle>
            <DialogDescription>
              {editingGroup
                ? "Update the group details below"
                : "Add a new group to organize your signage spots"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Group Name</Label>
              <Input
                id="name"
                value={groupForm.name}
                onChange={(e) =>
                  setGroupForm({ ...groupForm, name: e.target.value })
                }
                placeholder="e.g., Main Entrance, Food Court, Retail Area"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={groupForm.description}
                onChange={(e) =>
                  setGroupForm({ ...groupForm, description: e.target.value })
                }
                placeholder="Describe the purpose or location of this group"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  type="color"
                  value={groupForm.color}
                  onChange={(e) =>
                    setGroupForm({ ...groupForm, color: e.target.value })
                  }
                  className="w-20"
                />
                <Input
                  value={groupForm.color}
                  onChange={(e) =>
                    setGroupForm({ ...groupForm, color: e.target.value })
                  }
                  placeholder="#6B7280"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGroupDialog(false)}>
              Cancel
            </Button>
            <Button onClick={editingGroup ? handleUpdateGroup : handleCreateGroup}>
              {editingGroup ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

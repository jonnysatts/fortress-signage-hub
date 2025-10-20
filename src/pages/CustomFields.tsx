import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Trash2, Save, Edit2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

export default function CustomFields() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<any>(null);
  const [deleteFieldId, setDeleteFieldId] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    field_name: "",
    field_label: "",
    field_type: "text" as "text" | "number" | "date" | "dropdown" | "checkbox",
    is_required: false,
    is_visible: true,
    field_options: null as any,
    applies_to_venues: [] as string[],
    applies_to_categories: [] as string[],
  });

  useEffect(() => {
    checkAuth();
    fetchCustomFields();
    fetchVenues();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUser(session.user);

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id);

    const roleList = roles?.map(r => r.role) || [];
    const effectiveRole = roleList.includes('admin') ? 'admin' : roleList.includes('manager') ? 'manager' : 'staff';
    setUserRole(effectiveRole);
  };

  const fetchCustomFields = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('custom_fields')
        .select('*')
        .order('field_order', { ascending: true });

      if (error) throw error;
      setCustomFields(data || []);
    } catch (error: any) {
      toast.error("Failed to load custom fields");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVenues = async () => {
    try {
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      setVenues(data || []);
    } catch (error: any) {
      console.error("Failed to load venues:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      field_name: "",
      field_label: "",
      field_type: "text",
      is_required: false,
      is_visible: true,
      field_options: null,
      applies_to_venues: [],
      applies_to_categories: [],
    });
    setEditingField(null);
  };

  const handleEdit = (field: any) => {
    setEditingField(field);
    setFormData({
      field_name: field.field_name,
      field_label: field.field_label,
      field_type: field.field_type,
      is_required: field.is_required,
      is_visible: field.is_visible,
      field_options: field.field_options,
      applies_to_venues: field.applies_to_venues || [],
      applies_to_categories: field.applies_to_categories || [],
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.field_name || !formData.field_label) {
      toast.error("Field name and label are required");
      return;
    }

    try {
      if (editingField) {
        // Update existing field
        const { error } = await supabase
          .from('custom_fields')
          .update({
            field_name: formData.field_name,
            field_label: formData.field_label,
            field_type: formData.field_type,
            is_required: formData.is_required,
            is_visible: formData.is_visible,
            field_options: formData.field_options,
            applies_to_venues: formData.applies_to_venues.length > 0 ? formData.applies_to_venues : null,
            applies_to_categories: formData.applies_to_categories.length > 0 ? formData.applies_to_categories : null,
          })
          .eq('id', editingField.id);

        if (error) throw error;
        toast.success("Custom field updated!");
      } else {
        // Create new field
        const { error } = await supabase
          .from('custom_fields')
          .insert({
            field_name: formData.field_name,
            field_label: formData.field_label,
            field_type: formData.field_type,
            is_required: formData.is_required,
            is_visible: formData.is_visible,
            field_options: formData.field_options,
            applies_to_venues: formData.applies_to_venues.length > 0 ? formData.applies_to_venues : null,
            applies_to_categories: formData.applies_to_categories.length > 0 ? formData.applies_to_categories : null,
            field_order: customFields.length,
            created_by: user?.id,
          });

        if (error) throw error;
        toast.success("Custom field created!");
      }

      fetchCustomFields();
      setIsDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error("Failed to save custom field: " + error.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteFieldId) return;

    try {
      const { error } = await supabase
        .from('custom_fields')
        .delete()
        .eq('id', deleteFieldId);

      if (error) throw error;

      toast.success("Custom field deleted");
      fetchCustomFields();
      setDeleteFieldId(null);
    } catch (error: any) {
      toast.error("Failed to delete custom field: " + error.message);
    }
  };

  const getFieldTypeLabel = (type: string) => {
    switch (type) {
      case "text": return "Text";
      case "number": return "Number";
      case "date": return "Date";
      case "dropdown": return "Dropdown";
      case "checkbox": return "Checkbox";
      default: return type;
    }
  };

  const canEdit = userRole === 'admin';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate("/settings")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Settings
          </Button>

          {canEdit && (
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Custom Field
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingField ? "Edit Custom Field" : "Create Custom Field"}</DialogTitle>
                  <DialogDescription>
                    Define custom fields that can be added to signage spots
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="field_name">Field Name (Internal)</Label>
                      <Input
                        id="field_name"
                        placeholder="e.g., installation_difficulty"
                        value={formData.field_name}
                        onChange={(e) => setFormData({ ...formData, field_name: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="field_label">Field Label (Display)</Label>
                      <Input
                        id="field_label"
                        placeholder="e.g., Installation Difficulty"
                        value={formData.field_label}
                        onChange={(e) => setFormData({ ...formData, field_label: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="field_type">Field Type</Label>
                    <Select
                      value={formData.field_type}
                      onValueChange={(value: any) => setFormData({ ...formData, field_type: value })}
                    >
                      <SelectTrigger id="field_type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="dropdown">Dropdown</SelectItem>
                        <SelectItem value="checkbox">Checkbox</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.field_type === 'dropdown' && (
                    <div className="space-y-2">
                      <Label htmlFor="options">Dropdown Options (comma-separated)</Label>
                      <Input
                        id="options"
                        placeholder="e.g., Easy, Medium, Hard"
                        value={formData.field_options?.options?.join(', ') || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          field_options: { options: e.target.value.split(',').map(s => s.trim()) }
                        })}
                      />
                    </div>
                  )}

                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is_required"
                        checked={formData.is_required}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_required: checked })}
                      />
                      <Label htmlFor="is_required">Required</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is_visible"
                        checked={formData.is_visible}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_visible: checked })}
                      />
                      <Label htmlFor="is_visible">Visible</Label>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave}>
                    <Save className="w-4 h-4 mr-2" />
                    {editingField ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Custom Fields</h1>
          <p className="text-muted-foreground">
            Manage custom fields that can be added to signage spots
          </p>
        </div>

        {customFields.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No custom fields defined yet</p>
              {canEdit && (
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Custom Field
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {customFields.map((field) => (
              <Card key={field.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{field.field_label}</CardTitle>
                      <CardDescription>
                        {field.field_name} • {getFieldTypeLabel(field.field_type)}
                        {field.is_required && " • Required"}
                        {!field.is_visible && " • Hidden"}
                      </CardDescription>
                    </div>
                    {canEdit && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleEdit(field)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setDeleteFieldId(field.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm space-y-1">
                    {field.field_options?.options && (
                      <p className="text-muted-foreground">
                        Options: {field.field_options.options.join(', ')}
                      </p>
                    )}
                    {field.applies_to_venues && field.applies_to_venues.length > 0 && (
                      <p className="text-muted-foreground">
                        Applies to specific venues
                      </p>
                    )}
                    {field.applies_to_categories && field.applies_to_categories.length > 0 && (
                      <p className="text-muted-foreground">
                        Applies to: {field.applies_to_categories.join(', ')}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!canEdit && (
          <p className="text-sm text-muted-foreground text-center mt-8">
            Only admins can manage custom fields
          </p>
        )}

        <AlertDialog open={!!deleteFieldId} onOpenChange={() => setDeleteFieldId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this custom field and all associated data from signage spots.
                This action cannot be undone.
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
      </div>
    </div>
  );
}

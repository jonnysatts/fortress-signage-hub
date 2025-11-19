import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Save, Trash2, GripVertical } from "lucide-react";
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

type CustomField = Database['public']['Tables']['custom_fields']['Row'];
type CustomFieldInsert = Database['public']['Tables']['custom_fields']['Insert'];
type CustomFieldUpdate = Database['public']['Tables']['custom_fields']['Update'];

export default function CustomFields() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingField, setEditingField] = useState<CustomFieldInsert | CustomFieldUpdate | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const checkAuth = useCallback(async () => {
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
  }, [navigate]);

  const fetchCustomFields = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('custom_fields')
        .select('*')
        .order('field_order', { ascending: true });

      if (error) throw error;
      setCustomFields(data || []);
    } catch (error: unknown) {
      toast.error("Failed to load custom fields");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
    fetchCustomFields();
  }, [checkAuth, fetchCustomFields]);

  const handleCreateField = () => {
    setEditingField({
      field_name: '',
      field_label: '',
      field_type: 'text',
      is_required: false,
      is_visible: true,
      field_options: null,
    });
    setIsCreating(true);
  };

  const handleSaveField = async () => {
    if (!editingField) return;

    if (!editingField.field_name || !editingField.field_label) {
      toast.error("Field name and label are required");
      return;
    }

    setIsSaving(true);
    try {
      // Check if editingField has an ID to determine if it's an update
      const fieldId = (editingField as CustomField).id;

      if (fieldId) {
        const { error } = await supabase
          .from('custom_fields')
          .update({
            field_label: editingField.field_label,
            field_type: editingField.field_type as Database['public']['Enums']['field_type'],
            field_options: editingField.field_options,
            is_required: editingField.is_required,
            is_visible: editingField.is_visible,
          })
          .eq('id', fieldId);

        if (error) throw error;
        toast.success("Field updated successfully!");
      } else {
        const { error } = await supabase
          .from('custom_fields')
          .insert([{
            field_name: editingField.field_name!,
            field_label: editingField.field_label!,
            field_type: editingField.field_type as Database['public']['Enums']['field_type'],
            field_options: editingField.field_options,
            is_required: editingField.is_required,
            is_visible: editingField.is_visible,
            field_order: customFields.length,
            created_by: user?.id,
          }]);

        if (error) throw error;
        toast.success("Field created successfully!");
      }

      setEditingField(null);
      setIsCreating(false);
      fetchCustomFields();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to save field: " + errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    try {
      const { error } = await supabase
        .from('custom_fields')
        .delete()
        .eq('id', fieldId);

      if (error) throw error;
      toast.success("Field deleted successfully!");
      fetchCustomFields();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to delete field: " + errorMessage);
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
            <Button onClick={handleCreateField}>
              <Plus className="w-4 h-4 mr-2" />
              Add Custom Field
            </Button>
          )}
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Custom Fields</h1>
          <p className="text-muted-foreground">
            Manage custom fields that can be added to signage spots
          </p>
        </div>

        {editingField && (
          <Card className="mb-6 border-primary">
            <CardHeader>
              <CardTitle>{isCreating ? "Create New Field" : "Edit Field"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Field Name</Label>
                  <Input
                    value={editingField.field_name}
                    onChange={(e) => setEditingField({ ...editingField, field_name: e.target.value })}
                    placeholder="installation_cost"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Field Label</Label>
                  <Input
                    value={editingField.field_label}
                    onChange={(e) => setEditingField({ ...editingField, field_label: e.target.value })}
                    placeholder="Installation Cost"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Field Type</Label>
                  <Select
                    value={editingField.field_type}
                    onValueChange={(value) => setEditingField({ ...editingField, field_type: value as Database['public']['Enums']['field_type'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="textarea">Text Area</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="dropdown">Dropdown</SelectItem>
                      <SelectItem value="checkbox">Checkbox</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingField.is_required}
                    onCheckedChange={(checked) => setEditingField({ ...editingField, is_required: checked })}
                  />
                  <Label>Required</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingField.is_visible}
                    onCheckedChange={(checked) => setEditingField({ ...editingField, is_visible: checked })}
                  />
                  <Label>Visible</Label>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingField(null);
                    setIsCreating(false);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveField} disabled={isSaving}>
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {customFields.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">No custom fields yet</p>
                {canEdit && (
                  <Button onClick={handleCreateField}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Field
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            customFields.map((field) => (
              <Card key={field.id}>
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <GripVertical className="w-4 h-4 text-muted-foreground" />

                    <div className="flex-1">
                      <h3 className="font-semibold">{field.field_label}</h3>
                      <p className="text-sm text-muted-foreground">
                        {field.field_type} {field.is_required && '• Required'}
                      </p>
                    </div>

                    {canEdit && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingField(field)}
                        >
                          Edit
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Field?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will delete "{field.field_label}" permanently.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteField(field.id!)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {!canEdit && (
          <p className="text-sm text-muted-foreground text-center mt-6">
            Only admins can manage custom fields
          </p>
        )}
      </div>
    </div>
  );
}

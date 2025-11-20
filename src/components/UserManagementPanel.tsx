import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UserPlus, Edit2, Ban, CheckCircle, Mail, Info, Shield, Users as UsersIcon, User } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database['public']['Tables']['profiles']['Row'];
type AppRole = Database['public']['Enums']['app_role'];

interface UserWithRole extends Profile {
  roles: AppRole[];
}

interface UserManagementPanelProps {
  currentUserId: string;
  userRole: string;
}

export function UserManagementPanel({ currentUserId, userRole }: UserManagementPanelProps) {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("staff");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [editRole, setEditRole] = useState<AppRole>("staff");

  const canManage = userRole === 'admin' || userRole === 'manager';

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles for all users
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Combine profiles with their roles
      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => {
        const userRoles = roles?.filter(r => r.user_id === profile.id).map(r => r.role) || [];
        return {
          ...profile,
          roles: userRoles.length > 0 ? userRoles : ['staff']
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManage) {
      fetchUsers();
    }
  }, [canManage, fetchUsers]);

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inviteEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    try {
      // In a real implementation, you would:
      // 1. Send an invite email with a signup link
      // 2. Create a pending invite record
      // For now, we'll show instructions
      
      const inviteUrl = `${window.location.origin}/auth?invite=true&role=${inviteRole}`;
      
      toast.success(
        `Invite link generated! Share this URL with ${inviteEmail}:\n\n${inviteUrl}`,
        { duration: 10000 }
      );

      setInviteEmail("");
      setInviteRole("staff");
      setInviteOpen(false);
    } catch (error) {
      console.error('Error inviting user:', error);
      toast.error('Failed to invite user');
    }
  };

  const handleUpdateRole = async () => {
    if (!editingUser) return;

    try {
      // Delete existing roles
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', editingUser.id);

      // Insert new role
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: editingUser.id,
          role: editRole
        });

      if (error) throw error;

      // Update profile role
      await supabase
        .from('profiles')
        .update({ role: editRole })
        .eq('id', editingUser.id);

      toast.success('User role updated successfully');
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update user role');
    }
  };

  const handleToggleActive = async (user: UserWithRole) => {
    if (user.id === currentUserId) {
      toast.error("You cannot deactivate your own account");
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !user.is_active })
        .eq('id', user.id);

      if (error) throw error;

      toast.success(user.is_active ? 'User suspended' : 'User activated');
      fetchUsers();
    } catch (error) {
      console.error('Error toggling user status:', error);
      toast.error('Failed to update user status');
    }
  };

  const getRoleBadgeColor = (role: AppRole) => {
    switch (role) {
      case 'admin':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'manager':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getRoleIcon = (role: AppRole) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-3 h-3 mr-1" />;
      case 'manager':
        return <UsersIcon className="w-3 h-3 mr-1" />;
      default:
        return <User className="w-3 h-3 mr-1" />;
    }
  };

  const getRoleDescription = (role: AppRole) => {
    switch (role) {
      case 'admin':
        return 'Full system access: manage users, settings, all signage, campaigns, and floor plans';
      case 'manager':
        return 'Elevated access: create/edit campaigns, manage signage, approve changes, and view analytics';
      case 'staff':
        return 'Basic access: view signage, upload images, update assigned spots, and create drafts';
      default:
        return '';
    }
  };

  if (!canManage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            You don't have permission to manage users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Only admins and managers can view and manage users.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading users...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>User Management</CardTitle>
            <CardDescription>
              Manage user accounts, roles, and permissions
            </CardDescription>
          </div>
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="w-4 h-4 mr-2" />
                Invite User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite New User</DialogTitle>
                <DialogDescription>
                  Generate an invite link for a new user
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleInviteUser} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">Staff</span>
                          <span className="text-xs text-muted-foreground">Basic access to assigned signage</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="manager">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">Manager</span>
                          <span className="text-xs text-muted-foreground">Manage campaigns and all signage</span>
                        </div>
                      </SelectItem>
                      {userRole === 'admin' && (
                        <SelectItem value="admin">
                          <div className="flex flex-col items-start">
                            <span className="font-medium">Admin</span>
                            <span className="text-xs text-muted-foreground">Full system access</span>
                          </div>
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {getRoleDescription(inviteRole)}
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    <Mail className="w-4 h-4 mr-2" />
                    Generate Invite
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Role Permissions Overview</AlertTitle>
          <AlertDescription className="space-y-2 mt-2">
            <div className="flex items-start gap-2">
              <Badge className="bg-red-500/10 text-red-500 border-red-500/20 mt-0.5">
                <Shield className="w-3 h-3 mr-1" />
                Admin
              </Badge>
              <span className="text-sm">Full system access including user management, all settings, signage, campaigns, and floor plans</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 mt-0.5">
                <UsersIcon className="w-3 h-3 mr-1" />
                Manager
              </Badge>
              <span className="text-sm">Create/edit campaigns, manage all signage spots, approve changes, and view analytics</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20 mt-0.5">
                <User className="w-3 h-3 mr-1" />
                Staff
              </Badge>
              <span className="text-sm">View signage, upload images for assigned spots, and create drafts for approval</span>
            </div>
          </AlertDescription>
        </Alert>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {user.full_name || 'No name set'}
                  {user.id === currentUserId && (
                    <Badge variant="outline" className="ml-2">You</Badge>
                  )}
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge className={getRoleBadgeColor(user.role)}>
                          {getRoleIcon(user.role)}
                          {user.role}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>{getRoleDescription(user.role)}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell>
                  {user.is_active ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/20">
                      <Ban className="w-3 h-3 mr-1" />
                      Suspended
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(user.created_at!).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Dialog open={editingUser?.id === user.id} onOpenChange={(open) => !open && setEditingUser(null)}>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingUser(user);
                            setEditRole(user.role);
                          }}
                          disabled={user.id === currentUserId && userRole !== 'admin'}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit User Role</DialogTitle>
                          <DialogDescription>
                            Change role for {user.email}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <Alert>
                            <Info className="h-4 w-4" />
                            <AlertDescription className="text-sm">
                              Changing a user's role will immediately update their access permissions across the entire system.
                            </AlertDescription>
                          </Alert>
                          <div className="space-y-2">
                            <Label>Role</Label>
                            <Select value={editRole} onValueChange={(v) => setEditRole(v as AppRole)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="staff">
                                  <div className="flex flex-col items-start">
                                    <span className="font-medium">Staff</span>
                                    <span className="text-xs text-muted-foreground">Basic access to assigned signage</span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="manager">
                                  <div className="flex flex-col items-start">
                                    <span className="font-medium">Manager</span>
                                    <span className="text-xs text-muted-foreground">Manage campaigns and all signage</span>
                                  </div>
                                </SelectItem>
                                {userRole === 'admin' && (
                                  <SelectItem value="admin">
                                    <div className="flex flex-col items-start">
                                      <span className="font-medium">Admin</span>
                                      <span className="text-xs text-muted-foreground">Full system access</span>
                                    </div>
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              {getRoleDescription(editRole)}
                            </p>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setEditingUser(null)}>
                              Cancel
                            </Button>
                            <Button onClick={handleUpdateRole}>
                              Save Changes
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(user)}
                      disabled={user.id === currentUserId}
                    >
                      {user.is_active ? (
                        <Ban className="w-4 h-4 text-destructive" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

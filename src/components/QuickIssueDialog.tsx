import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface User {
  id: string;
  full_name: string | null;
  email: string;
}

interface QuickIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (issueText: string, mentionedUserIds: string[]) => Promise<void>;
  locationName: string;
}

export function QuickIssueDialog({ open, onOpenChange, onSubmit, locationName }: QuickIssueDialogProps) {
  const [issueText, setIssueText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [showUserPicker, setShowUserPicker] = useState(false);

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('is_active', true)
      .order('full_name');
    
    setUsers(data || []);
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async () => {
    if (!issueText.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(issueText, selectedUserIds);
      setIssueText("");
      setSelectedUserIds([]);
      setShowUserPicker(false);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-destructive" />
            Report Issue
          </DialogTitle>
          <DialogDescription>
            Report an issue with <span className="font-semibold">{locationName}</span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <Label>Issue Description</Label>
            <Textarea
              placeholder="Describe the issue (e.g., 'Content is outdated', 'Poster is damaged', 'Wrong campaign displayed')..."
              value={issueText}
              onChange={(e) => setIssueText(e.target.value)}
              rows={4}
              className="resize-none mt-2"
            />
          </div>

          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowUserPicker(!showUserPicker)}
              className="w-full"
            >
              <Users className="w-4 h-4 mr-2" />
              {selectedUserIds.length > 0 
                ? `${selectedUserIds.length} user(s) selected` 
                : 'Notify team members'}
            </Button>

            {showUserPicker && (
              <div className="mt-2 p-3 border rounded-md max-h-48 overflow-y-auto space-y-2">
                <Label className="text-sm text-muted-foreground">
                  Select users to notify via Slack
                </Label>
                {users.map(user => (
                  <div key={user.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={user.id}
                      checked={selectedUserIds.includes(user.id)}
                      onCheckedChange={() => toggleUserSelection(user.id)}
                    />
                    <label
                      htmlFor={user.id}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {user.full_name || user.email}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setIssueText("");
              setSelectedUserIds([]);
              setShowUserPicker(false);
              onOpenChange(false);
            }}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!issueText.trim() || isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Report Issue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

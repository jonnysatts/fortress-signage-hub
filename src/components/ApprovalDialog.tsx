import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

interface ApprovalDialogProps {
  photoId: string;
  signageSpotId: string;
  currentStatus: "pending" | "approved" | "rejected";
  imageUrl: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprovalChange?: () => void;
}

export function ApprovalDialog({
  photoId,
  signageSpotId,
  currentStatus,
  imageUrl,
  open,
  onOpenChange,
  onApprovalChange,
}: ApprovalDialogProps) {
  const [comments, setComments] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApproval = async (newStatus: "approved" | "rejected") => {
    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Update photo approval status
      const { error: photoError } = await supabase
        .from('photo_history')
        .update({ approval_status: newStatus })
        .eq('id', photoId);

      if (photoError) throw photoError;

      // Create approval history record
      const { error: historyError } = await supabase
        .from('approval_history')
        .insert({
          photo_id: photoId,
          signage_spot_id: signageSpotId,
          status: newStatus,
          reviewed_by: user?.id,
          comments: comments.trim() || null,
          previous_status: currentStatus,
        });

      if (historyError) throw historyError;

      toast.success(`Photo ${newStatus}`);
      onOpenChange(false);
      setComments("");
      onApprovalChange?.();
    } catch (error: any) {
      toast.error("Failed to update approval status");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = () => {
    switch (currentStatus) {
      case "approved":
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review Photo</DialogTitle>
          <DialogDescription>
            Approve or reject this photo submission
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Current Status:</span>
            {getStatusBadge()}
          </div>

          <div className="rounded-lg overflow-hidden border">
            <img src={imageUrl} alt="Review" className="w-full h-auto" />
          </div>

          <div>
            <Label htmlFor="comments">Comments (optional)</Label>
            <Textarea
              id="comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Add any feedback or notes..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => handleApproval("rejected")}
            disabled={isProcessing}
          >
            <XCircle className="w-4 h-4 mr-2" />
            Reject
          </Button>
          <Button
            onClick={() => handleApproval("approved")}
            disabled={isProcessing}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

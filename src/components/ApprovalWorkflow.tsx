import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ApprovalWorkflowProps {
  photoId: string;
  imageUrl: string;
  caption?: string;
  scheduledDate?: string;
  onApproved: () => void;
  onRejected: () => void;
}

export function ApprovalWorkflow({
  photoId,
  imageUrl,
  caption,
  scheduledDate,
  onApproved,
  onRejected,
}: ApprovalWorkflowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [comments, setComments] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error: updateError } = await supabase
        .from("photo_history")
        .update({ approval_status: "approved" })
        .eq("id", photoId);

      if (updateError) throw updateError;

      await supabase.from("approval_history").insert({
        photo_id: photoId,
        status: "approved",
        reviewed_by: user?.id,
        comments: comments || null,
      });

      toast.success("Image approved successfully");
      setIsOpen(false);
      onApproved();
    } catch (error) {
      console.error("Approval error:", error);
      toast.error("Failed to approve image");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error: updateError } = await supabase
        .from("photo_history")
        .update({ approval_status: "rejected" })
        .eq("id", photoId);

      if (updateError) throw updateError;

      await supabase.from("approval_history").insert({
        photo_id: photoId,
        status: "rejected",
        reviewed_by: user?.id,
        comments: comments,
      });

      toast.success("Image rejected");
      setIsOpen(false);
      onRejected();
    } catch (error) {
      console.error("Rejection error:", error);
      toast.error("Failed to reject image");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        <MessageSquare className="h-3 w-3 mr-1" />
        Review
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Planned Image</DialogTitle>
            <DialogDescription>
              {scheduledDate && `Scheduled for ${new Date(scheduledDate).toLocaleDateString()}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted rounded-lg overflow-hidden">
              <img
                src={imageUrl}
                alt="Image for review"
                className="w-full max-h-96 object-contain"
              />
            </div>

            {caption && (
              <div>
                <p className="text-sm font-semibold">Caption:</p>
                <p className="text-sm text-muted-foreground">{caption}</p>
              </div>
            )}

            <div>
              <label className="text-sm font-semibold">Comments (optional):</label>
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Add feedback or notes..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isProcessing}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button
              onClick={handleApprove}
              disabled={isProcessing}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

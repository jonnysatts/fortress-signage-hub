import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle } from "lucide-react";

interface QuickIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (issueText: string) => Promise<void>;
  locationName: string;
}

export function QuickIssueDialog({ open, onOpenChange, onSubmit, locationName }: QuickIssueDialogProps) {
  const [issueText, setIssueText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!issueText.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(issueText);
      setIssueText("");
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
          <Textarea
            placeholder="Describe the issue (e.g., 'Content is outdated', 'Poster is damaged', 'Wrong campaign displayed')..."
            value={issueText}
            onChange={(e) => setIssueText(e.target.value)}
            rows={4}
            className="resize-none"
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setIssueText("");
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

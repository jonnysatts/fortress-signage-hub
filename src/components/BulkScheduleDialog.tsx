import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface BulkScheduleDialogProps {
  selectedSpotIds: string[];
  onSuccess: () => void;
}

export function BulkScheduleDialog({ selectedSpotIds, onSuccess }: BulkScheduleDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [autoPromote, setAutoPromote] = useState(true);
  const [caption, setCaption] = useState("");
  const [printRequired, setPrintRequired] = useState(false);
  const [printVendor, setPrintVendor] = useState("");
  const [printDueDate, setPrintDueDate] = useState("");
  const [printNotes, setPrintNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleBulkUpload = async () => {
    if (!selectedFile || selectedSpotIds.length === 0) {
      toast.error("Please select an image and spots");
      return;
    }

    setIsUploading(true);
    const batchId = crypto.randomUUID();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload image once to storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `bulk-${batchId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('signage')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('signage')
        .getPublicUrl(fileName);

      // Create photo history entries for each selected spot
      const photoEntries = selectedSpotIds.map(spotId => ({
        signage_spot_id: spotId,
        image_url: publicUrl,
        image_type: 'planned' as const,
        caption: caption || null,
        uploaded_by: user.id,
        scheduled_date: scheduledDate || null,
        auto_promote: autoPromote,
        print_status: printRequired ? 'pending' as const : 'not_required' as const,
        print_vendor: printRequired ? printVendor : null,
        print_due_date: printRequired ? printDueDate : null,
        print_notes: printRequired ? printNotes : null,
        campaign_batch_id: batchId,
      }));

      const { error: historyError } = await supabase
        .from('photo_history')
        .insert(photoEntries);

      if (historyError) throw historyError;

      toast.success(`Successfully scheduled ${selectedSpotIds.length} signage spot(s)`);
      setIsOpen(false);
      onSuccess();
      
      // Reset form
      setSelectedFile(null);
      setCaption("");
      setScheduledDate("");
      setAutoPromote(true);
      setPrintRequired(false);
    } catch (error: any) {
      toast.error("Failed to bulk schedule: " + error.message);
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="h-4 w-4 mr-2" />
          Bulk Schedule ({selectedSpotIds.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Schedule Planned Image</DialogTitle>
          <DialogDescription>
            Upload one image and schedule it across {selectedSpotIds.length} selected spot{selectedSpotIds.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select Image File</Label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={isUploading}
              className="block w-full text-sm text-muted-foreground
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-primary file:text-primary-foreground
                hover:file:bg-primary/90"
            />
            {selectedFile && (
              <p className="text-xs text-muted-foreground">
                Selected: {selectedFile.name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulkCaption">Caption (Optional)</Label>
            <Textarea
              id="bulkCaption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a description..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulkScheduledDate">Go Live Date (Optional)</Label>
            <Input
              id="bulkScheduledDate"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="bulkAutoPromote"
              checked={autoPromote}
              onCheckedChange={(checked) => setAutoPromote(checked as boolean)}
            />
            <Label htmlFor="bulkAutoPromote" className="text-sm font-normal">
              Auto-promote on scheduled date
            </Label>
          </div>

          <Separator />

          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <Label>Print Job Required?</Label>
              <Switch
                checked={printRequired}
                onCheckedChange={setPrintRequired}
              />
            </div>

            {printRequired && (
              <>
                <div className="space-y-2">
                  <Label>Print Vendor</Label>
                  <Select value={printVendor} onValueChange={setPrintVendor}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Senpais">Senpais</SelectItem>
                      <SelectItem value="VistaPrint">VistaPrint</SelectItem>
                      <SelectItem value="Local Print Shop">Local Print Shop</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Print Due Date</Label>
                  <Input
                    type="date"
                    value={printDueDate}
                    onChange={(e) => setPrintDueDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Print Notes</Label>
                  <Textarea
                    value={printNotes}
                    onChange={(e) => setPrintNotes(e.target.value)}
                    placeholder="Size, material, special requirements..."
                    rows={2}
                  />
                </div>
              </>
            )}
          </div>

          <Button
            onClick={handleBulkUpload}
            disabled={isUploading || !selectedFile}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              `Schedule ${selectedSpotIds.length} Spot${selectedSpotIds.length !== 1 ? 's' : ''}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

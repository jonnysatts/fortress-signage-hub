import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { X, Save } from 'lucide-react';
import FloorPlanEditorV2 from '@/pages/FloorPlanEditorV2';

interface FloorPlanEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  floorPlanId: string;
  spotId: string;
  spotName: string;
}

export default function FloorPlanEditorSheet({
  open,
  onOpenChange,
  floorPlanId,
  spotId,
  spotName
}: FloorPlanEditorSheetProps) {
  const [hasChanges, setHasChanges] = useState(false);

  // Reset state when sheet closes
  useEffect(() => {
    if (!open) {
      setHasChanges(false);
    }
  }, [open]);

  const handleClose = () => {
    if (hasChanges) {
      const confirm = window.confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirm) return;
    }
    onOpenChange(false);
  };

  const handleSaveAndClose = () => {
    // The editor auto-saves on changes, so we just close
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-full sm:max-w-full p-0 flex flex-col"
        onInteractOutside={(e) => {
          // Prevent closing when clicking outside if there are changes
          if (hasChanges) {
            e.preventDefault();
          }
        }}
      >
        <SheetHeader className="px-6 py-4 border-b flex flex-row items-center justify-between space-y-0">
          <SheetTitle>Edit Floor Plan Position: {spotName}</SheetTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClose}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveAndClose}
            >
              <Save className="w-4 h-4 mr-2" />
              Save & Close
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-hidden">
          <FloorPlanEditorV2
            embeddedMode={true}
            floorPlanId={floorPlanId}
            highlightMarkerId={spotId}
            onHasChanges={setHasChanges}
            onRequestClose={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

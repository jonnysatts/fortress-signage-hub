import { Card } from "@/components/ui/card";
import { getMarkerStatus } from "@/utils/markerUtils";

interface Marker {
  id: string;
  location_name: string;
  status: string;
  expiry_date: string | null;
  next_planned_date: string | null;
}

interface MarkerTooltipProps {
  marker: Marker;
  position: { x: number; y: number };
}

export default function MarkerTooltip({ marker, position }: MarkerTooltipProps) {
  const markerStatus = getMarkerStatus(marker);
  
  const statusLabels = {
    current: 'Current',
    expiring: 'Expiring Soon',
    overdue: 'Overdue',
    empty: 'Empty',
    scheduled: 'Scheduled'
  };

  return (
    <Card 
      className="fixed z-50 p-3 shadow-lg pointer-events-none"
      style={{
        left: position.x + 10,
        top: position.y + 10
      }}
    >
      <div className="space-y-1">
        <div className="font-semibold">{marker.location_name}</div>
        <div className="text-sm text-muted-foreground">
          Status: {statusLabels[markerStatus]}
        </div>
      </div>
    </Card>
  );
}

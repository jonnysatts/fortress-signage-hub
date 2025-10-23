// Status color mapping for markers
export const STATUS_COLORS = {
  current: 'hsl(var(--success))',
  expiring: 'hsl(var(--warning))',
  overdue: 'hsl(var(--destructive))',
  empty: 'hsl(var(--muted-foreground))',
  scheduled: 'hsl(var(--primary))'
} as const;

export type MarkerStatus = keyof typeof STATUS_COLORS;

interface SignageSpot {
  status: string;
  expiry_date: string | null;
  next_planned_date: string | null;
}

// Calculate marker color based on spot status
export function getMarkerColor(spot: SignageSpot): string {
  if (spot.status === 'empty') return STATUS_COLORS.empty;
  
  // Check for scheduled future content
  if (spot.next_planned_date) {
    const scheduledDate = new Date(spot.next_planned_date);
    if (scheduledDate > new Date()) {
      return STATUS_COLORS.scheduled;
    }
  }
  
  // Check if overdue
  if (spot.expiry_date) {
    const expiryDate = new Date(spot.expiry_date);
    if (expiryDate < new Date()) {
      return STATUS_COLORS.overdue;
    }
    
    // Check if expiring soon (within 7 days)
    const daysUntilExpiry = Math.floor(
      (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilExpiry >= 0 && daysUntilExpiry <= 7) {
      return STATUS_COLORS.expiring;
    }
  }
  
  return STATUS_COLORS.current;
}

// Get marker status label
export function getMarkerStatus(spot: SignageSpot): MarkerStatus {
  if (spot.status === 'empty') return 'empty';
  
  if (spot.next_planned_date) {
    const scheduledDate = new Date(spot.next_planned_date);
    if (scheduledDate > new Date()) {
      return 'scheduled';
    }
  }
  
  if (spot.expiry_date) {
    const expiryDate = new Date(spot.expiry_date);
    if (expiryDate < new Date()) {
      return 'overdue';
    }
    
    const daysUntilExpiry = Math.floor(
      (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilExpiry >= 0 && daysUntilExpiry <= 7) {
      return 'expiring';
    }
  }
  
  return 'current';
}

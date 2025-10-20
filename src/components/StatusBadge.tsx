import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertCircle, Circle, Calendar } from "lucide-react";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const statusConfig = {
    current: {
      label: "Current",
      icon: CheckCircle2,
      className: "bg-status-current/10 text-status-current border-status-current/20",
    },
    expiring_soon: {
      label: "Expiring Soon",
      icon: Clock,
      className: "bg-status-expiring/10 text-status-expiring border-status-expiring/20",
    },
    overdue: {
      label: "Overdue",
      icon: AlertCircle,
      className: "bg-status-overdue/10 text-status-overdue border-status-overdue/20",
    },
    empty: {
      label: "Empty",
      icon: Circle,
      className: "bg-status-empty/10 text-status-empty border-status-empty/20",
    },
    planned: {
      label: "Planned",
      icon: Calendar,
      className: "bg-status-planned/10 text-status-planned border-status-planned/20",
    },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.empty;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`${config.className} ${className}`}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
}

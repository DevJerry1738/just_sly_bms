import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type BusinessStatus =
  | "active"
  | "inactive"
  | "pending"
  | "draft"
  | "cancelled"
  | "delivered"
  | "processing"
  | "approved"
  | "rejected"
  | "low-stock"
  | "out-of-stock"
  | "success"
  | "warning";

interface StatusBadgeProps {
  status: BusinessStatus | string;
  label?: string;
  dot?: boolean;
  className?: string;
}

const CONFIG: Record<string, { variant: "success" | "warning" | "danger" | "info" | "muted" | "secondary" | "outline"; label: string }> = {
  active: { variant: "success", label: "Active" },
  inactive: { variant: "muted", label: "Inactive" },
  pending: { variant: "warning", label: "Pending" },
  draft: { variant: "secondary", label: "Draft" },
  cancelled: { variant: "muted", label: "Cancelled" },
  delivered: { variant: "success", label: "Delivered" },
  processing: { variant: "info", label: "Processing" },
  approved: { variant: "success", label: "Approved" },
  rejected: { variant: "danger", label: "Rejected" },
  "low-stock": { variant: "warning", label: "Low Stock" },
  "out-of-stock": { variant: "danger", label: "Out of Stock" },
  success: { variant: "success", label: "Success" },
  warning: { variant: "warning", label: "Warning" },
};

export function StatusBadge({ status, label, dot = true, className }: StatusBadgeProps) {
  const key = status.toLowerCase();
  const config = CONFIG[key] ?? { variant: "secondary", label: label ?? status };
  const displayLabel = label ?? config.label;

  return (
    <Badge
      variant={config.variant}
      size="sm"
      dot={dot}
      className={cn("capitalize font-medium", className)}
    >
      {displayLabel}
    </Badge>
  );
}

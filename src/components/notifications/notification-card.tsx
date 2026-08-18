import type { NotificationsSchema } from "@/database/schema";
import { formatDistanceToNow } from "date-fns";
import {
  Package,
  CreditCard,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Truck,
  AlertCircle,
  ArrowRightLeft,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationCardProps {
  notification: NotificationsSchema;
  onRead?: (id: string) => void;
  onClick?: (notification: NotificationsSchema) => void;
  compact?: boolean;
}

export function NotificationCard({ notification, onRead, onClick, compact = false }: NotificationCardProps) {
  const getIcon = () => {
    switch (notification.type) {
      case "payment_submitted":
      case "payment_receipt_submitted":
        return <CreditCard className="size-4 text-blue-400 shrink-0" />;
      case "payment_confirmed":
      case "order_delivered":
        return <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />;
      case "payment_rejected":
      case "order_cancelled":
      case "expired_stock":
        return <XCircle className="size-4 text-red-400 shrink-0" />;
      case "low_stock":
      case "expiry_warning":
        return <AlertTriangle className="size-4 text-amber-400 shrink-0" />;
      case "order_dispatched":
        return <Truck className="size-4 text-cyan-400 shrink-0" />;
      case "branch_transfer_created":
      case "branch_transfer_accepted":
      case "branch_transfer_rejected":
        return <ArrowRightLeft className="size-4 text-purple-400 shrink-0" />;
      default:
        return <Info className="size-4 text-indigo-400 shrink-0" />;
    }
  };

  const getPriorityBadge = () => {
    if (notification.priority === "critical") {
      return <span className="size-2 rounded-full bg-red-500 animate-pulse shrink-0" />;
    }
    if (notification.priority === "important") {
      return <span className="size-2 rounded-full bg-amber-500 shrink-0" />;
    }
    return null;
  };

  const handleClick = () => {
    if (!notification.read && onRead) {
      onRead(notification.id);
    }
    if (onClick) {
      onClick(notification);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "group relative flex items-start gap-3 rounded-lg border p-3 transition-colors cursor-pointer text-left",
        notification.read
          ? "bg-muted/40 border-border/60 text-muted-foreground hover:bg-muted/60"
          : "bg-card border-primary/30 text-card-foreground hover:bg-accent/50 shadow-sm"
      )}
    >
      <div className="mt-0.5">{getIcon()}</div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {!notification.read && <span className="size-2 rounded-full bg-primary shrink-0" />}
            {getPriorityBadge()}
            <p className={cn("text-xs font-semibold truncate", !notification.read ? "text-foreground font-bold" : "text-muted-foreground")}>
              {notification.title}
            </p>
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-1">
            <Clock className="size-3" />
            {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
          </span>
        </div>

        <p className={cn("text-xs text-muted-foreground mt-1 line-clamp-2", compact && "line-clamp-1")}>
          {notification.message}
        </p>
      </div>
    </div>
  );
}

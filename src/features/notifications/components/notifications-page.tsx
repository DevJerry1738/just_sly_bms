import { Bell } from "lucide-react";

import { ModulePlaceholder } from "@/components/common/module-placeholder";

export function NotificationsPage() {
  return (
    <ModulePlaceholder
      title="Notifications"
      description="In-app alerts plus future email and WhatsApp delivery channels."
      icon={Bell}
      capabilities={["In-app notification centre", "Low-stock alerts", "Order status updates", "Email via Resend", "WhatsApp delivery", "Per-user preferences"]}
    />
  );
}

import { Truck } from "lucide-react";

import { ModulePlaceholder } from "@/components/common/module-placeholder";

export function WholesaleOrdersPage() {
  return (
    <ModulePlaceholder
      title="Wholesale Orders"
      description="B2B ordering workflow from quotation through fulfilment and settlement."
      icon={Truck}
      capabilities={["Order intake & approval", "Quotations", "Credit limits", "Fulfilment & dispatch", "WhatsApp order capture", "Settlement tracking"]}
    />
  );
}

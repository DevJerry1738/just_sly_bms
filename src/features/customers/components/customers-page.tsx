import { Users } from "lucide-react";

import { ModulePlaceholder } from "@/components/common/module-placeholder";

export function CustomersPage() {
  return (
    <ModulePlaceholder
      title="Customers"
      description="Unified retail and wholesale customer records with contact and credit history."
      icon={Users}
      capabilities={["Customer directory", "Wholesale accounts", "Contact channels", "Order history", "Credit & balances", "Segmentation"]}
    />
  );
}

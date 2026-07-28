import { Boxes } from "lucide-react";

import { ModulePlaceholder } from "@/components/common/module-placeholder";

export function InventoryPage() {
  return (
    <ModulePlaceholder
      title="Inventory"
      description="Real-time stock levels, movements and transfers across all branches."
      icon={Boxes}
      capabilities={["Stock levels per branch", "Stock movements ledger", "Inter-branch transfers", "Reorder thresholds", "Stock counts & adjustments", "Low-stock alerts"]}
    />
  );
}

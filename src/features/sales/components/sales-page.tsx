import { ShoppingCart } from "lucide-react";

import { ModulePlaceholder } from "@/components/common/module-placeholder";

export function SalesPage() {
  return (
    <ModulePlaceholder
      title="Sales"
      description="Retail transactions, receipts, returns and cashier reconciliation."
      icon={ShoppingCart}
      capabilities={["Point of sale", "Receipts & invoices", "Returns and refunds", "Discounts & promotions", "Shift reconciliation", "Payment methods"]}
    />
  );
}

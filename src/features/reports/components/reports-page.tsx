import { FileBarChart } from "lucide-react";

import { ModulePlaceholder } from "@/components/common/module-placeholder";

export function ReportsPage() {
  return (
    <ModulePlaceholder
      title="Reports"
      description="Operational and financial reporting with scheduled exports."
      icon={FileBarChart}
      capabilities={["Sales reports", "Stock valuation", "Profit & margin", "Branch comparison", "Scheduled email delivery", "Excel / PDF export"]}
    />
  );
}

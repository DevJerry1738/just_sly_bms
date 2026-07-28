import { LineChart } from "lucide-react";

import { ModulePlaceholder } from "@/components/common/module-placeholder";

export function AnalyticsPage() {
  return (
    <ModulePlaceholder
      title="Analytics"
      description="Trends, forecasting and branch benchmarking across the business."
      icon={LineChart}
      capabilities={["Revenue trends", "Product performance", "Stock velocity", "Customer cohorts", "Forecasting", "Custom dashboards"]}
    />
  );
}

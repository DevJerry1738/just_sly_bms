import { Building2 } from "lucide-react";

import { ModulePlaceholder } from "@/components/common/module-placeholder";

export function BranchesPage() {
  return (
    <ModulePlaceholder
      title="Branches"
      description="Register, configure and monitor every Just Sly branch, warehouse and point of sale."
      icon={Building2}
      capabilities={["Branch registry & hierarchy", "Staff assignment", "Per-branch settings", "Opening hours", "Branch performance", "Transfer routing"]}
    />
  );
}

import { ScrollText } from "lucide-react";

import { ModulePlaceholder } from "@/components/common/module-placeholder";

export function AuditLogsPage() {
  return (
    <ModulePlaceholder
      title="Audit Logs"
      description="Immutable record of privileged actions across the suite."
      icon={ScrollText}
      capabilities={["Action timeline", "Actor & IP capture", "Entity diffing", "Filter by module", "Retention policy", "CSV export"]}
    />
  );
}

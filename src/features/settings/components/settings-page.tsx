import { Settings } from "lucide-react";

import { ModulePlaceholder } from "@/components/common/module-placeholder";

export function SettingsPage() {
  return (
    <ModulePlaceholder
      title="Settings"
      description="Organisation profile, tax, currency and integration configuration."
      icon={Settings}
      capabilities={["Organisation profile", "Currency & tax", "Receipt templates", "Integrations", "Data retention", "Backup & export"]}
    />
  );
}

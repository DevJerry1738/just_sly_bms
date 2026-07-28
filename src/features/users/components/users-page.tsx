import { Shield } from "lucide-react";

import { ModulePlaceholder } from "@/components/common/module-placeholder";

export function UsersPage() {
  return (
    <ModulePlaceholder
      title="Users & Roles"
      description="Manage team members, role assignment and branch-level access."
      icon={Shield}
      capabilities={["Team directory", "Role assignment (RBAC)", "Branch scoping", "Invitations", "Audit trail", "Session management"]}
    />
  );
}

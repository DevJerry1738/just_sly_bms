import { useAuthorization } from "@/hooks/use-authorization";
import { AdminDashboard } from "./admin-dashboard";
import { StaffDashboard } from "./staff-dashboard";

export function DashboardPage() {
  const { isSuperAdmin, isBranchManager } = useAuthorization();

  // Admins and Branch Managers view Admin Overview with multi-branch capabilities.
  // Staff users view the branch-focused operational command center.
  if (isSuperAdmin || isBranchManager) {
    return <AdminDashboard />;
  }

  return <StaffDashboard />;
}

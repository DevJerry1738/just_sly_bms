import { useAuthorization } from "@/hooks/use-authorization";
import { AdminDashboard } from "./admin-dashboard";
import { StaffDashboard } from "./staff-dashboard";

export function DashboardPage() {
  const { isSuperAdmin } = useAuthorization();

  // Only admins receive the multi-branch overview.
  if (isSuperAdmin) {
    return <AdminDashboard />;
  }

  return <StaffDashboard />;
}

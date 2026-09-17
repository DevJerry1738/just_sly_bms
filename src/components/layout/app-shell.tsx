import { useEffect, type ReactNode } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { OfflineBanner } from "@/components/offline/offline-banner";
import { PWAUpdateToast } from "@/components/offline/pwa-update-toast";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SyncScheduler } from "@/services/sync/sync-scheduler";
import { syncReadinessService } from "@/services/sync/sync-readiness.service";
import { useAuth } from "@/providers/auth-provider";
import "@/services/sync/user-profile-sync";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();

  useEffect(() => {
    SyncScheduler.start();
    void syncReadinessService.bootstrapCriticalData(user, profile);
    return () => SyncScheduler.stop();
  }, [user?.id, profile?.branch_id]);

  return (
    <SidebarProvider>
      <div className="flex min-h-dvh w-full overflow-x-clip bg-surface">
        <AppSidebar />
        <SidebarInset className="min-w-0 bg-surface">
          <OfflineBanner />
          <AppTopbar />
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-8 animate-fade-in">{children}</main>
        </SidebarInset>
        <PWAUpdateToast />
      </div>
    </SidebarProvider>
  );
}

import { useEffect, type ReactNode } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { OfflineBanner } from "@/components/offline/offline-banner";
import { PWAUpdateToast } from "@/components/offline/pwa-update-toast";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SyncScheduler } from "@/services/sync/sync-scheduler";

export function AppShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Start background sync scheduler
    SyncScheduler.start();
    return () => SyncScheduler.stop();
  }, []);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-surface">
        <AppSidebar />
        <SidebarInset className="min-w-0 bg-surface">
          <OfflineBanner />
          <AppTopbar />
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8 animate-fade-in">{children}</main>
        </SidebarInset>
        <PWAUpdateToast />
      </div>
    </SidebarProvider>
  );
}

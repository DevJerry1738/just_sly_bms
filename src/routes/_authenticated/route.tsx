import { createFileRoute, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";

/**
 * Inline page-level error boundary.
 * Replaces only the page content area — keeping the sidebar and header visible —
 * so users can navigate away without a full-page reload.
 */
function PageErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  console.error("[PageError]", error);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-8 text-center">
      <div className="flex items-center justify-center size-14 rounded-full bg-destructive/10 border border-destructive/20">
        <AlertTriangle className="size-7 text-destructive" />
      </div>
      <div className="space-y-2 max-w-sm">
        <h2 className="text-lg font-semibold text-foreground">This page couldn't load</h2>
        <p className="text-sm text-muted-foreground">
          Something went wrong while loading this page. This is usually a temporary issue — try
          refreshing or navigate to another section.
        </p>
        {import.meta.env.DEV && (
          <pre className="mt-3 rounded-md bg-muted p-3 text-left text-[11px] text-destructive overflow-auto max-h-32">
            {error.message}
          </pre>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="default"
          size="sm"
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          <RefreshCw className="size-3.5 mr-1.5" />
          Try again
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href="/">
            <Home className="size-3.5 mr-1.5" />
            Go home
          </a>
        </Button>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.warn("[auth] Unable to restore session for protected route:", error.message);
    }

    if (!session?.user) {
      throw redirect({ to: "/auth" });
    }

    // Wholesale customers must not access the staff dashboard.
    // They are identified by the role stored in their auth user_metadata.
    const role = session.user.user_metadata?.role as string | undefined;
    if (role === "wholesale_customer") {
      throw redirect({ to: "/portal/shop" });
    }

    return { user: session.user };
  },
  errorComponent: PageErrorComponent,
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});

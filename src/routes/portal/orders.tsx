import { createFileRoute, redirect } from "@tanstack/react-router";
import { PortalOrdersPage } from "@/features/portal/components/portal-orders-page";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/portal/orders")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      throw redirect({ to: "/portal/login" });
    }
    const role = session.user.user_metadata?.role as string | undefined;
    if (role !== "wholesale_customer") {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({
    meta: [
      { title: "My Orders — Just Sly Wholesale Portal" },
      { name: "description", content: "Track your wholesale orders and upload payment receipts." },
    ],
  }),
  component: PortalOrdersPage,
});

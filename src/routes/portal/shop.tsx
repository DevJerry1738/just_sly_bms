import { createFileRoute, redirect } from "@tanstack/react-router";
import { PortalShopPage } from "@/features/portal/components/portal-shop-page";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/portal/shop")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      throw redirect({ to: "/portal/login" });
    }
    const role = session.user.user_metadata?.role as string | undefined;
    if (role !== "wholesale_customer") {
      // Staff accidentally navigating here — send back to dashboard
      throw redirect({ to: "/" });
    }
  },
  head: () => ({
    meta: [
      { title: "Wholesale Catalogue — Just Sly Portal" },
      { name: "description", content: "Browse wholesale products and place your order." },
    ],
  }),
  component: PortalShopPage,
});

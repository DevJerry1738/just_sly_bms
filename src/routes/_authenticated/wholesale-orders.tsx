import { createFileRoute } from "@tanstack/react-router";

import { WholesaleOrdersPage } from "@/features/wholesale-orders/components/wholesale-orders-page";

export const Route = createFileRoute("/_authenticated/wholesale-orders")({
  head: () => ({
    meta: [
      { title: "Wholesale Orders — Just Sly Suite" },
      { name: "description", content: "B2B ordering from quotation to fulfilment." },
      { property: "og:title", content: "Wholesale Orders — Just Sly Suite" },
      { property: "og:description", content: "B2B ordering from quotation to fulfilment." },
    ],
  }),
  component: WholesaleOrdersPage,
});

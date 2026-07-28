import { createFileRoute } from "@tanstack/react-router";

import { SalesPage } from "@/features/sales/components/sales-page";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({
    meta: [
      { title: "Sales — Just Sly Suite" },
      { name: "description", content: "Retail transactions, receipts and reconciliation." },
      { property: "og:title", content: "Sales — Just Sly Suite" },
      { property: "og:description", content: "Retail transactions, receipts and reconciliation." },
    ],
  }),
  component: SalesPage,
});

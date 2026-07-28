import { createFileRoute } from "@tanstack/react-router";

import { CustomersPage } from "@/features/customers/components/customers-page";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({
    meta: [
      { title: "Customers — Just Sly Suite" },
      { name: "description", content: "Retail and wholesale customer records." },
      { property: "og:title", content: "Customers — Just Sly Suite" },
      { property: "og:description", content: "Retail and wholesale customer records." },
    ],
  }),
  component: CustomersPage,
});

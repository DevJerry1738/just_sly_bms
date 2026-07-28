import { createFileRoute } from "@tanstack/react-router";

import { InventoryPage } from "@/features/inventory/components/inventory-page";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — Just Sly Suite" },
      { name: "description", content: "Real-time stock levels, movements and transfers." },
      { property: "og:title", content: "Inventory — Just Sly Suite" },
      { property: "og:description", content: "Real-time stock levels, movements and transfers." },
    ],
  }),
  component: InventoryPage,
});

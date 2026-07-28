import { createFileRoute } from "@tanstack/react-router";

import { ProductsPage } from "@/features/products/components/products-page";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({
    meta: [
      { title: "Products — Just Sly Suite" },
      { name: "description", content: "Central product catalogue with variants and pricing tiers." },
      { property: "og:title", content: "Products — Just Sly Suite" },
      { property: "og:description", content: "Central product catalogue with variants and pricing tiers." },
    ],
  }),
  component: ProductsPage,
});

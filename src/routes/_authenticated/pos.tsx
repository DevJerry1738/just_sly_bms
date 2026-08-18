import { createFileRoute } from "@tanstack/react-router";

import { PosPage } from "@/features/pos/pos-page";

export const Route = createFileRoute("/_authenticated/pos")({
  head: () => ({
    meta: [
      { title: "POS — Just Sly Suite" },
      { name: "description", content: "Retail point of sale for quick checkout." },
    ],
  }),
  component: PosPage,
});

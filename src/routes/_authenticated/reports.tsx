import { createFileRoute } from "@tanstack/react-router";

import { ReportsPage } from "@/features/reports/components/reports-page";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Just Sly Suite" },
      { name: "description", content: "Operational and financial reporting with scheduled exports." },
      { property: "og:title", content: "Reports — Just Sly Suite" },
      { property: "og:description", content: "Operational and financial reporting with scheduled exports." },
    ],
  }),
  component: ReportsPage,
});

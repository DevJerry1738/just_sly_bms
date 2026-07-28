import { createFileRoute } from "@tanstack/react-router";

import { BranchesPage } from "@/features/branches/components/branches-page";

export const Route = createFileRoute("/_authenticated/branches")({
  head: () => ({
    meta: [
      { title: "Branches — Just Sly Suite" },
      { name: "description", content: "Register, configure and monitor every Just Sly branch." },
      { property: "og:title", content: "Branches — Just Sly Suite" },
      { property: "og:description", content: "Register, configure and monitor every Just Sly branch." },
    ],
  }),
  component: BranchesPage,
});

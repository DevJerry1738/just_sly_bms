import { createFileRoute } from "@tanstack/react-router";

import { UsersPage } from "@/features/users/components/users-page";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "Users & Roles — Just Sly Suite" },
      { name: "description", content: "Team members, roles and branch access." },
      { property: "og:title", content: "Users & Roles — Just Sly Suite" },
      { property: "og:description", content: "Team members, roles and branch access." },
    ],
  }),
  component: UsersPage,
});

import { createFileRoute } from "@tanstack/react-router";

import { NotificationsPage } from "@/features/notifications/components/notifications-page";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Just Sly Suite" },
      { name: "description", content: "In-app alerts and delivery channels." },
      { property: "og:title", content: "Notifications — Just Sly Suite" },
      { property: "og:description", content: "In-app alerts and delivery channels." },
    ],
  }),
  component: NotificationsPage,
});

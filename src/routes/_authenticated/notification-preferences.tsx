import { createFileRoute } from "@tanstack/react-router";
import { NotificationPreferencesPage } from "@/features/notifications/components/notification-preferences-page";

export const Route = createFileRoute("/_authenticated/notification-preferences")({
  component: NotificationPreferencesPage,
});

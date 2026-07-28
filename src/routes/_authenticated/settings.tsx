import { createFileRoute } from "@tanstack/react-router";

import { SettingsPage } from "@/features/settings/components/settings-page";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Just Sly Suite" },
      { name: "description", content: "Organisation, tax, currency and integrations." },
      { property: "og:title", content: "Settings — Just Sly Suite" },
      { property: "og:description", content: "Organisation, tax, currency and integrations." },
    ],
  }),
  component: SettingsPage,
});

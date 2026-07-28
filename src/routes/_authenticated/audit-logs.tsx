import { createFileRoute } from "@tanstack/react-router";

import { AuditLogsPage } from "@/features/audit-logs/components/audit-logs-page";

export const Route = createFileRoute("/_authenticated/audit-logs")({
  head: () => ({
    meta: [
      { title: "Audit Logs — Just Sly Suite" },
      { name: "description", content: "Immutable record of privileged actions." },
      { property: "og:title", content: "Audit Logs — Just Sly Suite" },
      { property: "og:description", content: "Immutable record of privileged actions." },
    ],
  }),
  component: AuditLogsPage,
});

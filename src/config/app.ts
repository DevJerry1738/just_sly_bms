/**
 * Static application configuration.
 * Keep environment-independent product metadata here.
 */
export const APP_CONFIG = {
  name: "Just Sly",
  shortName: "JS",
  description: "Multi-branch business management suite — inventory, retail, wholesale and analytics.",
  version: "0.1.0",
  supportEmail: "support@justsly.com",
  defaultPageSize: 10,
  pageSizeOptions: [10, 25, 50, 100],
} as const;

export type AppConfig = typeof APP_CONFIG;

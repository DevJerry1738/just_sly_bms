/**
 * Centralised TanStack Query keys.
 * Every feature service must derive its keys from here so cache invalidation
 * stays predictable across modules.
 */
export const queryKeys = {
  auth: {
    profile: (userId: string) => ["auth", "profile", userId] as const,
    roles: (userId: string) => ["auth", "roles", userId] as const,
  },
  branches: {
    all: ["branches"] as const,
    list: (params?: unknown) => ["branches", "list", params ?? null] as const,
    detail: (id: string) => ["branches", "detail", id] as const,
  },
  products: {
    all: ["products"] as const,
    list: (params?: unknown) => ["products", "list", params ?? null] as const,
    detail: (id: string) => ["products", "detail", id] as const,
  },
  inventory: {
    all: ["inventory"] as const,
    list: (params?: unknown) => ["inventory", "list", params ?? null] as const,
  },
  sales: {
    all: ["sales"] as const,
    list: (params?: unknown) => ["sales", "list", params ?? null] as const,
  },
  wholesaleOrders: {
    all: ["wholesale-orders"] as const,
    list: (params?: unknown) => ["wholesale-orders", "list", params ?? null] as const,
  },
  customers: {
    all: ["customers"] as const,
    list: (params?: unknown) => ["customers", "list", params ?? null] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    unreadCount: ["notifications", "unread-count"] as const,
  },
  auditLogs: {
    all: ["audit-logs"] as const,
    list: (params?: unknown) => ["audit-logs", "list", params ?? null] as const,
  },
} as const;

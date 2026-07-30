import {
  LayoutDashboard,
  Building2,
  Package,
  Boxes,
  ShoppingCart,
  Truck,
  Users,
  FileBarChart,
  LineChart,
  Bell,
  ScrollText,
  Settings,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import type { AppRole } from "@/types/auth";

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Roles allowed to see the item. Empty = everyone signed in (RBAC lands in a later sprint). */
  roles?: AppRole[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAVIGATION: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Analytics", url: "/analytics", icon: LineChart },
      { title: "Reports", url: "/reports", icon: FileBarChart },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Branches", url: "/branches", icon: Building2 },
      { title: "Products", url: "/products", icon: Package },
      { title: "Inventory", url: "/inventory", icon: Boxes },
    ],
  },
  {
    label: "Commerce",
    items: [
      { title: "Sales", url: "/sales", icon: ShoppingCart },
      { title: "Wholesale Orders", url: "/wholesale-orders", icon: Truck },
      { title: "Customers", url: "/customers", icon: Users },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Notifications", url: "/notifications", icon: Bell },
      { title: "Audit Logs", url: "/audit-logs", icon: ScrollText, roles: ["admin"] },
      { title: "Profile", url: "/profile", icon: UserRound },
      { title: "Settings", url: "/settings", icon: Settings },
    ],
  },
];

/** Flat lookup used by breadcrumbs and page titles. */
export const NAV_LOOKUP: Record<string, string> = Object.fromEntries(
  NAVIGATION.flatMap((group) => group.items.map((item) => [item.url, item.title])),
);

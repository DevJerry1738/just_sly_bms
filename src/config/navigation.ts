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
  MonitorPlay,
  type LucideIcon,
} from "lucide-react";

import type { AppRole } from "@/types/auth";

import { type Permission } from "@/types/rbac";

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Optional RBAC permission required to see the item. */
  requiredPermission?: Permission;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAVIGATION: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard, requiredPermission: "dashboard:view" },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "POS", url: "/pos", icon: MonitorPlay, requiredPermission: "sales:create" },
      { title: "Wholesale Orders", url: "/wholesale-orders", icon: Truck, requiredPermission: "sales:view" },
      { title: "Sales History", url: "/sales", icon: ShoppingCart, requiredPermission: "sales:view" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { title: "Products", url: "/products", icon: Package, requiredPermission: "products:view" },
      { title: "Inventory", url: "/inventory", icon: Boxes, requiredPermission: "inventory:view" },
    ],
  },
  {
    label: "Customers",
    items: [
      { title: "Customers", url: "/customers", icon: Users, requiredPermission: "customers:view" },
    ],
  },
  {
    label: "Business",
    items: [
      { title: "Branches", url: "/branches", icon: Building2, requiredPermission: "branches:view" },
      { title: "Staff", url: "/users", icon: UserRound, requiredPermission: "staff:view" },
      { title: "Reports & Analytics", url: "/analytics", icon: LineChart, requiredPermission: "reports:view" },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Notifications", url: "/notifications", icon: Bell, requiredPermission: "notifications:view" },
      { title: "Audit Logs", url: "/audit-logs", icon: ScrollText, requiredPermission: "audit_logs:view" },
      { title: "Settings", url: "/settings", icon: Settings, requiredPermission: "settings:view" },
      { title: "My Profile", url: "/profile", icon: UserRound },
    ],
  },
];

/** Flat lookup used by breadcrumbs and page titles. */
export const NAV_LOOKUP: Record<string, string> = Object.fromEntries(
  NAVIGATION.flatMap((group) => group.items.map((item) => [item.url, item.title])),
);

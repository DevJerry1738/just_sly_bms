import { useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck, Filter, Search, ShieldAlert, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationCard } from "@/components/notifications/notification-card";
import type { NotificationsSchema } from "@/database/schema";

export function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();

  const [tab, setTab] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return notifications.filter((item) => {
      const n = item as Record<string, unknown>;
      const nType = String(n.type || "");
      const nTitle = String(n.title || "");
      const nMessage = String(n.message || "");
      const nPriority = String(n.priority || "");

      if (tab === "unread" && item.read) return false;
      if (tab === "orders" && !nType.includes("order") && !nType.includes("payment")) return false;
      if (tab === "inventory" && !nType.includes("stock") && !nType.includes("expiry")) return false;
      if (tab === "transfers" && !nType.includes("transfer")) return false;

      if (search.trim()) {
        const query = search.toLowerCase();
        const matchTitle = nTitle.toLowerCase().includes(query);
        const matchMessage = nMessage.toLowerCase().includes(query);
        if (!matchTitle && !matchMessage) return false;
      }

      if (priorityFilter !== "all" && nPriority !== priorityFilter) return false;

      return true;
    });
  }, [notifications, tab, search, priorityFilter]);

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5 border-border">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Bell className="size-5" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Notifications Center</h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Centralized operational alerts, order status updates, low-stock notifications, and inventory events.
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            onClick={markAllAsRead}
            variant="outline"
            size="sm"
            className="gap-2 shrink-0"
          >
            <CheckCheck className="size-4" />
            Mark all as read
          </Button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v)} className="w-full sm:w-auto">
          <TabsList className="bg-muted border border-border">
            <TabsTrigger value="all">All ({notifications.length})</TabsTrigger>
            <TabsTrigger value="unread">Unread ({unreadCount})</TabsTrigger>
            <TabsTrigger value="orders">Orders & Payments</TabsTrigger>
            <TabsTrigger value="inventory">Inventory & Expiries</TabsTrigger>
            <TabsTrigger value="transfers">Transfers</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2 flex-1 sm:justify-end">
          <div className="relative flex-1 max-w-xs min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notifications…"
              className="pl-8 text-xs bg-background"
            />
          </div>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-32 h-9 text-xs bg-background">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="important">Important</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
          Loading notifications…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-xl bg-muted/20">
          <Bell className="size-10 stroke-[1.5] text-muted-foreground mb-2 opacity-50" />
          <h3 className="text-sm font-semibold text-foreground">No notifications found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mt-1">
            {search || priorityFilter !== "all" || tab !== "all"
              ? "Try adjusting your search or filters."
              : "You're all caught up! Operational alerts will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => (
            <NotificationCard
              key={n.id}
              notification={n}
              onRead={markAsRead}
              onClick={(notification) => {
                if (notification.entityRoute) {
                  navigate({ to: notification.entityRoute as string });
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

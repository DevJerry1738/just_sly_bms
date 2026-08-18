import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationCard } from "./notification-card";

export function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-9 rounded-full text-slate-300 hover:text-white hover:bg-slate-800"
          aria-label="Notifications"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white shadow-md animate-pulse">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 sm:w-96 p-0 bg-popover border-border text-popover-foreground shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold">Notifications</h4>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {unreadCount} unread
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
            >
              <CheckCheck className="size-3.5" />
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="h-[350px] p-3">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
              <Bell className="size-8 stroke-[1.5] mb-2 opacity-40" />
              <p className="text-xs">No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.slice(0, 10).map((n) => (
                <NotificationCard
                  key={n.id}
                  notification={n}
                  compact
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
        </ScrollArea>

        <div className="border-t border-border p-2 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/notifications" })}
            className="w-full text-xs text-primary hover:text-primary/80 gap-1.5"
          >
            View all notifications
            <ExternalLink className="size-3" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

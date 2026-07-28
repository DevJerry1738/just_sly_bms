import { Link } from "@tanstack/react-router";
import { Bell, LogOut, Search, Settings, UserRound } from "lucide-react";

import { useAuth } from "@/providers/auth-provider";
import { AppBreadcrumb } from "@/components/layout/app-breadcrumb";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SyncStatusIndicator } from "@/components/offline/sync-status-indicator";
import { PWAInstallButton } from "@/components/offline/pwa-install-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(name: string | null, email: string | null) {
  const source = name ?? email ?? "?";
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AppTopbar() {
  const { user, roles, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <SidebarTrigger className="size-8" aria-label="Toggle sidebar" />
      <Separator orientation="vertical" className="hidden h-4 sm:block" />
      <div className="hidden min-w-0 flex-1 md:block">
        <AppBreadcrumb />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative hidden lg:block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search suite… (⌘K)"
            aria-label="Search the suite"
            className="h-8 w-56 pl-8 text-xs bg-muted/30 focus:bg-background transition-colors"
          />
        </div>

        <SyncStatusIndicator />
        <PWAInstallButton />

        <Button variant="ghost" size="icon-sm" className="relative" asChild>
          <Link to="/notifications" aria-label="Notifications">
            <Bell className="size-4" />
            <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />
          </Link>
        </Button>

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 gap-2 px-1.5 rounded-full hover:bg-accent" aria-label="Account menu">
              <Avatar className="size-6">
                <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                  {initials(user?.fullName ?? null, user?.email ?? null)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-28 truncate text-xs font-medium sm:inline">
                {user?.fullName ?? user?.email ?? "Account"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="space-y-1 p-3">
              <p className="truncate text-xs font-semibold">{user?.fullName ?? "Signed in"}</p>
              <p className="truncate text-[11px] font-normal text-muted-foreground">{user?.email}</p>
              <div className="flex flex-wrap gap-1 pt-1.5">
                {(roles.length ? roles : (["viewer"] as const)).map((role) => (
                  <Badge key={role} variant="secondary" size="sm" className="text-[9px] uppercase tracking-wider font-semibold">
                    {role}
                  </Badge>
                ))}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings" className="gap-2 text-xs">
                <UserRound className="size-3.5" /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings" className="gap-2 text-xs">
                <Settings className="size-3.5" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void signOut()} className="gap-2 text-xs text-destructive focus:text-destructive">
              <LogOut className="size-3.5" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

import { Link, useRouterState } from "@tanstack/react-router";

import { NAVIGATION } from "@/config/navigation";
import { APP_CONFIG } from "@/config/app";
import { useAuth } from "@/providers/auth-provider";
import logoNoBg from "@/assets/logo_no_bg.webp";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { hasAnyRole, roles } = useAuth();

  const isActive = (url: string) => (url === "/" ? pathname === "/" : pathname.startsWith(url));
  const canSee = (allowed?: string[]) =>
    !allowed?.length || roles.length === 0 || hasAnyRole(allowed as never);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="h-16 justify-center px-3 border-b border-sidebar-border/50">
        <Link to="/" className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 transition-colors hover:bg-sidebar-accent/50">
          <img src={logoNoBg} alt={APP_CONFIG.name} className="size-8 shrink-0 object-contain" />
          {!collapsed && (
            <span className="flex flex-col leading-tight">
              <span className="font-semibold text-sm tracking-tight text-sidebar-foreground">{APP_CONFIG.name}</span>
              <span className="text-[11px] text-muted-foreground font-normal">Business Suite</span>
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-2 px-2 py-3 scrollbar-thin">
        {NAVIGATION.map((group) => {
          const items = group.items.filter((item) => canSee(item.roles));
          if (!items.length) return null;
          return (
            <SidebarGroup key={group.label} className="px-1 py-1">
              {!collapsed && (
                <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  {group.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    const active = isActive(item.url);
                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.title}
                          className={active ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground/80 hover:text-sidebar-foreground"}
                        >
                          <Link to={item.url} className="flex items-center gap-2.5 px-2.5 py-1.5">
                            <item.icon className="size-4 shrink-0" />
                            <span className="truncate text-xs sm:text-sm">{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="px-3 py-3 border-t border-sidebar-border/50">
        {!collapsed && (
          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
            <span>v{APP_CONFIG.version}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium">
              Enterprise
            </span>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

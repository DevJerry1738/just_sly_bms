import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { staffRepository } from "@/repositories/staff.repository";
import { DomainEvents } from "@/services/events/domain-events";
import type { AppRole, AuthState, Profile } from "@/types/auth";

const AuthContext = createContext<AuthState | null>(null);

/**
 * Session + identity context. Route protection itself lives in the
 * `_authenticated` layout; this provider only exposes user, profile and roles
 * to the UI layer.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setIsLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);

      if (event === "SIGNED_IN" && next?.user) {
        DomainEvents.publish("LOGIN_SUCCESS", {
          userId: next.user.id,
          userName: next.user.email || "User",
          description: `User ${next.user.email} logged in successfully`,
        }, { userId: next.user.id });
      } else if (event === "SIGNED_OUT") {
        DomainEvents.publish("LOGOUT", {
          description: "User logged out",
        });
      }

      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [router, queryClient]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setProfile(null);
      setRoles([]);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const [profileRes, rolesRes] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", userId),
        ]);
        if (!active) return;
        setProfile((profileRes.data as Profile | null) ?? null);

        const normalizeRole = (role: unknown): AppRole | undefined => {
          switch (role) {
            case "admin":
            case "super_admin":
            case "role-super-admin":
              return "admin";
            case "manager":
            case "branch_manager":
            case "role-branch-manager":
              return "manager";
            case "staff":
            case "sales_staff":
            case "inventory_staff":
            case "role-sales-staff":
            case "role-inventory-staff":
              return "staff";
            case "viewer":
              return "viewer";
            default:
              return undefined;
          }
        };

        let fetchedRoles = ((rolesRes.data ?? []) as { role: unknown }[])
          .map((roleRow) => normalizeRole(roleRow.role))
          .filter((role): role is AppRole => Boolean(role));
        
        // Auth roles are canonical. Staff metadata is only a fallback for legacy accounts.
        const metaRole = normalizeRole(session?.user?.user_metadata?.role);
        let staffRecord =
          (await staffRepository.getByAuthUserId(userId)) ||
          (session?.user?.email ? await staffRepository.getByEmail(session.user.email) : undefined);

        if (!staffRecord && typeof navigator !== "undefined" && navigator.onLine) {
          try {
            const { data: remoteStaff } = await (supabase as any)
              .from("staff")
              .select("role")
              .or(`auth_user_id.eq.${userId},email.eq.${session?.user?.email || ""}`)
              .maybeSingle();
            if (remoteStaff) {
              staffRecord = { role: remoteStaff.role } as any;
            }
          } catch {
            // ignore network err
          }
        }

        if (fetchedRoles.length === 0) {
          if (metaRole) {
            fetchedRoles = [metaRole];
          } else {
            const staffRole = normalizeRole(staffRecord?.role);
            if (staffRole) fetchedRoles = [staffRole];
          }
          if (fetchedRoles.length === 0) {
            fetchedRoles = ["staff"];
          }
        }
        setRoles(fetchedRoles);
      } catch (err) {
        console.warn("[auth-provider] Could not fetch remote profile/roles (offline mode):", err);
      }
    })();
    return () => {
      active = false;
    };
  }, [session?.user?.id, session?.user?.email, session?.user?.user_metadata]);

  const value = useMemo<AuthState>(() => {
    const user = session?.user
      ? {
          id: session.user.id,
          email: session.user.email ?? null,
          fullName: profile?.full_name ?? (session.user.user_metadata?.full_name as string | undefined) ?? null,
          avatarUrl: profile?.avatar_url ?? (session.user.user_metadata?.avatar_url as string | undefined) ?? null,
        }
      : null;

    return {
      user,
      profile,
      roles,
      isLoading,
      isAuthenticated: Boolean(user),
      hasRole: (role: AppRole) => roles.includes(role),
      hasAnyRole: (list: AppRole[]) => list.some((role) => roles.includes(role)),
      signOut: async () => {
        await queryClient.cancelQueries();
        queryClient.clear();
        await supabase.auth.signOut();
        router.navigate({ to: "/auth", replace: true });
      },
    };
  }, [session, profile, roles, isLoading, queryClient, router]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

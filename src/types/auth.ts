/** Roles mirror the `public.app_role` enum in the database. */
export type AppRole = "admin" | "manager" | "staff" | "viewer";

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  branch_id: string | null;
  created_at: string;
}

export interface SessionUser {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
}

export interface AuthState {
  user: SessionUser | null;
  profile: Profile | null;
  roles: AppRole[];
  isLoading: boolean;
  isAuthenticated: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  signOut: () => Promise<void>;
}

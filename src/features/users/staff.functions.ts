import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      email: z.string().email(),
      password: z.string().min(8),
      fullName: z.string().optional(),
      role: z.enum(["admin", "manager", "staff", "viewer"]).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: result, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: data.fullName ? { full_name: data.fullName } : undefined,
    });

    if (error || !result.user) {
      throw new Error(error?.message ?? "Failed to create staff auth user.");
    }

    if (data.role) {
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: result.user.id, role: data.role });

      if (roleError) {
        console.warn("[createStaffUser] user_roles insert warning:", roleError.message);
      }
    }

    return { authUserId: result.user.id };
  });

const inviteStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      email: z.string().email(),
      fullName: z.string().optional(),
      redirectTo: z.string().optional(),
      role: z.enum(["admin", "manager", "staff", "viewer"]).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const inviteOptions: Record<string, unknown> = {
      redirectTo: data.redirectTo || `${process.env.APP_URL || "http://localhost:8080"}/auth?type=invite`,
    };
    if (data.fullName) inviteOptions.data = { full_name: data.fullName };

    const { data: result, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email,
      inviteOptions as { redirectTo?: string; data?: Record<string, string> },
    );

    if (error || !result.user) {
      throw new Error(error?.message ?? "Failed to send invite email.");
    }

    if (data.role) {
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: result.user.id, role: data.role });

      if (roleError) {
        console.warn("[inviteStaffUser] user_roles insert warning:", roleError.message);
      }
    }

    return { authUserId: result.user.id };
  });

const sendStaffResetLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      email: z.string().email(),
      redirectTo: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: result, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
      options: data.redirectTo ? { redirectTo: data.redirectTo } : undefined,
    });

    if (error) {
      throw new Error(error.message ?? "Failed to send reset link.");
    }

    return {
      actionLink: (result as any)?.action_link ?? null,
    };
  });

const deleteStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      authUserId: z.string().optional(),
      staffId: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Delete from Supabase auth.users if authUserId is present
    if (data.authUserId) {
      const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(data.authUserId);
      if (authErr) {
        console.warn("[deleteStaffUser] Supabase auth user delete warning:", authErr.message);
      }
    }

    // 2. Delete from public.staff table
    const { error: staffErr } = await (supabaseAdmin as any).from("staff").delete().eq("id", data.staffId);
    if (staffErr) {
      console.warn("[deleteStaffUser] Supabase staff record delete warning:", staffErr.message);
    }

    return { success: true };
  });

export { createStaffUser, inviteStaffUser, sendStaffResetLink, deleteStaffUser };

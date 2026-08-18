import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Creates a Supabase auth user for a wholesale customer so they can log in to
 * the Wholesale Portal.  Returns the new auth user's UUID which should be stored
 * in customer_accounts.authUserId.
 */
const createWholesaleCustomerUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      email: z.string().email(),
      password: z.string().min(8, "Password must be at least 8 characters"),
      contactName: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: result, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true, // skip email verification — admin sets credentials directly
      user_metadata: data.contactName
        ? { full_name: data.contactName, role: "wholesale_customer" }
        : { role: "wholesale_customer" },
    });

    if (error || !result.user) {
      throw new Error(error?.message ?? "Failed to create portal auth account.");
    }

    return { authUserId: result.user.id };
  });

/**
 * Resets / updates the portal password for an existing wholesale customer.
 */
const resetWholesaleCustomerPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      authUserId: z.string().uuid(),
      newPassword: z.string().min(8, "Password must be at least 8 characters"),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.authUserId, {
      password: data.newPassword,
    });

    if (error) {
      throw new Error(error.message ?? "Failed to update portal password.");
    }

    return { success: true };
  });

/**
 * Deletes the Supabase auth user account for a wholesale customer.
 * Call this when permanently removing a customer.
 */
const deleteWholesaleCustomerUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      authUserId: z.string().uuid(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.authUserId);

    if (error) {
      console.warn("[deleteWholesaleCustomerUser] warning:", error.message);
    }

    return { success: true };
  });

export {
  createWholesaleCustomerUser,
  resetWholesaleCustomerPassword,
  deleteWholesaleCustomerUser,
};

import { z } from "zod";

export const staffSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  preferredName: z.string().optional().or(z.literal("")),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().optional().or(z.literal("")),
  branchId: z.string().min(1, "Branch assignment is required"),
  roleId: z.string().min(1, "Role assignment is required"),
  employmentId: z.string().optional().or(z.literal("")),
  onboardingMode: z.enum(["invite", "manual"]).default("manual"),
});

export const staffStatusSchema = z.object({
  status: z.enum(["active", "suspended", "deactivated"]),
  reason: z.string().optional().or(z.literal("")),
});

export type StaffFormValues = z.infer<typeof staffSchema>;
export type StaffStatusValues = z.infer<typeof staffStatusSchema>;

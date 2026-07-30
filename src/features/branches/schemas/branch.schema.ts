import { z } from "zod";

export const branchSchema = z.object({
  name: z.string().min(2, "Branch name must be at least 2 characters"),
  code: z
    .string()
    .min(2, "Code must be at least 2 characters")
    .max(12, "Code must be at most 12 characters")
    .regex(/^[A-Z0-9-]+$/, "Code must be uppercase letters, numbers, or hyphens only")
    .optional()
    .or(z.literal("")),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  city: z.string().min(1, "City is required"),
  state: z.string().optional().or(z.literal("")),
  country: z.string().min(1, "Country is required"),
  timezone: z.string().optional().or(z.literal("")),
  currency: z.string().min(1, "Currency is required"),
  status: z.enum(["active", "inactive", "temporarily_closed"]),
  managerId: z.string().optional().or(z.literal("")),
  openingDate: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export const branchSettingsSchema = z.object({
  receiptPrefix: z
    .string()
    .max(10, "Receipt prefix must be at most 10 characters")
    .optional()
    .or(z.literal("")),
  lowStockThreshold: z
    .number({ invalid_type_error: "Must be a number" })
    .int("Must be a whole number")
    .min(0, "Cannot be negative")
    .max(9999, "Cannot exceed 9999")
    .default(10),
  currency: z.string().min(1, "Currency is required"),
  timezone: z.string().optional().or(z.literal("")),
});

export type BranchFormValues = z.infer<typeof branchSchema>;
export type BranchSettingsValues = z.infer<typeof branchSettingsSchema>;

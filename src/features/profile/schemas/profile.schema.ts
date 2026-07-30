import { z } from "zod";

export const userProfileSchema = z.object({
  displayName: z.string().min(2, "Display name must be at least 2 characters."),
  preferredName: z.string().optional(),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  timezone: z.string().min(1, "Please select a timezone."),
  language: z.string().min(1, "Please select a language."),
  dateFormat: z.string().min(1, "Please select a date format."),
  timeFormat: z.string().min(1, "Please select a time format."),
});

export const userSecuritySchema = z
  .object({
    currentPassword: z.string().min(8, "Current password is required."),
    newPassword: z.string().min(8, "New password must be at least 8 characters."),
    confirmPassword: z.string().min(8, "Please confirm your new password."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const userPreferencesSchema = z.object({
  theme: z.enum(["light", "dark", "system"]),
  compactMode: z.boolean(),
  tableDensity: z.enum(["compact", "comfortable", "default"]),
  language: z.string().min(1, "Please select a language."),
  notificationPreferences: z.boolean(),
});

export type UserProfileFormValues = z.infer<typeof userProfileSchema>;
export type UserSecurityFormValues = z.infer<typeof userSecuritySchema>;
export type UserPreferencesFormValues = z.infer<typeof userPreferencesSchema>;
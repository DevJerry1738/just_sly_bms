import { z } from "zod";

export const generalSettingsSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters."),
  email: z.string().email("Invalid email address.").or(z.literal("")),
  currency: z.string().min(1, "Please select a currency."),
  timezone: z.string().min(1, "Please select a timezone."),
  date_format: z.string().min(1, "Please select a date format."),
});

export const companyProfileSchema = z.object({
  legal_name: z.string().optional(),
  tax_id: z.string().optional(),
  registration_number: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
});

export const brandingSettingsSchema = z.object({
  logo_url: z.string().optional(),
  primary_color: z.string().min(4, "Invalid hex color code."),
});

export const receiptSettingsSchema = z.object({
  receipt_header: z.string().optional(),
  receipt_footer: z.string().optional(),
  receipt_tax_note: z.string().optional(),
  show_receipt_logo: z.boolean(),
});

export type GeneralSettingsFormValues = z.infer<typeof generalSettingsSchema>;
export type CompanyProfileFormValues = z.infer<typeof companyProfileSchema>;
export type BrandingSettingsFormValues = z.infer<typeof brandingSettingsSchema>;
export type ReceiptSettingsFormValues = z.infer<typeof receiptSettingsSchema>;

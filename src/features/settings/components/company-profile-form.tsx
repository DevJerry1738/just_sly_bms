import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

import type { OrganizationSchema } from "@/database/schema";
import { organizationRepository } from "@/repositories/entity.repositories";
import { companyProfileSchema, type CompanyProfileFormValues } from "../schemas/organization.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface CompanyProfileFormProps {
  initialData: OrganizationSchema;
  onSaved: (updated: OrganizationSchema) => void;
}

export function CompanyProfileForm({ initialData, onSaved }: CompanyProfileFormProps) {
  const [saving, setSaving] = useState(false);

  const form = useForm<CompanyProfileFormValues>({
    resolver: zodResolver(companyProfileSchema),
    defaultValues: {
      legal_name: initialData.legal_name || "",
      tax_id: initialData.tax_id || "",
      registration_number: initialData.registration_number || "",
      phone: initialData.phone || "",
      address: initialData.address || "",
      city: initialData.city || "",
      country: initialData.country || "",
    },
  });

  async function onSubmit(values: CompanyProfileFormValues) {
    setSaving(true);
    try {
      const updated = await organizationRepository.updatePrimaryOrganization(values);
      onSaved(updated);
      toast.success("Company profile saved successfully.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to save company profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card variant="flat" className="border">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Legal & Tax Profile</CardTitle>
        <CardDescription className="text-xs">
          Official business registration numbers, tax identifiers, and registered office addresses.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-xl">
            <FormField
              control={form.control}
              name="legal_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Full Registered Legal Name</FormLabel>
                  <FormControl>
                    <Input {...field} className="h-8 text-xs" placeholder="e.g. Just Sly Business Solutions Ltd" />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="registration_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Business Reg / Company No.</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-8 text-xs" placeholder="CS-92840192" />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tax_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Tax Identification (TIN / VAT)</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-8 text-xs" placeholder="TIN-98472910-GH" />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Official Phone Line</FormLabel>
                  <FormControl>
                    <Input {...field} className="h-8 text-xs" placeholder="+233 24 000 0000" />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Street Address</FormLabel>
                  <FormControl>
                    <Input {...field} className="h-8 text-xs" placeholder="123 Business Avenue, Suite 400" />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">City / State</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-8 text-xs" placeholder="Accra" />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Country</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-8 text-xs" placeholder="Ghana" />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />
            </div>

            <div className="pt-2">
              <Button type="submit" size="sm" disabled={saving} className="text-xs gap-1.5">
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

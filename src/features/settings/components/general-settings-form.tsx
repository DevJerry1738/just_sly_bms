import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

import type { OrganizationSchema } from "@/database/schema";
import { organizationRepository } from "@/repositories/entity.repositories";
import { generalSettingsSchema, type GeneralSettingsFormValues } from "../schemas/organization.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface GeneralSettingsFormProps {
  initialData: OrganizationSchema;
  onSaved: (updated: OrganizationSchema) => void;
}

export function GeneralSettingsForm({ initialData, onSaved }: GeneralSettingsFormProps) {
  const [saving, setSaving] = useState(false);

  const form = useForm<GeneralSettingsFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(generalSettingsSchema) as any,
    defaultValues: {
      name: initialData.name || "",
      email: initialData.email || "",
      currency: initialData.currency || "NGN",
      timezone: initialData.timezone || "GMT",
      date_format: initialData.date_format || "DD/MM/YYYY",
    },
  });

  async function onSubmit(values: GeneralSettingsFormValues) {
    setSaving(true);
    try {
      const updated = await organizationRepository.updatePrimaryOrganization(values);
      onSaved(updated);
      toast.success("General settings saved successfully.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to save general settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card variant="flat" className="border">
      <CardHeader>
        <CardTitle className="text-base font-semibold">General Suite Settings</CardTitle>
        <CardDescription className="text-xs">
          Configure primary organization identity, currency, and local formatting conventions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-xl">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Organization Display Name</FormLabel>
                  <FormControl>
                    <Input {...field} className="h-8 text-xs" placeholder="e.g. Just Sly Enterprise" />
                  </FormControl>
                  <FormDescription className="text-[11px]">
                    This name will appear across topbars, reports, and generated invoices.
                  </FormDescription>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Primary Contact Email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" className="h-8 text-xs" placeholder="billing@justsly.com" />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Currency</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="NGN">NGN (₦)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                        <SelectItem value="GHS">GHS (₵)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Timezone</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="GMT">GMT (UTC+0)</SelectItem>
                        <SelectItem value="WAT">WAT (UTC+1)</SelectItem>
                        <SelectItem value="EST">EST (UTC-5)</SelectItem>
                        <SelectItem value="PST">PST (UTC-8)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date_format"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Date Format</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select format" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
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

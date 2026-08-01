import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Printer, Save } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

import type { OrganizationSchema } from "@/database/schema";
import { organizationRepository } from "@/repositories/entity.repositories";
import { receiptSettingsSchema, type ReceiptSettingsFormValues } from "../schemas/organization.schema";
import { LOGO_IMAGES } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ReceiptSettingsFormProps {
  initialData: OrganizationSchema;
  onSaved: (updated: OrganizationSchema) => void;
}

export function ReceiptSettingsForm({ initialData, onSaved }: ReceiptSettingsFormProps) {
  const [saving, setSaving] = useState(false);

  const form = useForm<ReceiptSettingsFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(receiptSettingsSchema) as any,
    defaultValues: {
      receipt_header: initialData.receipt_header || "Thank you for shopping with Just Sly!",
      receipt_footer: initialData.receipt_footer || "Goods sold in good condition are not returnable.",
      receipt_tax_note: initialData.receipt_tax_note || "All prices are inclusive of 15% VAT & Levies.",
      show_receipt_logo: initialData.show_receipt_logo ?? true,
    },
  });

  const watchHeader = form.watch("receipt_header");
  const watchFooter = form.watch("receipt_footer");
  const watchTaxNote = form.watch("receipt_tax_note");
  const watchShowLogo = form.watch("show_receipt_logo");

  async function onSubmit(values: ReceiptSettingsFormValues) {
    setSaving(true);
    try {
      const updated = await organizationRepository.updatePrimaryOrganization(values);
      onSaved(updated);
      toast.success("Receipt settings saved successfully.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to save receipt settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <Card variant="flat" className="border lg:col-span-7">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Receipt Layout & Notes</CardTitle>
          <CardDescription className="text-xs">
            Configure header greetings, terms & conditions, and tax compliance notes printed on receipts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="show_receipt_logo"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-xs font-semibold">Include Organization Logo</FormLabel>
                      <FormDescription className="text-[11px]">
                        Print high-contrast logo header on physical thermal receipts.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="receipt_header"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Receipt Header Message</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-8 text-xs" placeholder="e.g. Welcome to Just Sly Retail" />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="receipt_tax_note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Tax Compliance Disclosure</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-8 text-xs" placeholder="e.g. All prices include 15% VAT" />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="receipt_footer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Receipt Footer Terms</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        className="text-xs resize-none"
                        placeholder="e.g. Exchange allowed within 7 days with valid receipt."
                      />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

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

      {/* Thermal Receipt Live Preview */}
      <Card variant="flat" className="border lg:col-span-5 bg-muted/20">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Printer className="size-4 text-muted-foreground" />
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Thermal Receipt Preview
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mx-auto w-full max-w-[280px] rounded-lg border bg-white p-5 text-slate-900 font-mono text-[11px] leading-relaxed shadow-sm">
            {watchShowLogo && (
              <div className="flex justify-center mb-3">
                <img src={LOGO_IMAGES.noBg} alt="Logo" className="h-10 w-auto object-contain grayscale" />
              </div>
            )}
            <div className="text-center space-y-0.5 border-b border-dashed border-slate-300 pb-3 mb-3">
              <p className="font-bold text-xs uppercase tracking-tight">{initialData.name || "Just Sly Enterprise"}</p>
              <p className="text-[10px] text-slate-600">{initialData.address || "123 Business Ave, Lagos"}</p>
              <p className="text-[10px] text-slate-600">TEL: {initialData.phone || "+234 1 700 0000"}</p>
              <p className="text-[10px] text-slate-600">TIN: {initialData.tax_id || "TIN-98472910-NG"}</p>
              {watchHeader && <p className="text-[10px] italic pt-1 font-sans">{watchHeader}</p>}
            </div>

            <div className="space-y-1 text-[10px] border-b border-dashed border-slate-300 pb-3 mb-3">
              <div className="flex justify-between font-bold border-b border-slate-200 pb-1">
                <span>ITEM</span>
                <span>QTY x PRICE</span>
                <span>TOTAL</span>
              </div>
              <div className="flex justify-between">
                <span>Enterprise Suite License</span>
                <span>1 x 150.00</span>
                <span>150.00</span>
              </div>
              <div className="flex justify-between">
                <span>Thermal Printer Setup</span>
                <span>1 x 80.00</span>
                <span>80.00</span>
              </div>
            </div>

            <div className="space-y-0.5 text-right font-bold border-b border-dashed border-slate-300 pb-3 mb-3">
              <div className="flex justify-between text-[10px] font-normal text-slate-600">
                <span>Subtotal</span>
                <span>₦ 230.00</span>
              </div>
              <div className="flex justify-between text-[10px] font-normal text-slate-600">
                <span>VAT (15%)</span>
                <span>₦ 34.50</span>
              </div>
              <div className="flex justify-between text-xs font-bold pt-1">
                <span>TOTAL DUE</span>
                <span>₦ 264.50</span>
              </div>
            </div>

            <div className="text-center space-y-1 pt-1">
              {watchTaxNote && <p className="text-[9px] text-slate-600">{watchTaxNote}</p>}
              {watchFooter && <p className="text-[9px] font-sans text-slate-700 font-medium">{watchFooter}</p>}
              <p className="text-[9px] text-slate-400 pt-2">*** END OF RECEIPT ***</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Printer, Save, FileText, Check } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

import type { OrganizationSchema } from "@/database/schema";
import { organizationRepository } from "@/repositories/entity.repositories";
import { receiptSettingsSchema, type ReceiptSettingsFormValues } from "../schemas/organization.schema";
import { LOGO_IMAGES } from "@/components/common/logo";
import { DomainEvents } from "@/services/events/domain-events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ReceiptSettingsFormProps {
  initialData: OrganizationSchema;
  onSaved: (updated: OrganizationSchema) => void;
}

export function ReceiptSettingsForm({ initialData, onSaved }: ReceiptSettingsFormProps) {
  const [saving, setSaving] = useState(false);
  const [receiptFormat, setReceiptFormat] = useState<"compact_thermal" | "a4">(
    initialData.receipt_format || "compact_thermal"
  );

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
      const updated = await organizationRepository.updatePrimaryOrganization({
        ...values,
        receipt_format: receiptFormat,
      });
      onSaved(updated);

      await DomainEvents.publish("RECEIPT_SETTINGS_CHANGED", {
        entity: "OrganizationSettings",
        entityId: updated.id,
        before: { receipt_format: initialData.receipt_format, ...form.formState.defaultValues },
        after: { receipt_format: receiptFormat, ...values },
        description: "Updated POS receipt header, footer, tax notes, and print format",
      });

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
          <CardTitle className="text-base font-semibold">Receipt Layout & Format</CardTitle>
          <CardDescription className="text-xs">
            Configure POS receipt template type, greetings, footer terms, and live layout preview.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2 pb-2 border-b">
                <Label className="text-xs font-semibold">Receipt Print Format</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    className={`p-3 border rounded-lg cursor-pointer transition-all flex items-center justify-between ${
                      receiptFormat === "compact_thermal" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-muted-foreground/30"
                    }`}
                    onClick={() => setReceiptFormat("compact_thermal")}
                  >
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold flex items-center gap-1.5">
                        <Printer className="size-3.5" /> Compact Thermal (80mm)
                      </p>
                      <p className="text-[10px] text-muted-foreground">Minimizes paper usage & cost</p>
                    </div>
                    {receiptFormat === "compact_thermal" && <Check className="size-4 text-primary" />}
                  </div>

                  <div
                    className={`p-3 border rounded-lg cursor-pointer transition-all flex items-center justify-between ${
                      receiptFormat === "a4" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-muted-foreground/30"
                    }`}
                    onClick={() => setReceiptFormat("a4")}
                  >
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold flex items-center gap-1.5">
                        <FileText className="size-3.5" /> Full A4 Invoice
                      </p>
                      <p className="text-[10px] text-muted-foreground">Full page invoice for wholesale</p>
                    </div>
                    {receiptFormat === "a4" && <Check className="size-4 text-primary" />}
                  </div>
                </div>
              </div>

              <FormField
                control={form.control}
                name="show_receipt_logo"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-xs font-semibold">Include Organization Logo</FormLabel>
                      <FormDescription className="text-[11px]">
                        Print high-contrast logo header on physical receipts.
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

      {/* Receipt Live Preview */}
      <Card variant="flat" className="border lg:col-span-5 bg-muted/20">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Printer className="size-4 text-muted-foreground" />
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Live {receiptFormat === "compact_thermal" ? "Thermal" : "A4"} Receipt Preview
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {receiptFormat === "compact_thermal" ? (
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
                <div className="flex justify-between text-xs font-bold pt-1">
                  <span>TOTAL DUE</span>
                  <span>₦ 230.00</span>
                </div>
              </div>

              <div className="text-center space-y-1 pt-1">
                {watchTaxNote && <p className="text-[9px] text-slate-600">{watchTaxNote}</p>}
                {watchFooter && <p className="text-[9px] font-sans text-slate-700 font-medium">{watchFooter}</p>}
                <p className="text-[9px] text-slate-400 pt-2">*** END OF RECEIPT ***</p>
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full rounded-lg border bg-white p-6 text-slate-900 font-sans text-xs space-y-4 shadow-sm">
              <div className="flex justify-between items-start border-b pb-4">
                <div>
                  <h3 className="font-bold text-base uppercase">{initialData.name || "Just Sly Enterprise"}</h3>
                  <p className="text-muted-foreground">{initialData.address || "123 Business Ave, Lagos"}</p>
                  <p className="text-muted-foreground">TEL: {initialData.phone}</p>
                </div>
                {watchShowLogo && <img src={LOGO_IMAGES.noBg} alt="Logo" className="h-10 w-auto object-contain" />}
              </div>

              {watchHeader && <div className="italic text-muted-foreground">{watchHeader}</div>}

              <div className="border rounded">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b">
                    <tr>
                      <th className="p-2 font-semibold">Description</th>
                      <th className="p-2 font-semibold">Qty</th>
                      <th className="p-2 font-semibold">Unit Price</th>
                      <th className="p-2 font-semibold text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-2">Wholesale Order Line Item #1</td>
                      <td className="p-2">100</td>
                      <td className="p-2">₦ 4,500</td>
                      <td className="p-2 text-right">₦ 450,000</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="text-right font-bold text-sm">TOTAL: ₦ 450,000</div>

              <div className="border-t pt-3 text-[11px] text-slate-600 space-y-1">
                {watchTaxNote && <p>{watchTaxNote}</p>}
                {watchFooter && <p>{watchFooter}</p>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

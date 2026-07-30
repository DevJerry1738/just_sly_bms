import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

import type { OrganizationSchema } from "@/database/schema";
import { organizationRepository } from "@/repositories/entity.repositories";
import { brandingSettingsSchema, type BrandingSettingsFormValues } from "../schemas/organization.schema";
import { LOGO_IMAGES } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface BrandingSettingsFormProps {
  initialData: OrganizationSchema;
  onSaved: (updated: OrganizationSchema) => void;
}

const AVAILABLE_LOGOS = [
  { id: "no_bg", label: "Transparent Background", src: LOGO_IMAGES.noBg, bgClass: "bg-surface" },
  { id: "white_bg", label: "White Card Background", src: LOGO_IMAGES.whiteBg, bgClass: "bg-white" },
  { id: "dark_bg", label: "Dark Dark Mode Shield", src: LOGO_IMAGES.darkBg, bgClass: "bg-slate-900" },
];

export function BrandingSettingsForm({ initialData, onSaved }: BrandingSettingsFormProps) {
  const [saving, setSaving] = useState(false);
  const [selectedLogo, setSelectedLogo] = useState<string>(initialData.logo_url || "no_bg");

  const form = useForm<BrandingSettingsFormValues>({
    resolver: zodResolver(brandingSettingsSchema),
    defaultValues: {
      logo_url: initialData.logo_url || "no_bg",
      primary_color: initialData.primary_color || "#0f172a",
    },
  });

  async function onSubmit(values: BrandingSettingsFormValues) {
    setSaving(true);
    try {
      const payload = { ...values, logo_url: selectedLogo };
      const updated = await organizationRepository.updatePrimaryOrganization(payload);
      onSaved(updated);
      toast.success("Branding settings saved successfully.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to save branding settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card variant="flat" className="border">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Branding & Visual Identity</CardTitle>
        <CardDescription className="text-xs">
          Select suite logo variant and brand primary accent colors used across client portals.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-xl">
            <div className="space-y-2">
              <Label className="text-xs">Select Logo Asset</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                {AVAILABLE_LOGOS.map((logo) => {
                  const active = selectedLogo === logo.id;
                  return (
                    <button
                      key={logo.id}
                      type="button"
                      onClick={() => {
                        setSelectedLogo(logo.id);
                        form.setValue("logo_url", logo.id);
                      }}
                      className={cn(
                        "relative flex flex-col items-center justify-between rounded-xl border p-4 text-center transition-all hover:border-primary/50",
                        active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card",
                      )}
                    >
                      {active && (
                        <span className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3" />
                        </span>
                      )}
                      <div className={cn("flex size-14 items-center justify-center rounded-lg p-2 mb-2 border", logo.bgClass)}>
                        <img src={logo.src} alt={logo.label} className="max-h-full max-w-full object-contain" />
                      </div>
                      <span className="text-[11px] font-medium text-foreground">{logo.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <FormField
              control={form.control}
              name="primary_color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Brand Primary Color (Hex)</FormLabel>
                  <div className="flex items-center gap-3">
                    <div
                      className="size-8 rounded-lg border shadow-2xs shrink-0"
                      style={{ backgroundColor: field.value || "#0f172a" }}
                    />
                    <FormControl>
                      <Input {...field} className="h-8 text-xs font-mono max-w-40" placeholder="#0f172a" />
                    </FormControl>
                  </div>
                  <FormDescription className="text-[11px]">
                    Hexadecimal color code used for primary UI accents and print documents.
                  </FormDescription>
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
  );
}

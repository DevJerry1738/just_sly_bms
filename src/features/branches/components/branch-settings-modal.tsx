import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Settings2 } from "lucide-react";

import { branchSettingsSchema, type BranchSettingsValues } from "../schemas/branch.schema";
import type { BranchSchema } from "@/database/schema";
import { branchRepository } from "@/repositories/branch.repository";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

interface BranchSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch: BranchSchema;
  onSuccess: () => void;
}

const CURRENCIES = ["GHS", "USD", "EUR", "GBP", "NGN", "KES", "ZAR"];
const TIMEZONES = ["GMT", "Africa/Accra", "Africa/Lagos", "Africa/Nairobi", "Africa/Johannesburg"];

export function BranchSettingsModal({ open, onOpenChange, branch, onSuccess }: BranchSettingsModalProps) {
  const form = useForm<BranchSettingsValues>({
    resolver: zodResolver(branchSettingsSchema),
    defaultValues: {
      receiptPrefix: branch.receiptPrefix ?? "",
      lowStockThreshold: branch.lowStockThreshold ?? 10,
      currency: branch.currency ?? "GHS",
      timezone: branch.timezone ?? "GMT",
    },
  });

  useEffect(() => {
    if (branch) {
      form.reset({
        receiptPrefix: branch.receiptPrefix ?? "",
        lowStockThreshold: branch.lowStockThreshold ?? 10,
        currency: branch.currency ?? "GHS",
        timezone: branch.timezone ?? "GMT",
      });
    }
  }, [branch, form]);

  const onSubmit = async (values: BranchSettingsValues) => {
    try {
      await branchRepository.updateBranch(branch.id, {
        receiptPrefix: values.receiptPrefix ?? "",
        lowStockThreshold: values.lowStockThreshold,
        currency: values.currency,
        timezone: values.timezone ?? "GMT",
        updatedAt: Date.now(),
      });
      toast.success("Branch settings saved");
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save branch settings");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Settings2 className="size-4.5 text-primary" />
            </div>
            <div>
              <DialogTitle>Branch Settings</DialogTitle>
              <DialogDescription className="text-xs">{branch.name}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Separator />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Operational</p>
            </div>

            {/* Currency */}
            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Currency</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Timezone */}
            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timezone</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TIMEZONES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">POS & Receipts</p>
            </div>

            {/* Receipt Prefix */}
            <FormField
              control={form.control}
              name="receiptPrefix"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Receipt Prefix</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. HQ-ACC-" {...field} />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Prepended to every receipt number at this branch (e.g. HQ-ACC-00001).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Low Stock Threshold */}
            <FormField
              control={form.control}
              name="lowStockThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Low Stock Alert Threshold</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={9999}
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Alert when inventory quantity falls below this number.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving..." : "Save Settings"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

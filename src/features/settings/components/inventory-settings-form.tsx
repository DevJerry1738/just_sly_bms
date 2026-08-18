import { useState } from "react";
import { Package, Save, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/providers/auth-provider";
import { systemSettingsService } from "@/services/settings/system-settings.service";
import type { OrganizationSchema } from "@/database/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

interface InventorySettingsFormProps {
  initialData: OrganizationSchema;
  onSaved: (updated: OrganizationSchema) => void;
}

export function InventorySettingsForm({ initialData, onSaved }: InventorySettingsFormProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [threshold, setThreshold] = useState<number>(initialData.default_low_stock_threshold ?? 5);
  const [applyToExisting, setApplyToExisting] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await systemSettingsService.updateLowStockDefault(
        threshold,
        user.id,
        user.email || "Admin",
        applyToExisting
      );
      onSaved(updated);
      toast.success(
        `Low stock default updated to ${threshold}${applyToExisting ? " and applied to existing products" : ""}`
      );
    } catch (err) {
      console.error("[InventorySettingsForm] Save failed:", err);
      toast.error("Failed to save inventory settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border shadow-xs max-w-2xl">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="size-4 text-primary" /> Inventory Operational Preferences
        </CardTitle>
        <CardDescription>
          Configure default reorder thresholds and rules for newly registered product items.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="lowStockDefault" className="text-xs font-semibold">
            Default Low Stock Reorder Threshold
          </Label>
          <div className="flex items-center gap-3">
            <Input
              id="lowStockDefault"
              type="number"
              min="0"
              className="w-32 h-9 text-xs"
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value, 10) || 0)}
            />
            <span className="text-xs text-muted-foreground">units</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            When creating a new product item, this value will be pre-filled as its reorder alert trigger point.
          </p>
        </div>

        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                Bulk Update Operational Rule
              </p>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
                By default, updating this setting only affects newly created products. Check the option below if you explicitly intend to overwrite existing product thresholds.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-1">
            <Checkbox
              id="applyExisting"
              checked={applyToExisting}
              onCheckedChange={(c) => setApplyToExisting(!!c)}
            />
            <label
              htmlFor="applyExisting"
              className="text-xs font-medium leading-none cursor-pointer select-none"
            >
              Apply new default threshold ({threshold} units) to ALL existing catalog products
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="size-4 mr-1.5" /> {saving ? "Saving..." : "Save Default Threshold"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

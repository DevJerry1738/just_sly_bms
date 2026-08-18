import { useState } from "react";
import { Bell, Mail, MessageSquare, Save, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/providers/auth-provider";
import { systemSettingsService } from "@/services/settings/system-settings.service";
import type { OrganizationSchema } from "@/database/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

interface NotificationSettingsFormProps {
  initialData: OrganizationSchema;
  onSaved: (updated: OrganizationSchema) => void;
}

const CATEGORIES = [
  { key: "order_updates", label: "Wholesale Order Status Updates", description: "Notifications for order confirmation, dispatch, and payment status changes." },
  { key: "low_stock", label: "Low Stock Inventory Alerts", description: "Alerts when product quantity on hand drops below reorder threshold." },
  { key: "expiry_warning", label: "Batch Expiry Warnings", description: "Alerts for inventory batches approaching expiration date." },
  { key: "branch_supplies", label: "Branch Supply & Transfer Events", description: "Alerts when HQ sends stock supplies or inter-branch transfers are requested." },
];

export function NotificationSettingsForm({ initialData, onSaved }: NotificationSettingsFormProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const [channels, setChannels] = useState<Record<string, { inApp: boolean; email: boolean; whatsapp: boolean }>>(() => {
    return (
      initialData.notification_channels || {
        order_updates: { inApp: true, email: true, whatsapp: true },
        low_stock: { inApp: true, email: true, whatsapp: false },
        expiry_warning: { inApp: true, email: true, whatsapp: false },
        branch_supplies: { inApp: true, email: true, whatsapp: true },
      }
    );
  });

  const handleToggle = (categoryKey: string, channel: "inApp" | "email" | "whatsapp", value: boolean) => {
    setChannels((prev) => ({
      ...prev,
      [categoryKey]: {
        ...(prev[categoryKey] || { inApp: true, email: false, whatsapp: false }),
        [channel]: value,
      },
    }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await systemSettingsService.updateNotificationChannels(channels, user.id, user.email || "Admin");
      onSaved(updated);
      toast.success("Notification channel preferences updated successfully");
    } catch (err) {
      console.error("[NotificationSettingsForm] Save failed:", err);
      toast.error("Failed to save notification settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border shadow-xs">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="size-4 text-primary" /> System Notification Channels
        </CardTitle>
        <CardDescription>
          Configure system-wide dispatch preferences for in-app popovers, automated emails, and WhatsApp messaging.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="border rounded-lg divide-y">
          {CATEGORIES.map((cat) => {
            const current = channels[cat.key] || { inApp: true, email: false, whatsapp: false };
            return (
              <div key={cat.key} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1 max-w-md">
                  <p className="text-sm font-semibold">{cat.label}</p>
                  <p className="text-xs text-muted-foreground">{cat.description}</p>
                </div>

                <div className="flex items-center gap-6 bg-muted/30 p-2.5 rounded-lg">
                  {/* In-App */}
                  <div className="flex items-center gap-2">
                    <Bell className="size-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium">In-App</span>
                    <Switch
                      checked={current.inApp}
                      onCheckedChange={(val) => handleToggle(cat.key, "inApp", val)}
                    />
                  </div>

                  {/* Email */}
                  <div className="flex items-center gap-2">
                    <Mail className="size-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium">Email</span>
                    <Switch
                      checked={current.email}
                      onCheckedChange={(val) => handleToggle(cat.key, "email", val)}
                    />
                  </div>

                  {/* WhatsApp */}
                  <div className="flex items-center gap-2">
                    <MessageSquare className="size-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium">WhatsApp</span>
                    <Switch
                      checked={current.whatsapp}
                      onCheckedChange={(val) => handleToggle(cat.key, "whatsapp", val)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="size-4 mr-1.5" /> {saving ? "Saving..." : "Save Preferences"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

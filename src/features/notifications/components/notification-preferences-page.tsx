import { useState, useEffect } from "react";
import { Bell, Mail, MessageSquare, Save, ShieldCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/providers/auth-provider";
import { notificationPreferenceRepository } from "@/repositories/notification-preference.repository";
import type { NotificationPreferenceSchema } from "@/database/schema";

interface CategoryPreference {
  category: string;
  label: string;
  description: string;
  inApp: boolean;
  email: boolean;
  whatsapp: boolean;
}

const CATEGORIES: { category: string; label: string; description: string }[] = [
  {
    category: "order_updates",
    label: "Order & Payment Updates",
    description: "Notifications for new orders, payment submissions, payment confirmations, and status advances.",
  },
  {
    category: "inventory_alerts",
    label: "Inventory & Expiry Alerts",
    description: "Notifications when product inventory falls below thresholds or batches are expiring/expired.",
  },
  {
    category: "branch_operations",
    label: "Branch Transfers & Supplies",
    description: "Notifications when branch transfers are created, accepted, or rejected.",
  },
];

export function NotificationPreferencesPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<CategoryPreference[]>([]);

  useEffect(() => {
    async function load() {
      if (!user?.id) return;
      try {
        const stored = await notificationPreferenceRepository.getForUser(user.id);
        const storedMap = new Map(stored.map((p) => [p.category, p]));

        const merged: CategoryPreference[] = CATEGORIES.map((c) => {
          const item = storedMap.get(c.category);
          return {
            ...c,
            inApp: item ? item.inApp : true,
            email: item ? item.email : true,
            whatsapp: item ? item.whatsapp : false,
          };
        });

        setPreferences(merged);
      } catch (err) {
        toast.error("Failed to load notification preferences");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user?.id]);

  const handleToggle = (category: string, channel: "inApp" | "email" | "whatsapp", checked: boolean) => {
    setPreferences((prev) =>
      prev.map((p) => (p.category === category ? { ...p, [channel]: checked } : p))
    );
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const now = Date.now();
      for (const pref of preferences) {
        const existing = await notificationPreferenceRepository.getCategoryPreference(
          { userId: user.id },
          pref.category
        );

        const data: NotificationPreferenceSchema = {
          id: existing ? existing.id : crypto.randomUUID(),
          userId: user.id,
          category: pref.category,
          inApp: pref.inApp,
          email: pref.email,
          whatsapp: pref.whatsapp,
          updatedAt: now,
          sync_status: "pending",
        };

        if (existing) {
          await notificationPreferenceRepository.update(existing.id, {
            inApp: pref.inApp,
            email: pref.email,
            whatsapp: pref.whatsapp,
            updatedAt: now,
            sync_status: "pending",
          });
        } else {
          await notificationPreferenceRepository.create({
            userId: user.id,
            category: pref.category,
            inApp: pref.inApp,
            email: pref.email,
            whatsapp: pref.whatsapp,
            updatedAt: now,
            sync_status: "pending",
          });
        }
      }

      toast.success("Notification preferences saved successfully!");
    } catch (err) {
      toast.error("Failed to save notification preferences");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="container max-w-4xl py-10 text-center text-slate-500">Loading preferences…</div>;
  }

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Bell className="size-6 text-indigo-400" />
            Notification Preferences
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Choose how you want to receive operational alerts across In-App, Email, and WhatsApp channels.
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white shrink-0"
        >
          <Save className="size-4" />
          {saving ? "Saving…" : "Save Preferences"}
        </Button>
      </div>

      <div className="space-y-4">
        {preferences.map((pref) => (
          <Card key={pref.category} className="bg-slate-900 border-slate-800 text-slate-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-slate-100">{pref.label}</CardTitle>
              <CardDescription className="text-xs text-slate-400">{pref.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-800/80 pt-4">
                {/* In-App Channel */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <Bell className="size-4 text-indigo-400 shrink-0" />
                    <div>
                      <Label className="text-xs font-medium text-slate-200">In-App</Label>
                      <p className="text-[10px] text-slate-500">Header bell & history</p>
                    </div>
                  </div>
                  <Switch
                    checked={pref.inApp}
                    onCheckedChange={(c) => handleToggle(pref.category, "inApp", c)}
                  />
                </div>

                {/* Email Channel */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <Mail className="size-4 text-blue-400 shrink-0" />
                    <div>
                      <Label className="text-xs font-medium text-slate-200">Email</Label>
                      <p className="text-[10px] text-slate-500">Direct inbox dispatch</p>
                    </div>
                  </div>
                  <Switch
                    checked={pref.email}
                    onCheckedChange={(c) => handleToggle(pref.category, "email", c)}
                  />
                </div>

                {/* WhatsApp Channel */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <MessageSquare className="size-4 text-emerald-400 shrink-0" />
                    <div>
                      <Label className="text-xs font-medium text-slate-200">WhatsApp</Label>
                      <p className="text-[10px] text-slate-500">Template messages</p>
                    </div>
                  </div>
                  <Switch
                    checked={pref.whatsapp}
                    onCheckedChange={(c) => handleToggle(pref.category, "whatsapp", c)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

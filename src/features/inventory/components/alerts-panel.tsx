import React, { useState, useEffect } from "react";
import { AlertTriangle, PackageX, CheckCircle, Bell, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { inventoryAlertRepository } from "@/repositories/inventory-alert.repository";
import { useAuth } from "@/providers/auth-provider";
import type { InventoryAlertSchema } from "@/database/schema";

export function AlertsPanel({ branchId }: { branchId?: string }) {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<InventoryAlertSchema[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAlerts = async () => {
    setIsLoading(true);
    try {
      // Run evaluation scan first
      await inventoryAlertRepository.generateExpiryAlerts();
      await inventoryAlertRepository.generateLowStockAlerts();

      const active = await inventoryAlertRepository.getActiveAlerts(branchId);
      setAlerts(active);
    } catch (err) {
      console.error("Failed loading inventory alerts", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [branchId]);

  const handleAcknowledge = async (alertId: string) => {
    try {
      await inventoryAlertRepository.acknowledgeAlert(alertId, user?.id ?? "system", user?.displayName ?? user?.email);
      loadAlerts();
    } catch (err) {
      console.error("Failed to acknowledge alert", err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex justify-between items-center bg-muted/40 p-4 rounded-xl">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Active Inventory Alerts ({alerts.length})</h3>
        </div>

        <Button variant="ghost" size="sm" onClick={loadAlerts}>
          <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh Scan
        </Button>
      </div>

      {/* Alerts List */}
      {isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground border rounded-xl bg-card">
          Scanning inventory for low stock and expiring batches...
        </div>
      ) : alerts.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground border rounded-xl bg-card">
          <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
          No active inventory alerts! All stock levels and batch expirations are healthy.
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const isExpired = alert.severity === "expired";
            const isCritical = alert.severity === "critical";

            return (
              <div
                key={alert.id}
                className={`flex items-center justify-between p-4 rounded-xl border bg-card transition-colors ${
                  isExpired
                    ? "border-rose-500/50 bg-rose-500/5"
                    : isCritical
                    ? "border-amber-500/50 bg-amber-500/5"
                    : "border-border"
                }`}
              >
                <div className="flex items-start gap-3">
                  {isExpired ? (
                    <PackageX className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle
                      className={`w-5 h-5 shrink-0 mt-0.5 ${
                        isCritical ? "text-amber-500" : "text-blue-500"
                      }`}
                    />
                  )}

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{alert.message}</span>
                      <Badge
                        variant={isExpired ? "destructive" : "outline"}
                        className="capitalize text-[10px]"
                      >
                        {alert.type.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Recorded {new Date(alert.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAcknowledge(alert.id)}
                  className="shrink-0"
                >
                  <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Acknowledge
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

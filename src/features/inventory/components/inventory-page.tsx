import React, { useEffect, useState } from "react";
import {
  Boxes,
  LayoutDashboard,
  Layers,
  History,
  SlidersHorizontal,
  Calendar,
  ClipboardList,
  Bell,
  Plus,
  ArrowUpDown,
  Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuthorization } from "@/hooks/use-authorization";
import { useBranch } from "@/providers/branch-provider";
import { useAuth } from "@/providers/auth-provider";
import { InventoryDashboard } from "./inventory-dashboard";
import { CurrentStockTable } from "./current-stock-table";
import { TransactionHistoryTable } from "./transaction-history-table";
import { BatchManager } from "./batch-manager";
import { ExpiryReport } from "./expiry-report";
import { StockCountPage } from "./stock-count-page";
import { AlertsPanel } from "./alerts-panel";
import { TransferManagementPage } from "./transfer-management-page";
import { OpeningStockModal } from "./opening-stock-modal";
import { AdjustmentModal } from "./adjustment-modal";
import { clearLocalDatabase } from "@/database";
import { inventoryAlertRepository } from "@/repositories/inventory-alert.repository";
import { countRelevantUnreadNotifications } from "./alerts-panel";
import { db } from "@/database/schema";
import type { BranchSchema } from "@/database/schema";

export function InventoryPage() {
  const { hasPermission, isSuperAdmin } = useAuthorization();
  const { user } = useAuth();
  const { activeBranch, branches, setActiveBranchId } = useBranch();
  const canAdjust = hasPermission("inventory:adjust") || hasPermission("inventory:create");
  const branchId = activeBranch?.id ?? "";
  const canSelectBranch = isSuperAdmin;
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isResettingLocalData, setIsResettingLocalData] = useState(false);
  const [alertBadgeCount, setAlertBadgeCount] = useState(0);

  // Modals
  const [isOpeningStockOpen, setIsOpeningStockOpen] = useState(false);
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const loadAlertBadgeCount = async () => {
    try {
      const unreadNotificationCount = await countRelevantUnreadNotifications(
        branchId,
        user?.id,
        user?.email
      );
      const activeAlerts = await inventoryAlertRepository.getActiveAlerts(branchId);
      setAlertBadgeCount(unreadNotificationCount + activeAlerts.length);
    } catch (err) {
      console.error("Failed to load alert badge count", err);
    }
  };

  useEffect(() => {
    void loadAlertBadgeCount();
  }, [branchId]);

  const handleResetLocalData = async () => {
    if (!window.confirm("This will clear all local IndexedDB data and reload the app. Continue?")) {
      return;
    }

    setIsResettingLocalData(true);
    try {
      await clearLocalDatabase();
      window.location.reload();
    } catch (err) {
      console.error("Failed to reset local data", err);
      alert("Failed to reset local data.");
      setIsResettingLocalData(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory Management</h1>
          <p className="text-sm text-muted-foreground">
            Transaction-first stock ledger, current balances, batch tracking, expiry monitoring, and stock reconciliation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Branch selector */}
          {canSelectBranch ? (
            <select
              value={branchId}
              onChange={(e) => setActiveBranchId(e.target.value)}
              className="h-9 px-3 py-1 text-sm rounded-md border border-input bg-background font-medium"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          ) : (
            <div className="h-9 px-3 py-1 text-sm rounded-md border border-input bg-background font-medium text-muted-foreground">
              {activeBranch?.name ?? "Branch not selected"} ({activeBranch?.code ?? "—"})
            </div>
          )}

          {canAdjust && (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsOpeningStockOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" /> Opening Stock
              </Button>

              <Button size="sm" onClick={() => setIsAdjustmentOpen(true)}>
                <ArrowUpDown className="w-4 h-4 mr-1.5" /> Stock Adjustment
              </Button>
            </>
          )}

          {import.meta.env.DEV && (
            <Button variant="outline" size="sm" onClick={() => void handleResetLocalData()} disabled={isResettingLocalData}>
              {isResettingLocalData ? "Resetting..." : "Reset Local Data"}
            </Button>
          )}
        </div>
      </div>

      {/* Main Tabbed Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50 p-1 flex-wrap h-auto">
          <TabsTrigger value="dashboard" className="gap-1.5 text-xs">
            <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="current_stock" className="gap-1.5 text-xs">
            <Boxes className="w-3.5 h-3.5" /> Current Stock
          </TabsTrigger>
          <TabsTrigger value="transactions" className="gap-1.5 text-xs">
            <History className="w-3.5 h-3.5" /> Ledger History
          </TabsTrigger>
          <TabsTrigger value="batches" className="gap-1.5 text-xs">
            <Layers className="w-3.5 h-3.5" /> Batches
          </TabsTrigger>
          <TabsTrigger value="expiry" className="gap-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5" /> Expiry Report
          </TabsTrigger>
          <TabsTrigger value="stock_count" className="gap-1.5 text-xs">
            <ClipboardList className="w-3.5 h-3.5" /> Stock Count
          </TabsTrigger>
          <TabsTrigger value="transfers" className="gap-1.5 text-xs">
            <Send className="w-3.5 h-3.5" /> Transfers
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1.5 text-xs">
            <Bell className="w-3.5 h-3.5" /> Alerts
            {alertBadgeCount > 0 && (
              <Badge className="ml-2" variant="secondary">
                {alertBadgeCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" key={`dash-${refreshKey}`}>
          <InventoryDashboard branchId={branchId} />
        </TabsContent>

        <TabsContent value="current_stock" key={`stock-${refreshKey}`}>
          <CurrentStockTable branchId={branchId} />
        </TabsContent>

        <TabsContent value="transactions" key={`txn-${refreshKey}`}>
          <TransactionHistoryTable branchId={branchId} />
        </TabsContent>

        <TabsContent value="batches" key={`batch-${refreshKey}`}>
          <BatchManager branchId={branchId} />
        </TabsContent>

        <TabsContent value="expiry" key={`exp-${refreshKey}`}>
          <ExpiryReport branchId={branchId} />
        </TabsContent>

        <TabsContent value="stock_count" key={`sc-${refreshKey}`}>
          <StockCountPage branchId={branchId} />
        </TabsContent>

        <TabsContent value="transfers" key={`trf-${refreshKey}`}>
          <TransferManagementPage />
        </TabsContent>

        <TabsContent value="alerts" key={`alt-${refreshKey}`}>
          <AlertsPanel
            branchId={branchId}
            onAlertCountChange={(count) => setAlertBadgeCount(count)}
          />
        </TabsContent>
      </Tabs>

      {/* Opening Stock Modal */}
      <OpeningStockModal
        isOpen={isOpeningStockOpen}
        onClose={() => setIsOpeningStockOpen(false)}
        onSuccess={triggerRefresh}
        branchId={branchId}
      />

      {/* Adjustment Modal */}
      <AdjustmentModal
        isOpen={isAdjustmentOpen}
        onClose={() => setIsAdjustmentOpen(false)}
        onSuccess={triggerRefresh}
        branchId={branchId}
      />
    </div>
  );
}

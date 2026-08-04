import React, { useState, useEffect } from "react";
import { Plus, Play, CheckCircle2, XCircle, AlertTriangle, Eye, ArrowRight, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { stockCountRepository } from "@/repositories/stock-count.repository";
import { useAuth } from "@/providers/auth-provider";
import { useAuthorization } from "@/hooks/use-authorization";
import type { StockCountSessionSchema, StockCountItemSchema } from "@/database/schema";

export function StockCountPage({ branchId }: { branchId: string }) {
  const { user } = useAuth();
  const { hasPermission } = useAuthorization();
  const canManage = hasPermission("inventory:stock_count") || hasPermission("inventory:adjust");

  const [sessions, setSessions] = useState<StockCountSessionSchema[]>([]);
  const [activeSession, setActiveSession] = useState<StockCountSessionSchema | null>(null);
  const [items, setItems] = useState<StockCountItemSchema[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Count Sheet Editing State: item.id -> string count
  const [countInputs, setCountInputs] = useState<Record<string, string>>({});
  const [savingItem, setSavingItem] = useState<string | null>(null);

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const data = await stockCountRepository.getSessionsByBranch(branchId);
      setSessions(data);

      // Auto-open in-progress session if exists
      const inProgress = data.find((s) => s.status === "in_progress" || s.status === "pending_approval");
      if (inProgress && !activeSession) {
        openSessionDetail(inProgress);
      }
    } catch (err) {
      console.error("Failed loading stock count sessions", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [branchId]);

  const openSessionDetail = async (session: StockCountSessionSchema) => {
    setActiveSession(session);
    const sessionItems = await stockCountRepository.getSessionItems(session.id);
    setItems(sessionItems);

    const initialInputs: Record<string, string> = {};
    for (const item of sessionItems) {
      if (item.countedQuantity !== null && item.countedQuantity !== undefined) {
        initialInputs[item.id] = String(item.countedQuantity);
      }
    }
    setCountInputs(initialInputs);
  };

  const handleStartNewSession = async () => {
    if (!canManage) {
      alert("You do not have permission to initiate stock count sessions.");
      return;
    }

    try {
      const newSession = await stockCountRepository.startSession(
        branchId,
        user?.id ?? "system",
        user?.displayName ?? user?.email,
        "full"
      );
      await loadSessions();
      openSessionDetail(newSession);
    } catch (err) {
      alert("Failed to start stock count session: " + (err instanceof Error ? err.message : ""));
    }
  };

  const handleItemCountChange = (itemId: string, value: string) => {
    setCountInputs((prev) => ({ ...prev, [itemId]: value }));
  };

  const handleSaveItemCount = async (item: StockCountItemSchema) => {
    const rawVal = countInputs[item.id];
    if (rawVal === undefined || rawVal === "") return;
    const parsed = parseFloat(rawVal);
    if (isNaN(parsed) || parsed < 0) return;

    setSavingItem(item.id);
    try {
      await stockCountRepository.recordCount(
        item.id,
        parsed,
        user?.id ?? "system",
        item.notes
      );
      // Refresh items
      if (activeSession) {
        const updatedItems = await stockCountRepository.getSessionItems(activeSession.id);
        setItems(updatedItems);
      }
    } catch (err) {
      console.error("Failed saving item count", err);
    } finally {
      setSavingItem(null);
    }
  };

  const handleApplySession = async () => {
    if (!activeSession) return;
    if (!confirm("Are you sure you want to approve and apply this stock count? This will generate immutable inventory ledger adjustments for all variances.")) {
      return;
    }

    try {
      await stockCountRepository.applySession(
        activeSession.id,
        user?.id ?? "system",
        user?.displayName ?? user?.email
      );
      alert("Stock count session applied successfully! Ledger adjustments created.");
      setActiveSession(null);
      loadSessions();
    } catch (err) {
      alert("Failed to apply stock count: " + (err instanceof Error ? err.message : ""));
    }
  };

  const handleCancelSession = async () => {
    if (!activeSession) return;
    if (!confirm("Cancel this stock count session? Counted data will be discarded and no adjustments will be applied.")) return;

    await stockCountRepository.cancelSession(activeSession.id, user?.id ?? "system");
    setActiveSession(null);
    loadSessions();
  };

  return (
    <div className="space-y-6">
      {/* Session Active View */}
      {activeSession ? (
        <div className="space-y-4 bg-card border rounded-xl p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold font-mono">{activeSession.sessionNumber}</h3>
                <Badge
                  variant={
                    activeSession.status === "approved"
                      ? "default"
                      : activeSession.status === "in_progress"
                      ? "outline"
                      : "secondary"
                  }
                  className="capitalize"
                >
                  {activeSession.status.replace(/_/g, " ")}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Started {new Date(activeSession.startedAt).toLocaleString()} by {activeSession.createdByName ?? activeSession.createdBy}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setActiveSession(null)}>
                Back to Sessions List
              </Button>

              {activeSession.status === "in_progress" && canManage && (
                <>
                  <Button variant="outline" size="sm" onClick={handleCancelSession} className="text-rose-600 hover:text-rose-700">
                    Cancel Session
                  </Button>
                  <Button size="sm" onClick={handleApplySession} className="bg-emerald-600 hover:bg-emerald-700">
                    <CheckCircle2 className="w-4 h-4 mr-1.5" /> Approve &amp; Reconcile
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Count Sheet Table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 border-b text-xs font-semibold text-muted-foreground uppercase">
                <tr>
                  <th className="p-3 pl-4">Product Name</th>
                  <th className="p-3">Batch Number</th>
                  <th className="p-3 text-right">System Qty (Frozen)</th>
                  <th className="p-3 text-center w-36">Physical Count</th>
                  <th className="p-3 text-right">Variance</th>
                  <th className="p-3 text-right">Variance Value</th>
                  <th className="p-3 pr-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      No items populated in this session snapshot.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const hasCounted = item.countedQuantity !== null && item.countedQuantity !== undefined;
                    const variance = item.variance ?? 0;
                    const hasDiscrepancy = hasCounted && variance !== 0;

                    return (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 pl-4">
                          <div className="font-medium">{item.productName}</div>
                          <div className="text-xs text-muted-foreground">{item.productCode}</div>
                        </td>
                        <td className="p-3 font-mono text-xs text-muted-foreground">
                          {item.batchNumber ?? "—"}
                        </td>
                        <td className="p-3 text-right font-mono font-semibold">
                          {item.systemQuantity.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">{item.baseUnit}</span>
                        </td>
                        <td className="p-3 text-center">
                          {activeSession.status === "in_progress" ? (
                            <Input
                              type="number"
                              step="any"
                              min="0"
                              placeholder="Count..."
                              value={countInputs[item.id] ?? ""}
                              onChange={(e) => handleItemCountChange(item.id, e.target.value)}
                              onBlur={() => handleSaveItemCount(item)}
                              className="h-8 text-xs text-center font-mono font-bold"
                            />
                          ) : (
                            <span className="font-mono font-bold">
                              {item.countedQuantity !== null ? item.countedQuantity : "Uncounted"}
                            </span>
                          )}
                        </td>
                        <td
                          className={`p-3 text-right font-mono font-bold text-xs ${
                            !hasCounted
                              ? "text-muted-foreground"
                              : variance > 0
                              ? "text-emerald-600"
                              : variance < 0
                              ? "text-rose-600"
                              : "text-foreground"
                          }`}
                        >
                          {hasCounted ? (variance > 0 ? `+${variance}` : variance) : "—"}
                        </td>
                        <td className="p-3 text-right font-mono text-xs">
                          {item.varianceValue !== null && item.varianceValue !== undefined ? (
                            `₦${Math.abs(item.varianceValue).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="p-3 pr-4 text-center">
                          {activeSession.status === "in_progress" && (
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleSaveItemCount(item)}
                              disabled={savingItem === item.id}
                              title="Save count"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Sessions List View */
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-muted/40 p-4 rounded-xl">
            <div>
              <h3 className="text-sm font-semibold">Stock Count &amp; Reconciliation Sessions</h3>
              <p className="text-xs text-muted-foreground">Initiate a physical stock count to reconcile system balances with actual warehouse counts.</p>
            </div>

            {canManage && (
              <Button size="sm" onClick={handleStartNewSession}>
                <Plus className="w-4 h-4 mr-2" /> Start New Stock Count
              </Button>
            )}
          </div>

          <div className="border rounded-xl bg-card overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 border-b text-xs font-semibold text-muted-foreground uppercase">
                <tr>
                  <th className="p-3 pl-4">Session Number</th>
                  <th className="p-3">Scope</th>
                  <th className="p-3">Started Date</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Variance Value</th>
                  <th className="p-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      Loading stock count history...
                    </td>
                  </tr>
                ) : sessions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No stock count sessions recorded yet. Start your first stock take above.
                    </td>
                  </tr>
                ) : (
                  sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 pl-4 font-mono font-semibold text-xs text-foreground">
                        {s.sessionNumber}
                      </td>
                      <td className="p-3 text-xs capitalize">{s.scope} Branch</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {new Date(s.startedAt).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={
                            s.status === "approved"
                              ? "default"
                              : s.status === "in_progress"
                              ? "outline"
                              : "secondary"
                          }
                          className="capitalize text-xs"
                        >
                          {s.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-mono text-xs font-semibold">
                        ₦{s.totalVarianceValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 pr-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openSessionDetail(s)}>
                          <Eye className="w-3.5 h-3.5 mr-1" /> View Sheet
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

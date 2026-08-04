import React, { useState, useEffect } from "react";
import { Search, RefreshCw, ArrowUpRight, ArrowDownRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { inventoryTransactionRepository } from "@/repositories/inventory-transaction.repository";
import { productRepository } from "@/repositories/product.repository";
import { useAuthorization } from "@/hooks/use-authorization";
import type { InventoryTransactionSchema, ProductSchema } from "@/database/schema";

interface CombinedTxnRow {
  transaction: InventoryTransactionSchema;
  product?: ProductSchema;
}

export function TransactionHistoryTable({ branchId }: { branchId?: string }) {
  const { hasPermission } = useAuthorization();
  const canViewCost = hasPermission("inventory:view_cost") || hasPermission("products:view_cost");

  const [rows, setRows] = useState<CombinedTxnRow[]>([]);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [txns, products] = await Promise.all([
        inventoryTransactionRepository.getAll({ branchId }),
        productRepository.getAll(),
      ]);

      const productMap = new Map(products.map((p) => [p.id, p]));
      const combined: CombinedTxnRow[] = txns.map((t) => ({
        transaction: t,
        product: productMap.get(t.productId),
      }));

      setRows(combined);
    } catch (err) {
      console.error("Failed loading transaction history", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [branchId]);

  const filteredRows = rows.filter(({ transaction: t, product: p }) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      t.referenceNumber.toLowerCase().includes(q) ||
      (p?.name ?? "").toLowerCase().includes(q) ||
      (p?.code ?? "").toLowerCase().includes(q) ||
      (t.performedByName ?? "").toLowerCase().includes(q);

    const matchesType = selectedType === "all" || t.type === selectedType;

    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 bg-muted/40 p-3 rounded-xl">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search reference, product, user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="h-10 px-3 py-2 text-sm rounded-md border border-input bg-background"
          >
            <option value="all">All Transaction Types</option>
            <option value="opening_stock">Opening Stock</option>
            <option value="stock_adjustment">Stock Adjustment</option>
            <option value="stock_count">Stock Count</option>
          </select>
        </div>

        <Button variant="ghost" size="icon" onClick={loadData}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Ledger Table */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 border-b text-xs font-semibold text-muted-foreground uppercase">
            <tr>
              <th className="p-3 pl-4">Date / Ref</th>
              <th className="p-3">Product Name</th>
              <th className="p-3">Type</th>
              <th className="p-3 text-right">Quantity</th>
              <th className="p-3">Base Unit</th>
              {canViewCost && <th className="p-3 text-right">Unit Cost</th>}
              {canViewCost && <th className="p-3 text-right">Total Cost</th>}
              <th className="p-3">Performed By</th>
              <th className="p-3 pr-4">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted-foreground">
                  Loading ledger transactions...
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted-foreground">
                  No inventory transactions recorded yet.
                </td>
              </tr>
            ) : (
              filteredRows.map(({ transaction: t, product: p }) => {
                const isPositive = t.quantity > 0;
                const formattedDate = new Date(t.timestamp).toLocaleString();

                return (
                  <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 pl-4 font-mono text-xs">
                      <div className="font-semibold text-foreground">{t.referenceNumber}</div>
                      <div className="text-muted-foreground">{formattedDate}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{p?.name ?? "Unknown Product"}</div>
                      <div className="text-xs text-muted-foreground">{p?.code ?? ""}</div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="capitalize text-xs font-normal">
                        {t.type.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td
                      className={`p-3 text-right font-mono font-bold ${
                        isPositive
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      <div className="flex items-center justify-end gap-1">
                        {isPositive ? (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowDownRight className="w-3.5 h-3.5" />
                        )}
                        {isPositive ? `+${t.quantity.toLocaleString()}` : t.quantity.toLocaleString()}
                      </div>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{t.baseUnit}</td>
                    {canViewCost && (
                      <td className="p-3 text-right font-mono text-xs">
                        ₦{t.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    )}
                    {canViewCost && (
                      <td className="p-3 text-right font-mono font-medium">
                        ₦{Math.abs(t.quantity * t.unitCost).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    )}
                    <td className="p-3 text-xs">{t.performedByName ?? t.performedBy}</td>
                    <td className="p-3 pr-4 text-xs text-muted-foreground max-w-xs truncate">
                      {t.notes ?? "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

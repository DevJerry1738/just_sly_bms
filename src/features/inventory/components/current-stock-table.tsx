import { useEffect, useState } from "react";
import { Search, RefreshCw, AlertTriangle, XCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthorization } from "@/hooks/use-authorization";
import { useInventory } from "@/hooks/use-inventory";
import type { InventoryItem } from "@/services/inventory/inventory.service";

export function CurrentStockTable({ branchId }: { branchId?: string }) {
  const { hasPermission } = useAuthorization();
  const canViewCost = hasPermission("inventory:view_cost") || hasPermission("products:view_cost");

  const { items, categories, isLoading, refresh } = useInventory(branchId);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  const filteredRows = items.filter((row) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      row.name.toLowerCase().includes(q) ||
      row.productCode.toLowerCase().includes(q) ||
      (row.barcode ?? "").toLowerCase().includes(q);

    const matchesCategory = selectedCategory === "all" || row.category?.id === selectedCategory;

    let status = "ok";
    if (row.currentStock <= 0) status = "out_of_stock";
    else if (row.currentStock < 10) status = "low_stock";

    const matchesStatus = selectedStatus === "all" || selectedStatus === status;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 bg-muted/40 p-3 rounded-xl">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search stock by product, SKU, code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-10 px-3 py-2 text-sm rounded-md border border-input bg-background"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-10 px-3 py-2 text-sm rounded-md border border-input bg-background"
          >
            <option value="all">All Stock Statuses</option>
            <option value="ok">In Stock</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
        </div>

        <Button variant="ghost" size="icon" onClick={() => void refresh()}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Stock Table */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 border-b text-xs font-semibold text-muted-foreground uppercase">
            <tr>
              <th className="p-3 pl-4">Product Code / SKU</th>
              <th className="p-3">Product Name</th>
              <th className="p-3">Category</th>
              <th className="p-3 text-right">Available Qty</th>
              <th className="p-3 text-right">Reserved Qty</th>
              <th className="p-3 text-right">Reorder Threshold</th>
              {canViewCost && <th className="p-3 text-right">Avg Unit Cost</th>}
              {canViewCost && <th className="p-3 text-right">Total Cost Value</th>}
              <th className="p-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted-foreground">
                  Loading stock balances...
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted-foreground">
                  No inventory balances found. Record opening stock or stock adjustments to get started.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const threshold = row.reorderThreshold ?? 0;
                const isOutOfStock = row.currentStock <= 0;
                const isLowStock = !isOutOfStock && threshold > 0 && row.currentStock < threshold;

                return (
                  <tr key={row.productId} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 pl-4 font-mono text-xs">
                      <div className="font-semibold text-foreground">{row.productCode}</div>
                      {row.barcode && <div className="text-muted-foreground">{row.barcode}</div>}
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{row.name}</div>
                      <div className="text-xs text-muted-foreground">Base: {row.unit?.name ?? "Piece"}</div>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {row.category ? row.category.name : "—"}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-base">
                      {row.currentStock.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">{row.unit?.name ?? "Piece"}</span>
                    </td>
                    <td className="p-3 text-right font-mono text-xs text-muted-foreground">
                      {row.reservedStock}
                    </td>
                    <td className="p-3 text-right font-mono text-xs text-muted-foreground">
                      {threshold}
                    </td>
                    {canViewCost && (
                      <td className="p-3 text-right font-mono text-xs">
                        ₦{row.costPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    )}
                    {canViewCost && (
                      <td className="p-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        ₦{(row.currentStock * row.costPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    )}
                    <td className="p-3 text-center">
                      {isOutOfStock ? (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="w-3 h-3" /> Out of Stock
                        </Badge>
                      ) : isLowStock ? (
                        <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="w-3 h-3" /> Low Stock
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0">
                          <CheckCircle2 className="w-3 h-3" /> In Stock
                        </Badge>
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
  );
}

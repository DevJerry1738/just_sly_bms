import React, { useState, useEffect } from "react";
import { Search, RefreshCw, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { inventoryBatchRepository } from "@/repositories/inventory-batch.repository";
import { productRepository } from "@/repositories/product.repository";
import type { InventoryBatchSchema, ProductSchema } from "@/database/schema";

interface ExpiringRow {
  batch: InventoryBatchSchema;
  product?: ProductSchema;
  daysRemaining: number;
}

export function ExpiryReport({ branchId }: { branchId?: string }) {
  const [rows, setRows] = useState<ExpiringRow[]>([]);
  const [daysFilter, setDaysFilter] = useState("30");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const days = parseInt(daysFilter, 10);
      const batches = await inventoryBatchRepository.getExpiringBatches(days, branchId);
      const expiredBatches = await inventoryBatchRepository.getExpiredBatches(branchId);
      const allBatches = [...expiredBatches, ...batches];

      const products = await productRepository.getAll();
      const productMap = new Map(products.map((p) => [p.id, p]));

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const combined: ExpiringRow[] = allBatches.map((b) => {
        const target = new Date(b.expiryDate!);
        const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);
        return {
          batch: b,
          product: productMap.get(b.productId),
          daysRemaining: diffDays,
        };
      });

      // Sort by days remaining ASC (expired first)
      combined.sort((a, b) => a.daysRemaining - b.daysRemaining);

      setRows(combined);
    } catch (err) {
      console.error("Failed loading expiry report", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [branchId, daysFilter]);

  const filteredRows = rows.filter(({ batch: b, product: p }) => {
    const q = search.toLowerCase();
    return (
      !q ||
      b.batchNumber.toLowerCase().includes(q) ||
      (p?.name ?? "").toLowerCase().includes(q) ||
      (p?.code ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 bg-muted/40 p-3 rounded-xl">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search expiring batch or product..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>

          <select
            value={daysFilter}
            onChange={(e) => setDaysFilter(e.target.value)}
            className="h-10 px-3 py-2 text-sm rounded-md border border-input bg-background"
          >
            <option value="7">Expiring within 7 Days</option>
            <option value="30">Expiring within 30 Days</option>
            <option value="60">Expiring within 60 Days</option>
            <option value="90">Expiring within 90 Days</option>
          </select>
        </div>

        <Button variant="ghost" size="icon" onClick={loadData}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Report Table */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 border-b text-xs font-semibold text-muted-foreground uppercase">
            <tr>
              <th className="p-3 pl-4">Product Name</th>
              <th className="p-3">Batch Number</th>
              <th className="p-3 text-right">Quantity Affected</th>
              <th className="p-3">Expiry Date</th>
              <th className="p-3 text-center">Days Remaining</th>
              <th className="p-3 text-center">Urgency</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  Evaluating batch expiration timelines...
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  No batches expiring within the selected timeline ({daysFilter} days).
                </td>
              </tr>
            ) : (
              filteredRows.map(({ batch: b, product: p, daysRemaining }) => {
                const isExpired = daysRemaining < 0;
                const isUrgent = !isExpired && daysRemaining <= 7;

                return (
                  <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 pl-4">
                      <div className="font-medium">{p?.name ?? "Unknown Product"}</div>
                      <div className="text-xs text-muted-foreground">{p?.code ?? ""}</div>
                    </td>
                    <td className="p-3 font-mono font-semibold text-xs text-foreground">
                      {b.batchNumber}
                    </td>
                    <td className="p-3 text-right font-mono font-bold">
                      {b.quantityOnHand.toLocaleString()}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        {p?.baseUnit ?? "pcs"}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-xs text-foreground">
                      {b.expiryDate}
                    </td>
                    <td className="p-3 text-center font-mono font-semibold">
                      {isExpired ? (
                        <span className="text-rose-600 dark:text-rose-400">
                          Expired ({Math.abs(daysRemaining)}d ago)
                        </span>
                      ) : (
                        <span>{daysRemaining} day(s)</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {isExpired ? (
                        <Badge variant="destructive">Expired</Badge>
                      ) : isUrgent ? (
                        <Badge variant="outline" className="border-rose-500 text-rose-600 dark:text-rose-400">
                          Critical (≤7d)
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">
                          Warning
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

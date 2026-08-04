import React, { useState, useEffect } from "react";
import { Search, RefreshCw, Calendar, Tag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { inventoryBatchRepository } from "@/repositories/inventory-batch.repository";
import { productRepository } from "@/repositories/product.repository";
import type { InventoryBatchSchema, ProductSchema } from "@/database/schema";

interface CombinedBatchRow {
  batch: InventoryBatchSchema;
  product?: ProductSchema;
}

export function BatchManager({ branchId }: { branchId?: string }) {
  const [rows, setRows] = useState<CombinedBatchRow[]>([]);
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const allBatches = await inventoryBatchRepository.getAll();
      const batches = branchId
        ? allBatches.filter((b) => !b.branchId || b.branchId === branchId)
        : allBatches;
      const products = await productRepository.getAll();

      const productMap = new Map(products.map((p) => [p.id, p]));
      const combined: CombinedBatchRow[] = batches.map((b) => ({
        batch: b,
        product: productMap.get(b.productId),
      }));

      setRows(combined);
    } catch (err) {
      console.error("Failed loading batches", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCleanDuplicates = async () => {
    const allBatches = await inventoryBatchRepository.getAll();
    const seen = new Map<string, string>(); // key -> id to keep
    const duplicateIdsToDelete: string[] = [];

    // Sort by createdAt descending so we keep the newest batch record
    const sorted = [...allBatches].sort((a, b) => b.createdAt - a.createdAt);

    for (const b of sorted) {
      // Group by Product ID and Branch ID
      const key = `${b.productId}::${b.branchId}`;
      if (seen.has(key)) {
        duplicateIdsToDelete.push(b.id);
      } else {
        seen.set(key, b.id);
      }
    }

    if (duplicateIdsToDelete.length === 0) {
      alert("No duplicate batches found.");
      return;
    }

    for (const id of duplicateIdsToDelete) {
      await inventoryBatchRepository.delete(id);
    }

    alert(`Successfully removed ${duplicateIdsToDelete.length} duplicate batch record(s).`);
    await loadData();
  };

  useEffect(() => {
    loadData();
  }, [branchId]);

  const filteredRows = rows.filter(({ batch: b, product: p }) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      b.batchNumber.toLowerCase().includes(q) ||
      (p?.name ?? "").toLowerCase().includes(q) ||
      (p?.code ?? "").toLowerCase().includes(q);

    const matchesStatus = selectedStatus === "all" || b.status === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* Search & Status Bar */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 bg-muted/40 p-3 rounded-xl">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by batch number or product name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-10 px-3 py-2 text-sm rounded-md border border-input bg-background"
          >
            <option value="all">All Batch Statuses</option>
            <option value="active">Active</option>
            <option value="depleted">Depleted</option>
            <option value="expired">Expired</option>
            <option value="quarantined">Quarantined</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCleanDuplicates} title="Remove duplicate batches">
            Clean Duplicates
          </Button>
          <Button variant="ghost" size="icon" onClick={loadData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Batches Table */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 border-b text-xs font-semibold text-muted-foreground uppercase">
            <tr>
              <th className="p-3 pl-4">Batch Number</th>
              <th className="p-3">Product Name</th>
              <th className="p-3 text-right">Qty Remaining</th>
              <th className="p-3 text-right">Initial Qty</th>
              <th className="p-3">Manufacture Date</th>
              <th className="p-3">Expiry Date</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 pr-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  Loading product batches...
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  No active product batches found.
                </td>
              </tr>
            ) : (
              filteredRows.map(({ batch: b, product: p }) => (
                <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3 pl-4 font-mono font-semibold text-xs text-foreground">
                    {b.batchNumber}
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{p?.name ?? "Unknown Product"}</div>
                    <div className="text-xs text-muted-foreground">{p?.code ?? ""}</div>
                  </td>
                  <td className="p-3 text-right font-mono font-bold">
                    {b.quantityOnHand.toLocaleString()}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      {p?.baseUnit ?? "pcs"}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono text-xs text-muted-foreground">
                    {b.initialQuantity.toLocaleString()}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {b.manufactureDate ?? "—"}
                  </td>
                  <td className="p-3 text-xs font-mono">
                    {b.expiryDate ? (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        {b.expiryDate}
                      </span>
                    ) : (
                      "No Expiry"
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <Badge
                      variant={
                        b.status === "active"
                          ? "default"
                          : b.status === "expired"
                          ? "destructive"
                          : "secondary"
                      }
                      className="capitalize"
                    >
                      {b.status}
                    </Badge>
                  </td>
                  <td className="p-3 pr-4 text-right">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={async () => {
                        if (confirm(`Delete batch ${b.batchNumber}?`)) {
                          await inventoryBatchRepository.delete(b.id);
                          await loadData();
                        }
                      }}
                      className="text-muted-foreground hover:text-rose-600"
                      title="Delete Batch"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

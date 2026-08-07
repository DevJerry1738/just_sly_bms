import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { productRepository } from "@/repositories/product.repository";
import { productPackagingRepository } from "@/repositories/product-packaging.repository";
import { inventoryAdjustmentRepository } from "@/repositories/inventory-adjustment.repository";
import { inventoryBatchRepository } from "@/repositories/inventory-batch.repository";
import { inventoryConversionService } from "@/services/inventory/inventory-conversion.service";
import { useAuth } from "@/providers/auth-provider";
import type { ProductSchema, ProductPackagingSchema, AdjustmentReason } from "@/database/schema";

interface AdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  branchId: string;
}

const ADJUSTMENT_REASONS: { value: AdjustmentReason; label: string }[] = [
  { value: "stock_count_correction", label: "Stock Count Correction" },
  { value: "damaged_goods", label: "Damaged Goods (Deduct)" },
  { value: "expired_goods", label: "Expired Goods (Deduct)" },
  { value: "lost_stock", label: "Lost Stock (Deduct)" },
  { value: "promotional_giveaway", label: "Promotional Giveaway (Deduct)" },
  { value: "manual_correction", label: "Manual Correction" },
  { value: "other", label: "Other Reason" },
];

export function AdjustmentModal({ isOpen, onClose, onSuccess, branchId }: AdjustmentModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<ProductSchema[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductSchema | null>(null);
  const [packagings, setPackagings] = useState<ProductPackagingSchema[]>([]);

  // Form fields
  const [adjustmentType, setAdjustmentType] = useState<"add" | "deduct">("add");
  const [quantity, setQuantity] = useState("");
  const [packagingLabel, setPackagingLabel] = useState("");
  const [manufactureDate, setManufactureDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [reason, setReason] = useState<AdjustmentReason>("stock_count_correction");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    async function loadProducts() {
      const active = (await productRepository.getAll()).filter((p) => p.status === "active");
      setProducts(active);
    }

    loadProducts();
    resetForm();
  }, [isOpen]);

  useEffect(() => {
    if (!selectedProductId) {
      setSelectedProduct(null);
      setPackagings([]);
      return;
    }

    async function onProductSelected() {
      const p = await productRepository.getById(selectedProductId);
      if (p) {
        setSelectedProduct(p);
        const pkgs = await productPackagingRepository.getPackagingForProduct(p.id);
        setPackagings(pkgs);
      }
    }

    onProductSelected();
  }, [selectedProductId]);

  const resetForm = () => {
    setSelectedProductId("");
    setSelectedProduct(null);
    setPackagings([]);
    setAdjustmentType("add");
    setQuantity("");
    setPackagingLabel("");
    setManufactureDate("");
    setExpiryDate("");
    setReason("stock_count_correction");
    setNotes("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      alert("Please select a product.");
      return;
    }

    const rawQty = parseFloat(quantity);
    if (isNaN(rawQty) || rawQty <= 0) {
      alert("Please enter a valid positive quantity.");
      return;
    }

    if (adjustmentType === "add" && selectedProduct.trackExpiry && !expiryDate) {
      alert("Expiry date is required for products that track expiry.");
      return;
    }

    setLoading(true);
    try {
      const baseUnitsQty = await inventoryConversionService.convertToBaseUnits(
        selectedProduct.id,
        rawQty,
        packagingLabel || undefined
      );

      const finalSignedQty = adjustmentType === "add" ? baseUnitsQty : -baseUnitsQty;
      let batchId: string | null | undefined = undefined;

      if (adjustmentType === "add" && (selectedProduct.trackExpiry || manufactureDate || expiryDate)) {
        const batch = await inventoryBatchRepository.createBatch({
          productId: selectedProduct.id,
          branchId,
          initialQuantity: baseUnitsQty,
          quantityOnHand: baseUnitsQty,
          manufactureDate: manufactureDate || undefined,
          expiryDate: expiryDate || undefined,
          unitCost: selectedProduct.costPrice || 0,
          notes: notes.trim() || undefined,
          createdBy: user?.id ?? "system",
        });
        batchId = batch.id;
      }

      await inventoryAdjustmentRepository.createAdjustment({
        productId: selectedProduct.id,
        branchId,
        quantity: finalSignedQty,
        baseUnit: selectedProduct.baseUnit,
        unitCost: selectedProduct.costPrice || 0,
        reason,
        notes: notes.trim() || undefined,
        batchId,
        performedBy: user?.id ?? "system",
        performedByName: user?.displayName ?? user?.email,
      });

      onSuccess();
      onClose();
    } catch (err) {
      alert("Failed to adjust inventory: " + (err instanceof Error ? err.message : ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Stock Adjustment</DialogTitle>
          <DialogDescription>Record a positive or negative stock adjustment with an auditable reason.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Select Product */}
          <div className="space-y-1.5">
            <Label htmlFor="adj-product">Select Product *</Label>
            <select
              id="adj-product"
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background"
              required
            >
              <option value="">-- Choose Product --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          {selectedProduct && (
            <>
              {/* Type: Add vs Deduct */}
              <div className="space-y-1.5">
                <Label>Adjustment Direction *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={adjustmentType === "add" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAdjustmentType("add")}
                    className={adjustmentType === "add" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                  >
                    + Stock Addition
                  </Button>
                  <Button
                    type="button"
                    variant={adjustmentType === "deduct" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAdjustmentType("deduct")}
                    className={adjustmentType === "deduct" ? "bg-rose-600 hover:bg-rose-700" : ""}
                  >
                    − Stock Deduction
                  </Button>
                </div>
              </div>

              {/* Quantity & Packaging */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="adj-qty">Quantity *</Label>
                  <Input
                    id="adj-qty"
                    type="number"
                    step="any"
                    min="0.001"
                    placeholder="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="adj-pkg">Packaging Unit</Label>
                  <select
                    id="adj-pkg"
                    value={packagingLabel}
                    onChange={(e) => setPackagingLabel(e.target.value)}
                    className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background"
                  >
                    <option value="">{selectedProduct.baseUnit} (Base)</option>
                    {packagings.map((pkg) => (
                      <option key={pkg.id} value={pkg.label}>
                        {pkg.label} ({pkg.unitsPerPackage} {selectedProduct.baseUnit}s)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {(adjustmentType === "add" || selectedProduct.trackExpiry) && (
                <div className="p-3 bg-muted/30 border rounded-lg space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Batch Details
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="adj-manufacture">Manufacture Date</Label>
                      <Input
                        id="adj-manufacture"
                        type="date"
                        value={manufactureDate}
                        onChange={(e) => setManufactureDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="adj-expiry">Expiry Date</Label>
                      <Input
                        id="adj-expiry"
                        type="date"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Reason */}
              <div className="space-y-1.5">
                <Label htmlFor="adj-reason">Reason Code *</Label>
                <select
                  id="adj-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value as AdjustmentReason)}
                  className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background"
                  required
                >
                  {ADJUSTMENT_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="adj-notes">Supporting Notes</Label>
                <Input
                  id="adj-notes"
                  placeholder="Provide audit context or incident details..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </>
          )}

          <DialogFooter className="pt-4 border-t">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !selectedProduct}>
              {loading ? "Saving..." : "Submit Adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

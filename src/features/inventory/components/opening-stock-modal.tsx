import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { productRepository } from "@/repositories/product.repository";
import { productPackagingRepository } from "@/repositories/product-packaging.repository";
import { inventoryBatchRepository } from "@/repositories/inventory-batch.repository";
import { inventoryBalanceRepository } from "@/repositories/inventory-balance.repository";
import { inventoryTransactionRepository } from "@/repositories/inventory-transaction.repository";
import { inventoryConversionService } from "@/services/inventory/inventory-conversion.service";
import { useAuth } from "@/providers/auth-provider";
import type { ProductSchema, ProductPackagingSchema } from "@/database/schema";

interface OpeningStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  branchId: string;
}

export function OpeningStockModal({ isOpen, onClose, onSuccess, branchId }: OpeningStockModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<ProductSchema[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductSchema | null>(null);
  const [packagings, setPackagings] = useState<ProductPackagingSchema[]>([]);

  // Form State
  const [quantity, setQuantity] = useState("");
  const [packagingLabel, setPackagingLabel] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [manufactureDate, setManufactureDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    async function loadProducts() {
      const activeProducts = (await productRepository.getAll()).filter((p) => p.status === "active");
      const branchBalances = await inventoryBalanceRepository.getByBranch(branchId);
      const existingProductIds = new Set(branchBalances.map((b) => b.productId));
      const availableProducts = activeProducts.filter((product) => !existingProductIds.has(product.id));
      setProducts(availableProducts);
    }

    loadProducts();
    resetForm();
  }, [isOpen, branchId]);

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
        setUnitCost(p.costPrice ? String(p.costPrice) : "");
        setManufactureDate("");
        setExpiryDate("");
        setBatchNumber("");
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
    setQuantity("");
    setPackagingLabel("");
    setUnitCost("");
    setBatchNumber("");
    setManufactureDate("");
    setExpiryDate("");
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

    const enteredCost = unitCost.trim() !== "" ? Number.parseFloat(unitCost) : NaN;
    const cost = Number.isFinite(enteredCost)
      ? enteredCost
      : selectedProduct.costPrice ?? null;

    setLoading(true);
    try {
      // Convert to base units
      const baseUnitsQty = await inventoryConversionService.convertToBaseUnits(
        selectedProduct.id,
        rawQty,
        packagingLabel || undefined
      );

      let createdBatchId: string | undefined = undefined;

      // Always create a batch record for opening stock to enable batch/FIFO tracking
      const batch = await inventoryBatchRepository.createBatch({
        productId: selectedProduct.id,
        branchId,
        initialQuantity: baseUnitsQty,
        quantityOnHand: baseUnitsQty,
        manufactureDate: manufactureDate || undefined,
        expiryDate: expiryDate || undefined,
        unitCost: cost,
        notes: notes.trim() || undefined,
        createdBy: user?.id ?? "system",
      });
      createdBatchId = batch.id;

      // Record Opening Stock ledger transaction
      await inventoryTransactionRepository.recordTransaction({
        type: "opening_stock",
        productId: selectedProduct.id,
        branchId,
        quantity: baseUnitsQty,
        baseUnit: selectedProduct.baseUnit,
        unitCost: cost,
        batchId: createdBatchId,
        notes: notes.trim() || undefined,
        performedBy: user?.id ?? "system",
        performedByName: user?.displayName ?? user?.email,
      });

      onSuccess();
      onClose();
    } catch (err) {
      alert("Failed to record opening stock: " + (err instanceof Error ? err.message : ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Opening Stock</DialogTitle>
          <DialogDescription>Initialize opening balances for products at this branch.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Select Product */}
          <div className="space-y-1.5">
            <Label htmlFor="op-product">Select Product *</Label>
            <select
              id="op-product"
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
            {products.length === 0 && (
              <p className="text-xs text-muted-foreground">
                All active products already have opening stock for this branch. Use stock adjustments to update an existing balance.
              </p>
            )}
          </div>

          {selectedProduct && (
            <>
              {/* Quantity & Packaging */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="op-qty">Quantity *</Label>
                  <Input
                    id="op-qty"
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
                  <Label htmlFor="op-pkg">Packaging Unit</Label>
                  <select
                    id="op-pkg"
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

              {/* Unit Cost */}
              <div className="space-y-1.5">
                <Label htmlFor="op-cost">Unit Cost Price (₦)</Label>
                <Input
                  id="op-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                />
              </div>

              {/* Batch & Expiry Settings */}
              {(selectedProduct.trackExpiry || packagings.length > 0) && (
                <div className="p-3 bg-muted/30 border rounded-lg space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Batch &amp; Expiry Configuration
                  </h4>
                  <div className="space-y-1.5">
                    <Label htmlFor="op-batch">Batch Number (Optional)</Label>
                    <Input
                      id="op-batch"
                      placeholder="Auto-generated if left blank"
                      value={batchNumber}
                      onChange={(e) => setBatchNumber(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="op-manufacture">Manufacture Date</Label>
                    <Input
                      id="op-manufacture"
                      type="date"
                      value={manufactureDate}
                      onChange={(e) => setManufactureDate(e.target.value)}
                    />
                  </div>

                  {selectedProduct.trackExpiry && (
                    <div className="space-y-1.5">
                      <Label htmlFor="op-expiry">Expiration Date *</Label>
                      <Input
                        id="op-expiry"
                        type="date"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        required={selectedProduct.trackExpiry}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="op-notes">Notes (Optional)</Label>
                <Input
                  id="op-notes"
                  placeholder="Opening inventory notes..."
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
              {loading ? "Recording..." : "Save Opening Stock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

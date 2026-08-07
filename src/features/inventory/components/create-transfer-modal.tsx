"use client";

import { useState, type FormEvent } from "react";
import { createTransfer } from "../transfer.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useBranch } from "@/providers/branch-provider";
import { useInventory } from "@/hooks/use-inventory";
import { productPackagingRepository } from "@/repositories/product-packaging.repository";
import type { CreateTransferItem } from "../schemas/transfer.schema";
import type { ProductPackagingSchema } from "@/database/schema";

interface CreateTransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transferType: "hq_supply" | "branch_transfer";
  sourceBranchId: string;
  onSuccess?: (transferId: string) => void;
}

export function CreateTransferModal({
  open,
  onOpenChange,
  transferType,
  sourceBranchId,
  onSuccess,
}: CreateTransferModalProps) {
  const { branches } = useBranch();
  const { items: inventoryItems } = useInventory(sourceBranchId);
  const availableDestinationBranches = branches.filter(
    (branch) => branch.status === "active" && branch.id !== sourceBranchId,
  );
  const [step, setStep] = useState<1 | 2>(1);
  const [destinationBranch, setDestinationBranch] = useState("");
  const [notes, setNotes] = useState("");
  const [expectedArrival, setExpectedArrival] = useState("");
  const [items, setItems] = useState<CreateTransferItem[]>([]);
  const [productSearch, setProductSearch] = useState<string[]>([]);
  const [packagingOptions, setPackagingOptions] = useState<ProductPackagingSchema[][]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        productId: "",
        quantityInPackaging: 1,
        convertedBaseQuantity: 0,
        unitCostSnapshot: 0,
        manufactureDate: "",
        expiryDate: "",
      },
    ]);
    setProductSearch([...productSearch, ""]);
    setPackagingOptions([...packagingOptions, []]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
    setProductSearch(productSearch.filter((_, i) => i !== index));
    setPackagingOptions(packagingOptions.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof CreateTransferItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === "quantityInPackaging" || field === "packagingUnit") {
      const item = newItems[index];
      const quantity = field === "quantityInPackaging" ? Number(value) : item.quantityInPackaging;
      const packagingUnit = field === "packagingUnit" ? String(value) : item.packagingUnit;
      const convertedBaseQuantity = computeBaseQuantity(index, item.productId, quantity, packagingUnit);
      newItems[index].convertedBaseQuantity = convertedBaseQuantity;
    }

    setItems(newItems);
  };

  const handleProductSearchChange = (index: number, value: string) => {
    const nextSearch = [...productSearch];
    nextSearch[index] = value;
    setProductSearch(nextSearch);
  };

  const computeBaseQuantity = (
    index: number,
    productId: string,
    quantityInPackaging: number,
    packagingUnit?: string
  ) => {
    const product = inventoryItems.find((item) => item.productId === productId);
    if (!product) return quantityInPackaging;

    const baseUnitLabel = product.unit?.abbreviation ?? product.unit?.name ?? "piece";
    const selectedPackaging = packagingUnit?.trim() || baseUnitLabel;

    if (selectedPackaging.toLowerCase() === baseUnitLabel.toLowerCase()) {
      return quantityInPackaging;
    }

    const levels = packagingOptions[index] ?? [];
    const level = levels.find(
      (pkg) => pkg.label.toLowerCase() === selectedPackaging.toLowerCase(),
    );

    return level ? quantityInPackaging * level.unitsPerPackage : quantityInPackaging;
  };

  const handleSelectProduct = async (index: number, product: typeof inventoryItems[number]) => {
    const nextItems = [...items];
    const nextSearch = [...productSearch];
    const nextPackaging = [...packagingOptions];

    const packagingLevels = await productPackagingRepository.getPackagingForProduct(product.productId);
    nextPackaging[index] = packagingLevels;

    const defaultPackagingUnit = product.unit?.abbreviation ?? product.unit?.name ?? "piece";

    nextItems[index] = {
      ...nextItems[index],
      productId: product.productId,
      quantityInPackaging: 1,
      packagingUnit: defaultPackagingUnit,
      convertedBaseQuantity: 1,
      unitCostSnapshot: product.costPrice,
    };

    nextSearch[index] = "";
    setItems(nextItems);
    setProductSearch(nextSearch);
    setPackagingOptions(nextPackaging);
  };

  const getMatchingProducts = (query: string) => {
    const normalizedQuery = query.trim().toLowerCase();
    return inventoryItems
      .filter((product) => product.availableStock > 0)
      .filter((product) => {
        if (!normalizedQuery) return true;
        return (
          product.name.toLowerCase().includes(normalizedQuery) ||
          product.productCode.toLowerCase().includes(normalizedQuery) ||
          (product.barcode ?? "").toLowerCase().includes(normalizedQuery)
        );
      })
      .slice(0, 10);
  };

  const resetForm = () => {
    setStep(1);
    setDestinationBranch("");
    setNotes("");
    setExpectedArrival("");
    setItems([]);
    setProductSearch([]);
    setPackagingOptions([]);
    setError(null);
    setLoading(false);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  const handleNext = () => {
    if (!destinationBranch.trim()) {
      setError("Destination branch is required");
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleBack = () => {
    setError(null);
    setStep(1);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (step === 1) {
      handleNext();
      return;
    }

    if (items.length === 0) {
      setError("At least one item is required");
      return;
    }

    setLoading(true);

    try {
      const result = await createTransfer({
        data: {
          transfer: {
            transferType,
            sourceBranchId,
            destinationBranchId: destinationBranch,
            notes: notes || undefined,
            expectedArrivalDate: expectedArrival ? new Date(expectedArrival).toISOString() : undefined,
          },
          items,
        },
      });

      if (result.success && result.data) {
        handleDialogOpenChange(false);
        onSuccess?.(result.data.id);
        resetForm();
      } else if (!result.success) {
        setError(result.error || "Failed to create transfer");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create transfer");
    } finally {
      setLoading(false);
    }
  };

  const currentStepLabel = step === 1 ? "Transfer details" : "Items & review";
  const canAdvance = destinationBranch.trim().length > 0;
  const itemCount = items.length;
  const totalQuantity = items.reduce((sum, item) => sum + item.convertedBaseQuantity, 0);
  const totalValue = items.reduce(
    (sum, item) => sum + item.convertedBaseQuantity * item.unitCostSnapshot,
    0
  );

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="space-y-2">
            <DialogTitle>
              Create {transferType === "hq_supply" ? "Supply" : "Transfer"}
            </DialogTitle>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className={step === 1 ? "font-semibold text-slate-900" : ""}>1. Details</span>
              <span>•</span>
              <span className={step === 2 ? "font-semibold text-slate-900" : ""}>2. Items</span>
            </div>
            <p className="text-sm text-slate-600">{currentStepLabel}</p>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {step === 1 ? (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Basic Information</h3>

              <div>
                <Label htmlFor="destination">Destination Branch *</Label>
                <Select value={destinationBranch} onValueChange={setDestinationBranch}>
                  <SelectTrigger id="destination" className="w-full">
                    <SelectValue placeholder="Select destination branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDestinationBranches.length === 0 ? (
                      <SelectItem value="" disabled>
                        No active branches available
                      </SelectItem>
                    ) : (
                      availableDestinationBranches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name} ({branch.code})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="expected-arrival">Expected Arrival Date (Optional)</Label>
                <Input
                  id="expected-arrival"
                  type="date"
                  value={expectedArrival}
                  onChange={(e) => setExpectedArrival(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any additional notes..."
                  rows={3}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Transfer items</h3>
                  <p className="text-sm text-slate-600">
                    Add products and quantities for the transfer.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Item
                </Button>
              </div>

              {items.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded border border-dashed border-slate-200">
                  <p className="text-sm text-slate-600">No items added yet</p>
                  <Button type="button" variant="ghost" size="sm" onClick={handleAddItem} className="mt-2">
                    Add Item
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="p-4 border rounded bg-white grid gap-4 md:grid-cols-[1.8fr_1fr_1fr_0.8fr_auto]">
                      <div className="space-y-2">
                        <Label htmlFor={`product-${index}`} className="text-xs">
                          Product *
                        </Label>
                        <div className="relative">
                          <Input
                            id={`product-${index}`}
                            value={
                              productSearch[index] ||
                              (inventoryItems.find((product) => product.productId === item.productId)
                                ? `${inventoryItems.find((product) => product.productId === item.productId)?.name} (${inventoryItems.find((product) => product.productId === item.productId)?.productCode})`
                                : "")
                            }
                            onChange={(e) => handleProductSearchChange(index, e.target.value)}
                            placeholder="Search inventory product"
                            required
                          />
                          {productSearch[index] ? (
                            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded border bg-white shadow-lg">
                              {getMatchingProducts(productSearch[index]).map((product) => (
                                <button
                                  key={product.productId}
                                  type="button"
                                  onClick={() => handleSelectProduct(index, product)}
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100"
                                >
                                  <div className="font-medium">{product.name}</div>
                                  <div className="text-xs text-slate-500">{product.productCode} • {product.availableStock} available</div>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`packaging-${index}`} className="text-xs">
                          Packaging Unit
                        </Label>
                        <Select
                          value={item.packagingUnit ?? ""}
                          onValueChange={(value) => handleItemChange(index, "packagingUnit", value)}
                        >
                          <SelectTrigger id={`packaging-${index}`} className="w-full">
                            <SelectValue placeholder="Select packaging" />
                          </SelectTrigger>
                          <SelectContent>
                            {(() => {
                              const selectedProduct = inventoryItems.find(
                                (product) => product.productId === item.productId,
                              );
                              const baseUnitLabel =
                                selectedProduct?.unit?.abbreviation ?? selectedProduct?.unit?.name ?? "piece";

                              return (
                                <>
                                  <SelectItem value={baseUnitLabel}>
                                    {baseUnitLabel} (Base)
                                  </SelectItem>
                                  {(packagingOptions[index] ?? []).map((pkg) => (
                                    <SelectItem key={pkg.id} value={pkg.label}>
                                      {pkg.label} ({pkg.unitsPerPackage} {baseUnitLabel}s)
                                    </SelectItem>
                                  ))}
                                </>
                              );
                            })()}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`quantity-${index}`} className="text-xs">
                          Quantity *
                        </Label>
                        <Input
                          id={`quantity-${index}`}
                          type="number"
                          min="0"
                          step="any"
                          value={item.quantityInPackaging}
                          onChange={(e) => handleItemChange(index, "quantityInPackaging", parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Base Qty</Label>
                        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          {item.convertedBaseQuantity}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Unit Cost</Label>
                        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          ₦{item.unitCostSnapshot.toFixed(2)}
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded">
                <div className="rounded border border-slate-200 p-3">
                  <p className="text-xs text-slate-500 uppercase">Items</p>
                  <p className="text-xl font-semibold">{itemCount}</p>
                </div>
                <div className="rounded border border-slate-200 p-3">
                  <p className="text-xs text-slate-500 uppercase">Total Quantity</p>
                  <p className="text-xl font-semibold">{totalQuantity}</p>
                </div>
                <div className="rounded border border-slate-200 p-3">
                  <p className="text-xs text-slate-500 uppercase">Estimated Value</p>
                  <p className="text-xl font-semibold">₦{totalValue.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDialogOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>

            {step === 2 ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={loading}
                >
                  Back
                </Button>
                <Button type="submit" disabled={loading || items.length === 0}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create {transferType === "hq_supply" ? "Supply" : "Transfer"}
                </Button>
              </div>
            ) : (
              <Button type="submit" disabled={!canAdvance || loading}>
                Next
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

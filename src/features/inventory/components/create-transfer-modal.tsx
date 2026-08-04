"use client";

import { useState } from "react";
import { createTransfer } from "../transfer.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { CreateTransferItem } from "../schemas/transfer.schema";

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
  const [destinationBranch, setDestinationBranch] = useState("");
  const [notes, setNotes] = useState("");
  const [expectedArrival, setExpectedArrival] = useState("");
  const [items, setItems] = useState<CreateTransferItem[]>([]);
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
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof CreateTransferItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!destinationBranch.trim()) {
      setError("Destination branch is required");
      return;
    }

    if (items.length === 0) {
      setError("At least one item is required");
      return;
    }

    setLoading(true);

    try {
      const result = await createTransfer({
        transfer: {
          transferType,
          sourceBranchId,
          destinationBranchId: destinationBranch,
          notes: notes || undefined,
          expectedArrivalDate: expectedArrival ? new Date(expectedArrival).toISOString() : undefined,
        },
        items,
      });

      if (result.success) {
        onOpenChange(false);
        onSuccess?.(result.data.id);
        // Reset form
        setDestinationBranch("");
        setNotes("");
        setExpectedArrival("");
        setItems([]);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create transfer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Create {transferType === "hq_supply" ? "Supply" : "Transfer"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Basic Information</h3>

            <div>
              <Label htmlFor="destination">Destination Branch *</Label>
              <Input
                id="destination"
                value={destinationBranch}
                onChange={(e) => setDestinationBranch(e.target.value)}
                placeholder="Branch ID or name"
                required
              />
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

          {/* Transfer Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Items</h3>
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
              <div className="text-center py-8 bg-slate-50 rounded border-2 border-dashed">
                <p className="text-sm text-slate-600">No items added yet</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAddItem}
                  className="mt-2"
                >
                  Add Item
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="p-4 border rounded bg-white flex gap-4 items-end"
                  >
                    <div className="flex-1">
                      <Label htmlFor={`product-${index}`} className="text-xs">
                        Product ID *
                      </Label>
                      <Input
                        id={`product-${index}`}
                        value={item.productId}
                        onChange={(e) => handleItemChange(index, "productId", e.target.value)}
                        placeholder="Product ID"
                        required
                      />
                    </div>

                    <div className="flex-1">
                      <Label htmlFor={`quantity-${index}`} className="text-xs">
                        Base Quantity *
                      </Label>
                      <Input
                        id={`quantity-${index}`}
                        type="number"
                        value={item.convertedBaseQuantity}
                        onChange={(e) =>
                          handleItemChange(index, "convertedBaseQuantity", parseFloat(e.target.value))
                        }
                        placeholder="0"
                        required
                      />
                    </div>

                    <div className="flex-1">
                      <Label htmlFor={`cost-${index}`} className="text-xs">
                        Unit Cost
                      </Label>
                      <Input
                        id={`cost-${index}`}
                        type="number"
                        value={item.unitCostSnapshot}
                        onChange={(e) =>
                          handleItemChange(index, "unitCostSnapshot", parseFloat(e.target.value))
                        }
                        placeholder="0.00"
                        step="0.01"
                      />
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
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || items.length === 0}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create {transferType === "hq_supply" ? "Supply" : "Transfer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

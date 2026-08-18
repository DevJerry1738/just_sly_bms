import React, { useState, useEffect } from "react";
import { Plus, Trash2, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { productRepository, generateProductCode } from "@/repositories/product.repository";
import { productPackagingRepository } from "@/repositories/product-packaging.repository";
import { categoryRepository } from "@/repositories/category.repository";
import { unitOfMeasureRepository } from "@/repositories/unit-of-measure.repository";
import type { CategorySchema, UnitOfMeasureSchema, ProductSchema } from "@/database/schema";
import { useAuth } from "@/providers/auth-provider";
import { useAuthorization } from "@/hooks/use-authorization";

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  productToEdit?: ProductSchema | null;
}

export function ProductFormModal({ isOpen, onClose, onSuccess, productToEdit }: ProductFormModalProps) {
  const { user } = useAuth();
  const { hasPermission } = useAuthorization();
  const canManageCost = hasPermission("products:edit_cost") || hasPermission("products:view_cost");
  const canCreateProduct = hasPermission("products:create");
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<CategorySchema[]>([]);
  const [units, setUnits] = useState<UnitOfMeasureSchema[]>([]);

  // General fields
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [brand, setBrand] = useState("");
  const [description, setDescription] = useState("");

  // Inventory foundation fields
  const [baseUnit, setBaseUnit] = useState("Piece");
  const [trackExpiry, setTrackExpiry] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState("");

  // Pricing fields — stored as strings to avoid "05" input glitch
  const [costPrice, setCostPrice] = useState("");
  const [retailPrice, setRetailPrice] = useState("");
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [supplyPrice, setSupplyPrice] = useState("");

  // Packaging levels
  const [packaging, setPackaging] = useState<Array<{ label: string; unitsPerPackage: number; sortOrder: number }>>([]);

  useEffect(() => {
    if (!isOpen) return;

    const loadRefData = async () => {
      const [cats, uoms] = await Promise.all([
        categoryRepository.getActiveCategories(),
        unitOfMeasureRepository.getActiveUnits(),
      ]);
      setCategories(cats);
      setUnits(uoms);

      if (productToEdit) {
        setName(productToEdit.name);
        setCode(productToEdit.code);
        setSku(productToEdit.sku ?? "");
        setBarcode(productToEdit.barcode ?? "");
        setCategoryId(productToEdit.categoryId ?? "");
        setBrand(productToEdit.brand ?? "");
        setDescription(productToEdit.description ?? "");
        setBaseUnit(productToEdit.baseUnit);
        setTrackExpiry(productToEdit.trackExpiry);
        setLowStockThreshold(String(productToEdit.lowStockThreshold));
        setCostPrice(productToEdit.costPrice != null ? String(productToEdit.costPrice) : "");
        setRetailPrice(String(productToEdit.retailPrice));
        setWholesalePrice(String(productToEdit.wholesalePrice));
        setSupplyPrice(String(productToEdit.supplyPrice));

        const existingPkgs = await productPackagingRepository.getPackagingForProduct(productToEdit.id);
        setPackaging(
          existingPkgs.map((p) => ({
            label: p.label,
            unitsPerPackage: p.unitsPerPackage,
            sortOrder: p.sortOrder,
          }))
        );
      } else {
        resetForm();
        const autoCode = await generateProductCode();
        setCode(autoCode);
      }
    };

    loadRefData();
  }, [isOpen, productToEdit]);

  const resetForm = () => {
    setName("");
    setCode("");
    setSku("");
    setBarcode("");
    setCategoryId("");
    setBrand("");
    setDescription("");
    setBaseUnit("Piece");
    setTrackExpiry(false);
    setLowStockThreshold("");
    setCostPrice("");
    setRetailPrice("");
    setWholesalePrice("");
    setSupplyPrice("");
    setPackaging([]);
  };

  const addPackagingLevel = () => {
    setPackaging([
      ...packaging,
      { label: "", unitsPerPackage: 1, sortOrder: packaging.length + 1 },
    ]);
  };

  const removePackagingLevel = (index: number) => {
    setPackaging(packaging.filter((_, i) => i !== index));
  };

  const handlePackagingChange = (index: number, key: "label" | "unitsPerPackage", val: string | number) => {
    const updated = [...packaging];
    if (key === "label") updated[index].label = String(val);
    if (key === "unitsPerPackage") updated[index].unitsPerPackage = Math.max(1, Number(val));
    setPackaging(updated);
  };

  const parseNumericValue = (value: string): number | null => {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Product name is required.");
      return;
    }

    if (!productToEdit && !canCreateProduct) {
      alert("You do not have permission to create products.");
      return;
    }

    setLoading(true);
    try {
      const resolvedCostPrice = canManageCost
        ? parseNumericValue(costPrice) ?? productToEdit?.costPrice ?? null
        : productToEdit?.costPrice ?? null;

      const sharedFields = {
        name: name.trim(),
        sku: sku.trim() || undefined,
        barcode: barcode.trim() || undefined,
        categoryId: categoryId || null,
        brand: brand.trim() || undefined,
        description: description.trim() || undefined,
        baseUnit,
        trackExpiry,
        lowStockThreshold: parseNumericValue(lowStockThreshold, productToEdit?.lowStockThreshold ?? 0),
        costPrice: resolvedCostPrice,
        retailPrice: parseNumericValue(retailPrice, productToEdit?.retailPrice ?? 0),
        wholesalePrice: parseNumericValue(wholesalePrice, productToEdit?.wholesalePrice ?? 0),
        supplyPrice: parseNumericValue(supplyPrice, productToEdit?.supplyPrice ?? 0),
        packaging: packaging.filter((p) => p.label.trim().length > 0),
      };

      if (productToEdit) {
        await productRepository.updateProduct(productToEdit.id, {
          ...sharedFields,
          updatedByUserId: user?.id,
          updatedByName: user?.displayName ?? user?.email,
        });
      } else {
        await productRepository.createProduct({
          ...sharedFields,
          code: code.trim() || undefined,
          createdByUserId: user?.id,
          createdByName: user?.displayName ?? user?.email,
        });
      }

      onSuccess();
      onClose();
    } catch (err) {
      alert("Failed to save product. " + (err instanceof Error ? err.message : ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{productToEdit ? "Edit Product" : "Create New Product"}</DialogTitle>
          <DialogDescription>Fill in general information, units, pricing tiers, and packaging configuration.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-2">
          {/* General Information */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">General Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="prod-name">Product Name *</Label>
                <Input id="prod-name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Coca-Cola 35cl" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prod-code">Product Code (Auto-Generated)</Label>
                <Input id="prod-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="JSP-0001" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prod-category">Category</Label>
                <select
                  id="prod-category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background"
                >
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prod-sku">SKU (Optional)</Label>
                <Input id="prod-sku" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. COKE-35CL-BTL" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prod-barcode">Barcode (Optional)</Label>
                <Input id="prod-barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="e.g. 5000112632625" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prod-brand">Brand</Label>
                <Input id="prod-brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Coca-Cola" />
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="prod-description">Description (Optional)</Label>
                <Input id="prod-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief product description..." />
              </div>
            </div>
          </div>

          {/* Inventory Foundation */}
          <div className="space-y-4 pt-2 border-t">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Unit &amp; Expiry Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="prod-unit">Base Unit of Measure *</Label>
                <select
                  id="prod-unit"
                  value={baseUnit}
                  onChange={(e) => setBaseUnit(e.target.value)}
                  className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.name}>
                      {u.name} ({u.abbreviation}) {u.allowDecimals ? "• Decimals" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prod-low-threshold">Low Stock Threshold</Label>
                <Input
                  id="prod-low-threshold"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                />
              </div>

              {/* Expiry toggle — full row */}
              <div className="col-span-2">
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                  <Switch id="prod-expiry" checked={trackExpiry} onCheckedChange={(val) => setTrackExpiry(val)} />
                  <div className="flex-1">
                    <Label htmlFor="prod-expiry" className="cursor-pointer font-medium">Track Expiry Dates</Label>
                    <p className="text-xs text-muted-foreground">Enable expiry tracking for batches created during opening stock and stock adjustments.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing Tiers */}
          <div className="space-y-4 pt-2 border-t">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pricing Tiers (₦)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {canManageCost && (
                <div className="space-y-1.5">
                  <Label htmlFor="prod-cost">Cost Price</Label>
                  <Input
                    id="prod-cost"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="prod-retail">Retail Price *</Label>
                <Input
                  id="prod-retail"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={retailPrice}
                  onChange={(e) => setRetailPrice(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prod-wholesale">Wholesale Price</Label>
                <Input
                  id="prod-wholesale"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={wholesalePrice}
                  onChange={(e) => setWholesalePrice(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prod-supply">Supply Price</Label>
                <Input
                  id="prod-supply"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={supplyPrice}
                  onChange={(e) => setSupplyPrice(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Packaging Levels */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Multi-Level Packaging Configuration</h3>
                <p className="text-xs text-muted-foreground">Define higher-level packages (e.g. 1 Carton = 24 Bottles).</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addPackagingLevel}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Level
              </Button>
            </div>

            {packaging.length > 0 && (
              <div className="space-y-2">
                {packaging.map((pkg, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-muted/40 p-2.5 rounded-lg text-xs">
                    <Layers className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="font-semibold text-muted-foreground w-12">Level {idx + 1}</span>
                    <Input
                      placeholder="Label (e.g. Carton, Pack)"
                      value={pkg.label}
                      onChange={(e) => handlePackagingChange(idx, "label", e.target.value)}
                      className="h-8 text-xs flex-1"
                    />
                    <span className="text-muted-foreground font-medium">=</span>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Units"
                      value={pkg.unitsPerPackage}
                      onChange={(e) => handlePackagingChange(idx, "unitsPerPackage", e.target.value)}
                      className="h-8 w-20 text-xs text-center"
                    />
                    <span className="text-muted-foreground font-medium">{baseUnit}(s)</span>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => removePackagingLevel(idx)} className="text-rose-500 hover:text-rose-600">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : productToEdit ? "Update Product" : "Create Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { Plus, Search, Upload, Tag, Archive, RefreshCw, Edit3, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { productRepository } from "@/repositories/product.repository";
import { productPackagingRepository } from "@/repositories/product-packaging.repository";
import { categoryRepository } from "@/repositories/category.repository";
import { unitOfMeasureRepository } from "@/repositories/unit-of-measure.repository";
import { useAuthorization } from "@/hooks/use-authorization";
import { useAuth } from "@/providers/auth-provider";
import { SyncManager } from "@/services/sync/sync-manager";
import { useBranch } from "@/providers/branch-provider";
import { ProductImportModal } from "./product-import-modal";
import { ProductFormModal } from "./product-form-modal";
import { CategoryManagerModal } from "./category-manager-modal";
import type { ProductSchema, CategorySchema, UnitOfMeasureSchema, ProductPackagingSchema } from "@/database/schema";

export function ProductsPage() {
  const { hasPermission } = useAuthorization();
  const { user } = useAuth();
  const { activeBranch } = useBranch();
  const canViewCost = hasPermission("products:view_cost") || hasPermission("products:edit_cost");
  const canImport = hasPermission("products:import");
  const canCreateProduct = hasPermission("products:create");

  const [products, setProducts] = useState<ProductSchema[]>([]);
  const [categories, setCategories] = useState<CategorySchema[]>([]);
  const [units, setUnits] = useState<UnitOfMeasureSchema[]>([]);
  const [packagingMap, setPackagingMap] = useState<Record<string, ProductPackagingSchema[]>>({});
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);

  // Modals state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<ProductSchema | null>(null);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [prods, cats, uoms] = await Promise.all([
        productRepository.getAll(),
        categoryRepository.getActiveCategories(),
        unitOfMeasureRepository.getActiveUnits(),
      ]);
      if (!activeBranch?.id) {
        setProducts([]);
        setCategories(cats);
        setUnits(uoms);
        setPackagingMap({});
        return;
      }
      setProducts(prods);
      setCategories(cats);
      setUnits(uoms);

      const pkgEntries = await Promise.all(
        prods.map(async (p) => {
          const pkgs = await productPackagingRepository.getPackagingForProduct(p.id);
          return [p.id, pkgs] as const;
        })
      );
      setPackagingMap(Object.fromEntries(pkgEntries));
    } catch (err) {
      console.error("Failed loading product data", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [user?.id, activeBranch?.id]);

  useEffect(() => {
    const unsubscribe = SyncManager.subscribe((event) => {
      if (event === "sync:complete") {
        void loadData();
      }
    });
    return unsubscribe;
  }, [user?.id, activeBranch?.id]);

  const handleOpenAddModal = () => {
    if (!canCreateProduct) {
      alert("You do not have permission to create products.");
      return;
    }
    setProductToEdit(null);
    setIsFormOpen(true);
  };

  const handleOpenEditModal = (product: ProductSchema) => {
    setProductToEdit(product);
    setIsFormOpen(true);
  };

  const filteredProducts = products.filter((p) => {
    const matchesStatus = showArchived ? true : p.status === "active";
    const matchesCategory = selectedCategory === "all" ? true : p.categoryId === selectedCategory;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      (p.sku ?? "").toLowerCase().includes(q) ||
      (p.barcode ?? "").toLowerCase().includes(q);

    return matchesStatus && matchesCategory && matchesSearch;
  });

  const handleArchiveToggle = async (product: ProductSchema) => {
    if (product.status === "active") {
      await productRepository.archiveProduct(product.id);
    } else {
      await productRepository.restoreProduct(product.id);
    }
    loadData();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Product Catalog</h1>
          <p className="text-sm text-muted-foreground">Manage your organization's products, packaging, and multi-tier pricing.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsCategoryManagerOpen(true)}>
            <Tag className="w-4 h-4 mr-2" />
            Categories
          </Button>

          {canImport && (
            <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Import Excel
            </Button>
          )}
          {canCreateProduct && (
            <Button size="sm" onClick={handleOpenAddModal}>
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          )}
        </div>
      </div>

      {/* Filters & Actions Bar */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 bg-muted/40 p-3 rounded-xl">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, code, SKU, barcode..."
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
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
            className={showArchived ? "text-primary" : "text-muted-foreground"}
          >
            <Archive className="w-4 h-4 mr-1.5" />
            {showArchived ? "Showing Archived" : "Hide Archived"}
          </Button>
          <Button variant="ghost" size="icon" onClick={loadData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 border-b text-xs font-semibold text-muted-foreground uppercase">
            <tr>
              <th className="p-3 pl-4">Product Code / SKU</th>
              <th className="p-3">Product Name</th>
              <th className="p-3">Category</th>
              <th className="p-3">Base Unit</th>
              {canViewCost && <th className="p-3 text-right">Cost Price</th>}
              <th className="p-3 text-right">Retail Price</th>
              <th className="p-3 text-right">Wholesale</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 pr-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted-foreground">
                  Loading product catalog...
                </td>
              </tr>
            ) : filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted-foreground">
                  No products found. Add your first product or import via Excel.
                </td>
              </tr>
            ) : (
              filteredProducts.map((p) => {
                const cat = categories.find((c) => c.id === p.categoryId);
                return (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 pl-4 font-mono text-xs">
                      <div className="font-semibold text-foreground">{p.code || p.sku || p.id}</div>
                      {p.sku && p.code && p.sku !== p.code ? (
                        <div className="text-muted-foreground">{p.sku}</div>
                      ) : null}
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{p.name}</div>
                      {p.brand && <div className="text-xs text-muted-foreground">{p.brand}</div>}
                    </td>
                    <td className="p-3">
                      {cat ? (
                        <Badge variant="outline" className="text-xs font-normal">
                          <Tag className="w-3 h-3 mr-1" />
                          {cat.name}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3 text-xs">
                      <div className="font-medium">{p.baseUnit}</div>
                      {packagingMap[p.id] && packagingMap[p.id].length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {packagingMap[p.id].map((pkg) => (
                            <Badge key={pkg.id} variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                              {pkg.label} ({pkg.unitsPerPackage})
                            </Badge>
                          ))}
                        </div>
                      )}
                    </td>
                    {canViewCost && (
                      <td className="p-3 text-right font-mono font-medium">
                        ₦{(p.costPrice ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    )}
                    <td className="p-3 text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">
                      ₦{p.retailPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right font-mono text-xs text-muted-foreground">
                      ₦{p.wholesalePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant={p.status === "active" ? "default" : "secondary"}>
                        {p.status}
                      </Badge>
                    </td>
                    <td className="p-3 pr-4 text-right flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleOpenEditModal(p)}
                        title="Edit product"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleArchiveToggle(p)}
                      >
                        {p.status === "active" ? "Archive" : "Restore"}
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Form Modal */}
      <ProductFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={loadData}
        productToEdit={productToEdit}
      />

      {/* Import Modal */}
      <ProductImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={loadData}
      />

      {/* Category Manager Modal */}
      <CategoryManagerModal
        isOpen={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
        onCategoriesChanged={loadData}
      />
    </div>
  );
}

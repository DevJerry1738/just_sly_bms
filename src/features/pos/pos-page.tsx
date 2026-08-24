import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useBranch } from "@/providers/branch-provider";
import { useAuthorization } from "@/hooks/use-authorization";
import { productRepository } from "@/repositories/product.repository";
import { productPackagingRepository } from "@/repositories/product-packaging.repository";
import { saleItemsRepository } from "@/repositories/sale-items.repository";
import { db } from "@/database/schema";
import type { SalesSchema, SaleItemSchema, OrganizationSchema } from "@/database/schema";
import { SyncManager } from "@/services/sync/sync-manager";
import { ProductSearch } from "@/features/pos/components/product-search";
import { ProductGrid } from "@/features/pos/components/product-grid";
import { CartPane } from "@/features/pos/components/cart-pane";
import { CheckoutModal } from "@/features/pos/components/checkout-modal";
import { ReceiptView } from "@/features/pos/components/receipt-view";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { posService, type PosCartItem } from "@/services/pos/pos.service";

export function PosPage() {
  const { user } = useAuth();
  const { activeBranch } = useBranch();
  const { hasPermission } = useAuthorization();
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Completed sale state for receipt modal
  const [completedSale, setCompletedSale] = useState<SalesSchema | null>(null);
  const [completedSaleItems, setCompletedSaleItems] = useState<SaleItemSchema[]>([]);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [organization, setOrganization] = useState<OrganizationSchema | null>(null);

  const loadProducts = useCallback(async () => {
    try {
      const allProducts = await productRepository.getActiveProducts();
      setProducts(allProducts);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
    // Load organization for receipt header/footer
    db.organizations.toArray().then((orgs) => {
      if (orgs.length > 0) setOrganization(orgs[0]);
    }).catch(console.error);
  }, [loadProducts]);

  useEffect(() => {
    const unsubscribe = SyncManager.subscribe((event) => {
      if (event === "sync:complete") {
        void loadProducts();
      }
    });
    return unsubscribe;
  }, [loadProducts]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((product) =>
      [product.name, product.code, product.sku, product.barcode]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [products, query]);

  const addToCart = async (product: any) => {
    if (!activeBranch?.id) {
      toast.error("Select a branch before adding items to cart.");
      return;
    }

    const existingIndex = cart.findIndex((item) => item.productId === product.id);
    const targetItem = cart[existingIndex];
    const targetQty = targetItem ? targetItem.quantity + 1 : 1;
    const packagingLabel = targetItem?.packagingLabel;

    const validation = await posService.validateCartItem(
      product.id,
      activeBranch.id,
      targetQty,
      packagingLabel
    );

    if (!validation.ok) {
      toast.error(validation.error);
      return;
    }

    if (existingIndex >= 0) {
      setCart((current) =>
        current.map((item, idx) =>
          idx === existingIndex
            ? {
                ...item,
                quantity: targetQty,
                baseQuantity: validation.baseQuantity ?? targetQty,
              }
            : item
        )
      );
    } else {
      const packaging = await productPackagingRepository.getPackagingForProduct(product.id);
      const availablePackaging = packaging.map((p) => ({
        label: p.label,
        unitsPerPackage: p.unitsPerPackage,
      }));

      setCart((current) => [
        ...current,
        {
          productId: product.id,
          productName: product.name,
          baseUnit: product.baseUnit || "Piece",
          quantity: 1,
          baseQuantity: validation.baseQuantity ?? 1,
          unitPrice: product.retailPrice,
          baseRetailPrice: product.retailPrice,
          costPrice: product.costPrice ?? 0,
          availablePackaging,
        },
      ]);
    }
  };

  const updateCartQuantity = async (productId: string, requestedQty: number) => {
    if (requestedQty < 1) return;
    if (!activeBranch?.id) {
      toast.error("Branch is required to check stock.");
      return;
    }

    const item = cart.find((i) => i.productId === productId);
    if (!item) return;

    const validation = await posService.validateCartItem(
      productId,
      activeBranch.id,
      requestedQty,
      item.packagingLabel
    );

    if (!validation.ok) {
      toast.error(validation.error);
      return;
    }

    setCart((current) =>
      current.map((i) =>
        i.productId === productId
          ? {
              ...i,
              quantity: requestedQty,
              baseQuantity: validation.baseQuantity ?? requestedQty,
            }
          : i
      )
    );
  };

  const updateCartUnit = async (productId: string, packagingLabel?: string) => {
    if (!activeBranch?.id) {
      toast.error("Branch is required to check stock.");
      return;
    }

    const item = cart.find((i) => i.productId === productId);
    if (!item) return;

    const validation = await posService.validateCartItem(
      productId,
      activeBranch.id,
      item.quantity,
      packagingLabel
    );

    if (!validation.ok) {
      toast.error(validation.error);
      return;
    }

    let multiplier = 1;
    if (packagingLabel && item.availablePackaging) {
      const pkg = item.availablePackaging.find(
        (p) => p.label.toLowerCase() === packagingLabel.toLowerCase()
      );
      if (pkg) multiplier = pkg.unitsPerPackage;
    }

    const updatedUnitPrice = item.baseRetailPrice * multiplier;

    setCart((current) =>
      current.map((i) =>
        i.productId === productId
          ? {
              ...i,
              packagingLabel,
              unitPrice: updatedUnitPrice,
              baseQuantity: validation.baseQuantity ?? item.quantity * multiplier,
            }
          : i
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((current) => current.filter((item) => item.productId !== productId));
  };

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [cart]
  );

  const handleCheckout = async (
    paymentMethod: "cash" | "bank_transfer" | "card",
    discountAmount: number
  ) => {
    if (!hasPermission("sales:create")) {
      toast.error("Access Denied: You do not have permission to process sales transactions.");
      return;
    }

    if (!activeBranch?.id || !user?.id) {
      toast.error("A branch and active user are required to complete a sale.");
      return;
    }

    try {
      const sale = await posService.createDraftSale({
        branchId: activeBranch.id,
        createdBy: user.id,
        createdByName: user.fullName ?? user.email ?? user.id,
        items: cart,
        paymentMethod,
        amountTendered: Math.max(0, total - discountAmount),
        discountAmount,
      });

      const saleItems = await saleItemsRepository.getBySaleId(sale.id);

      toast.success(`Sale ${sale.saleNumber} completed successfully!`);
      setCart([]);

      // Open receipt view
      setCompletedSale(sale);
      setCompletedSaleItems(saleItems);
      setReceiptOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to complete sale.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Retail POS</h1>
          <p className="text-sm text-muted-foreground">Fast checkout for today’s transactions.</p>
        </div>
        <Badge variant="secondary">{activeBranch?.name ?? "No branch selected"}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <ProductSearch value={query} onChange={setQuery} />
          <ProductGrid
            products={filteredProducts}
            loading={loading}
            onAddToCart={(product) => void addToCart(product)}
          />
        </div>

        <CartPane
          items={cart}
          onRemove={removeFromCart}
          onUpdateQuantity={(id, qty) => void updateCartQuantity(id, qty)}
          onUpdateUnit={(id, label) => void updateCartUnit(id, label)}
          onCheckout={() => setCheckoutOpen(true)}
          total={total}
        />
      </div>

      <CheckoutModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        items={cart}
        subtotal={total}
        allowDiscount={hasPermission("sales:update")}
        onConfirm={handleCheckout}
      />

      {completedSale && (
        <ReceiptView
          open={receiptOpen}
          onOpenChange={setReceiptOpen}
          sale={completedSale}
          items={completedSaleItems}
          branch={activeBranch}
          organization={organization}
        />
      )}
    </div>
  );
}

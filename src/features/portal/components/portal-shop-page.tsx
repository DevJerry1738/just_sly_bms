import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ShoppingCart, Search, Package, LogOut,
  Plus, Minus, X, ChevronRight, Loader2,
  Landmark, Copy, Check, ShieldCheck, Tag, CreditCard, Sparkles, AlertCircle, Building2,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { APP_CONFIG } from "@/config/app";
import logoNoBg from "@/assets/logo_no_bg.webp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

import { customerRepository } from "@/repositories/customer.repository";
import { organizationRepository } from "@/repositories/organization.repository";
import { categoryRepository } from "@/repositories/category.repository";
import { wholesaleOrderService, type WholesaleCatalogItem } from "@/services/wholesale/wholesale-order.service";
import type { CustomerAccountSchema, OrganizationSchema, CategorySchema } from "@/database/schema";

interface CartItem {
  productId: string;
  productName: string;
  sku: string;
  sellingUnit: string;
  unitsPerPackage: number;
  quantity: number;
  baseQuantity: number;
  unitPriceSnapshot: number;
  costPriceSnapshot: number;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(amount);
}

export function PortalShopPage() {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<CustomerAccountSchema | null>(null);
  const [org, setOrg] = useState<OrganizationSchema | null>(null);
  const [categories, setCategories] = useState<CategorySchema[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [catalog, setCatalog] = useState<WholesaleCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copiedBankField, setCopiedBankField] = useState<string | null>(null);

  // Product quantity selections per catalog item
  const [quantities, setQuantities] = useState<Record<string, { qty: number; packagingLabel: string; unitsPerPackage: number }>>({});

  // Load customer session, org bank info, categories, and catalog
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session?.user) {
          if (mounted) navigate({ to: "/portal/login" });
          return;
        }
        const cust = await customerRepository.getByEmail(data.session.user.email ?? "");
        if (!cust || cust.status !== "active") {
          await supabase.auth.signOut();
          if (mounted) navigate({ to: "/portal/login" });
          return;
        }
        if (!mounted) return;
        setCustomer(cust);

        // Load organization bank details & categories
        const [orgData, catsData, items] = await Promise.all([
          organizationRepository.getPrimaryOrganization(),
          categoryRepository.getAll(),
          wholesaleOrderService.getCatalog(),
        ]);

        if (!mounted) return;
        setOrg(orgData);
        setCategories(catsData);
        setCatalog(items);
      } catch (err) {
        console.error("Catalogue load error:", err);
        if (mounted) toast.error("Failed to load catalogue");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/portal/login" });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedBankField(label);
    toast.success(`${label} copied to clipboard!`);
    setTimeout(() => setCopiedBankField(null), 2000);
  };

  const filtered = catalog.filter((p) => {
    const matchesSearch =
      p.productName.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === "all" || p.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getQtyState = (productId: string, item: WholesaleCatalogItem) => {
    return quantities[productId] ?? {
      qty: 1,
      packagingLabel: item.baseUnit,
      unitsPerPackage: 1,
    };
  };

  const addToCart = (item: WholesaleCatalogItem) => {
    if (item.isOutOfStock) return;
    const state = getQtyState(item.productId, item);
    const selectedPkg = item.packaging.find((p) => p.label === state.packagingLabel);
    const unitPrice = selectedPkg ? selectedPkg.unitWholesalePrice : item.wholesalePrice;

    const existing = cart.findIndex((c) => c.productId === item.productId && c.sellingUnit === state.packagingLabel);
    if (existing >= 0) {
      setCart((prev) =>
        prev.map((c, i) =>
          i === existing
            ? { ...c, quantity: c.quantity + state.qty, baseQuantity: (c.quantity + state.qty) * state.unitsPerPackage }
            : c
        )
      );
    } else {
      setCart((prev) => [
        ...prev,
        {
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          sellingUnit: state.packagingLabel,
          unitsPerPackage: state.unitsPerPackage,
          quantity: state.qty,
          baseQuantity: state.qty * state.unitsPerPackage,
          unitPriceSnapshot: unitPrice,
          costPriceSnapshot: 0,
        },
      ]);
    }

    toast.success(`Added ${state.qty} ${state.packagingLabel} of ${item.productName} to cart`);
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.unitPriceSnapshot * c.quantity, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  const handlePlaceOrder = async () => {
    if (!customer || cart.length === 0) return;
    setSubmitting(true);
    try {
      await wholesaleOrderService.createOrder({
        customerId: customer.id,
        notes,
        items: cart,
      });
      toast.success("Wholesale order placed successfully!", {
        description: "Please transfer payment to the bank account below and upload your receipt.",
      });
      setCart([]);
      setCheckoutOpen(false);
      setCartOpen(false);
      navigate({ to: "/portal/orders" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to place order");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <img src={logoNoBg} alt={APP_CONFIG.name} className="h-12 w-auto object-contain animate-pulse" />
          <div className="flex items-center gap-2 text-sm text-slate-400 mt-2">
            <Loader2 className="size-4 animate-spin text-primary" />
            <span>Loading Just Sly Wholesale Catalogue…</span>
          </div>
        </div>
      </div>
    );
  }

  const bankName = org?.bank_name || "Access Bank Plc";
  const bankAccNum = org?.bank_account_number || "0123456789";
  const bankAccName = org?.bank_account_name || "Just Sly Business Solutions Ltd";
  const bankInstructions = org?.bank_instructions || "Please use your Order Number as the transfer reference/narration.";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-primary/30">
      
      {/* ── Brand Navigation Header ─────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <img src={logoNoBg} alt={APP_CONFIG.name} className="h-9 w-auto object-contain" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-white">{APP_CONFIG.name}</span>
                <Badge variant="outline" className="border-indigo-500/40 bg-indigo-500/10 text-indigo-400 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0">
                  Wholesale Portal
                </Badge>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Direct B2B Catalogue & Order Desk</p>
            </div>
          </div>

          {/* Search Bar (Desktop) */}
          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products or SKU..."
                className="pl-10 bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500/50 h-9 text-sm rounded-lg"
              />
            </div>
          </div>

          {/* User Profile + Actions */}
          <div className="flex items-center gap-2.5">
            {customer && (
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs">
                <Building2 className="size-3.5 text-indigo-400 shrink-0" />
                <div className="truncate max-w-[160px]">
                  <p className="font-semibold text-white truncate">{customer.businessName || customer.contactName}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{customer.customerCode}</p>
                </div>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: "/portal/orders" })}
              className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white text-xs gap-1.5 h-9"
            >
              <Package className="size-3.5 text-indigo-400" />
              <span>My Orders</span>
            </Button>

            <Button
              variant="default"
              size="sm"
              className="relative bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/20 text-xs gap-1.5 h-9"
              onClick={() => setCartOpen(true)}
            >
              <ShoppingCart className="size-3.5" />
              <span className="hidden sm:inline">Cart</span>
              {cartCount > 0 && (
                <span className="flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-white text-indigo-700 text-[11px] font-bold">
                  {cartCount}
                </span>
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="text-slate-400 hover:text-white hover:bg-white/10 h-9 w-9"
              title="Sign Out"
            >
              <LogOut className="size-4" />
            </Button>
          </div>

        </div>
      </header>

      {/* ── Main Portal Body ────────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">

        {/* ── Bank Transfer Announcement Card ────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-slate-950 p-5 sm:p-6 backdrop-blur-xl shadow-xl">
          <div className="absolute top-0 right-0 -mr-10 -mt-10 size-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-1.5 max-w-xl">
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
                <Landmark className="size-4" />
                <span>Official HQ Payment Transfer Account</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Wholesale Direct Bank Transfer Details
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {bankInstructions}
              </p>
            </div>

            {/* Bank details grid with copy buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white/5 border border-white/10 rounded-xl p-3.5 text-xs shrink-0">
              {/* Bank Name */}
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-semibold text-slate-400">Bank Name</p>
                <p className="font-medium text-white truncate">{bankName}</p>
              </div>

              {/* Account Number */}
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-semibold text-slate-400">Account Number</p>
                <div className="flex items-center justify-between gap-2 font-mono font-bold text-indigo-300 text-sm">
                  <span>{bankAccNum}</span>
                  <button
                    onClick={() => copyToClipboard(bankAccNum, "Account Number")}
                    className="text-slate-400 hover:text-indigo-400 p-1 rounded hover:bg-white/10 transition-colors"
                  >
                    {copiedBankField === "Account Number" ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                  </button>
                </div>
              </div>

              {/* Account Name */}
              <div className="space-y-1 sm:col-span-1">
                <p className="text-[10px] uppercase font-semibold text-slate-400">Account Name</p>
                <p className="font-medium text-white truncate">{bankAccName}</p>
              </div>
            </div>

          </div>
        </div>

        {/* ── Filter & Search Section ───────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Wholesale Product Catalogue
              <Badge variant="outline" className="border-indigo-500/30 text-indigo-300 bg-indigo-500/10 text-xs font-mono">
                HQ Inventory Only
              </Badge>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Showing {filtered.length} product{filtered.length !== 1 ? "s" : ""} · All prices in NGN (Nigerian Naira)
            </p>
          </div>

          {/* Mobile search input */}
          <div className="w-full sm:hidden">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products or SKU..."
                className="pl-10 bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Category Chips */}
          {categories.length > 0 && (
            <ScrollArea className="w-full sm:w-auto max-w-full" type="scroll">
              <div className="flex items-center gap-1.5 pb-1">
                <Button
                  variant={selectedCategory === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory("all")}
                  className={`h-7 text-xs rounded-full px-3 ${
                    selectedCategory === "all"
                      ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  All ({catalog.length})
                </Button>
                {categories.map((cat) => {
                  const count = catalog.filter((c) => c.categoryId === cat.id).length;
                  return (
                    <Button
                      key={cat.id}
                      variant={selectedCategory === cat.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`h-7 text-xs rounded-full px-3 whitespace-nowrap ${
                        selectedCategory === cat.id
                          ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      {cat.name} ({count})
                    </Button>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* ── Product Grid ──────────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500 border border-dashed border-white/10 rounded-2xl bg-white/5">
            <Package className="size-12 opacity-30 text-slate-400" />
            <p className="text-sm font-medium text-slate-400">No products match your criteria</p>
            <p className="text-xs text-slate-600">Try adjusting your search or category filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((item) => {
              const state = getQtyState(item.productId, item);
              const selectedPkg = item.packaging.find((p) => p.label === state.packagingLabel);
              const displayUnitPrice = selectedPkg?.unitWholesalePrice ?? item.wholesalePrice;
              const totalPrice = displayUnitPrice * state.qty;

              return (
                <Card
                  key={item.productId}
                  className={`relative flex flex-col justify-between overflow-hidden border-white/10 bg-slate-900/60 backdrop-blur-xl transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 ${
                    item.isOutOfStock ? "opacity-60" : "hover:border-indigo-500/40 hover:-translate-y-1"
                  }`}
                >
                  <CardContent className="p-5 flex flex-col justify-between flex-1 gap-4">
                    
                    {/* Header info */}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-500/10 font-mono text-[10px]">
                          {item.sku}
                        </Badge>
                        {item.isOutOfStock ? (
                          <Badge variant="outline" className="border-red-500/30 text-red-400 bg-red-500/10 text-[10px]">
                            Out of stock
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-[10px]">
                            In Stock
                          </Badge>
                        )}
                      </div>

                      <h3 className="font-semibold text-base text-white tracking-tight leading-snug line-clamp-2">
                        {item.productName}
                      </h3>
                      {item.description && (
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Pricing & Packaging Selector */}
                    <div className="space-y-3 pt-2 border-t border-white/10">
                      
                      {/* Packaging unit selector */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          Packaging Unit
                        </label>
                        <Select
                          value={state.packagingLabel}
                          onValueChange={(val) => {
                            const pkg = item.packaging.find((p) => p.label === val);
                            setQuantities((prev) => ({
                              ...prev,
                              [item.productId]: {
                                qty: state.qty,
                                packagingLabel: val,
                                unitsPerPackage: pkg?.unitsPerPackage ?? 1,
                              },
                            }));
                          }}
                        >
                          <SelectTrigger className="h-8 bg-white/5 border-white/10 text-xs text-slate-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-white/10 text-slate-200">
                            {/* Base unit option (Pieces) */}
                            <SelectItem value={item.baseUnit} className="text-xs">
                              {item.baseUnit} (1 unit) — {formatCurrency(item.wholesalePrice)}
                            </SelectItem>
                            {/* Additional packaging units */}
                            {item.packaging.map((pkg) => (
                              <SelectItem key={pkg.label} value={pkg.label} className="text-xs">
                                {pkg.label} ({pkg.unitsPerPackage} {item.baseUnit}s) — {formatCurrency(pkg.unitWholesalePrice)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Display Unit Price */}
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-slate-400">Price / {state.packagingLabel}</span>
                        <span className="text-lg font-bold text-indigo-300 tracking-tight">
                          {formatCurrency(displayUnitPrice)}
                        </span>
                      </div>

                      {/* Quantity Selector & Add button */}
                      <div className="flex items-center gap-2 pt-1">
                        <div className="flex items-center rounded-lg border border-white/10 bg-white/5 p-1 h-9">
                          <button
                            type="button"
                            onClick={() =>
                              setQuantities((prev) => ({
                                ...prev,
                                [item.productId]: { ...state, qty: Math.max(1, state.qty - 1) },
                              }))
                            }
                            disabled={item.isOutOfStock || state.qty <= 1}
                            className="flex size-7 items-center justify-center rounded text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30"
                          >
                            <Minus className="size-3.5" />
                          </button>
                          <span className="w-8 text-center text-xs font-mono font-bold text-white">
                            {state.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setQuantities((prev) => ({
                                ...prev,
                                [item.productId]: { ...state, qty: state.qty + 1 },
                              }))
                            }
                            disabled={item.isOutOfStock}
                            className="flex size-7 items-center justify-center rounded text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30"
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>

                        <Button
                          onClick={() => addToCart(item)}
                          disabled={item.isOutOfStock}
                          className="flex-1 h-9 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold gap-1.5 shadow-md"
                        >
                          <ShoppingCart className="size-3.5" />
                          <span>Add to cart</span>
                        </Button>
                      </div>

                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

      </main>

      {/* ── Cart Drawer / Dialog ─────────────────────────────────────────── */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-white/10 text-white shadow-2xl rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <ShoppingCart className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white">Wholesale Cart</DialogTitle>
                <DialogDescription className="text-xs text-slate-400 mt-0.5">
                  Review selected items before generating your wholesale order.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {cart.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
              <ShoppingCart className="size-10 opacity-30" />
              <p className="text-xs font-medium text-slate-400">Your cart is empty</p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <ScrollArea className="max-h-64 pr-2">
                <div className="space-y-3">
                  {cart.map((item, idx) => (
                    <div key={`${item.productId}-${item.sellingUnit}`} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/10 text-xs">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white truncate">{item.productName}</p>
                        <p className="text-[10px] text-slate-400">
                          {item.quantity} × {item.sellingUnit} ({item.baseQuantity} base units) @ {formatCurrency(item.unitPriceSnapshot)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-indigo-300">
                          {formatCurrency(item.unitPriceSnapshot * item.quantity)}
                        </span>
                        <button
                          onClick={() => setCart((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-slate-500 hover:text-red-400 transition-colors p-1"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <Separator className="bg-white/10" />

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Order Subtotal:</span>
                <span className="text-xl font-bold text-white font-mono">{formatCurrency(cartTotal)}</span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => setCartOpen(false)} className="text-slate-400 hover:text-white">
              Continue Shopping
            </Button>
            <Button
              onClick={() => setCheckoutOpen(true)}
              disabled={cart.length === 0}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold gap-1.5"
            >
              Proceed to Checkout <ChevronRight className="size-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Checkout Dialog ──────────────────────────────────────────────── */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-lg bg-slate-900 border-white/10 text-white shadow-2xl rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white">Place Wholesale Order</DialogTitle>
                <DialogDescription className="text-xs text-slate-400 mt-0.5">
                  Confirm your order details. Payments are processed via direct bank transfer.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Customer information */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
              <p className="text-[10px] uppercase font-semibold text-slate-400">Fulfillment & Customer Account</p>
              <p className="font-semibold text-white">{customer?.businessName || customer?.contactName}</p>
              <p className="text-[11px] text-slate-400">Fulfilled by: <strong className="text-indigo-300">Just Sly HQ Location</strong></p>
            </div>

            {/* Bank Transfer Box */}
            <div className="p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 space-y-2">
              <div className="flex items-center justify-between text-indigo-300 font-semibold">
                <span className="flex items-center gap-1.5"><Landmark className="size-3.5" /> Payment Transfer Details</span>
                <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-mono">Access Bank</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                <div>
                  <p className="text-slate-400 text-[10px]">Bank Name</p>
                  <p className="font-semibold text-white truncate">{bankName}</p>
                </div>
                <div className="flex items-center justify-between gap-1 pr-1">
                  <div>
                    <p className="text-slate-400 text-[10px]">Account Number</p>
                    <p className="font-mono font-bold text-indigo-300">{bankAccNum}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(bankAccNum, "Account Number")}
                    className="text-slate-400 hover:text-indigo-400 p-1 rounded hover:bg-white/10 transition-colors shrink-0"
                  >
                    {copiedBankField === "Account Number" ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                  </button>
                </div>
                <div className="col-span-2 border-t border-white/10 pt-1.5 mt-0.5">
                  <p className="text-slate-400 text-[10px]">Account Name</p>
                  <p className="font-semibold text-white">{bankAccName}</p>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-300">Order Notes / Delivery Instructions (Optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special delivery notes or PO reference..."
                rows={2}
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 text-xs resize-none"
              />
            </div>

            <Separator className="bg-white/10" />

            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Total Amount Due:</span>
              <span className="text-xl font-bold text-emerald-400 font-mono">{formatCurrency(cartTotal)}</span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setCheckoutOpen(false)} disabled={submitting} className="text-slate-400 hover:text-white">
              Back to Cart
            </Button>
            <Button
              onClick={handlePlaceOrder}
              disabled={submitting}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold gap-1.5 shadow-lg shadow-emerald-500/20"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {submitting ? "Submitting Order..." : "Confirm & Place Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

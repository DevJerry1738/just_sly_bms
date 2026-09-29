import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Play,
  Trash2,
  Search,
  ShoppingCart,
  User,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { HeldCartSchema } from "@/database/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface HeldCartsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  heldCarts: HeldCartSchema[];
  onResume: (heldCart: HeldCartSchema) => Promise<void>;
  onDiscard: (heldCartId: string) => Promise<void>;
  hasActiveCartItems: boolean;
}

export function HeldCartsModal({
  open,
  onOpenChange,
  heldCarts,
  onResume,
  onDiscard,
  hasActiveCartItems,
}: HeldCartsModalProps) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cartToDiscard, setCartToDiscard] = useState<string | null>(null);
  const [cartToResume, setCartToResume] = useState<HeldCartSchema | null>(null);
  const [resuming, setResuming] = useState(false);

  const filteredCarts = heldCarts.filter((cart) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      cart.referenceLabel.toLowerCase().includes(q) ||
      (cart.notes && cart.notes.toLowerCase().includes(q)) ||
      (cart.heldByUserName && cart.heldByUserName.toLowerCase().includes(q)) ||
      cart.items.some((i) => i.productName.toLowerCase().includes(q))
    );
  });

  const handleResumeClick = async (cart: HeldCartSchema) => {
    if (hasActiveCartItems) {
      // Prompt user about overwriting the current active cart
      setCartToResume(cart);
    } else {
      setResuming(true);
      try {
        await onResume(cart);
        onOpenChange(false);
      } finally {
        setResuming(false);
      }
    }
  };

  const handleConfirmResumeOverwrite = async () => {
    if (!cartToResume) return;
    setResuming(true);
    try {
      await onResume(cartToResume);
      setCartToResume(null);
      onOpenChange(false);
    } finally {
      setResuming(false);
    }
  };

  const formatElapsed = (timestamp: number) => {
    const minutes = Math.floor((Date.now() - timestamp) / 60000);
    if (minutes < 1) return "Just now";
    if (minutes === 1) return "1 min ago";
    if (minutes < 60) return `${minutes} mins ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m ago`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Clock className="h-5 w-5 text-amber-500" />
                Held Transactions
              </DialogTitle>
              <Badge variant="secondary" className="px-2.5 py-0.5">
                {heldCarts.length} {heldCarts.length === 1 ? "Order" : "Orders"}
              </Badge>
            </div>
            <DialogDescription>
              Retrieve and resume parked customer transactions, or discard abandoned orders.
            </DialogDescription>
          </DialogHeader>

          {heldCarts.length > 0 && (
            <div className="relative my-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer tag, note, product..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1 min-h-[220px]">
            {heldCarts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <ShoppingCart className="h-10 w-10 stroke-[1.5] mb-2 opacity-40" />
                <p className="font-medium text-foreground">No held transactions</p>
                <p className="text-xs">When you park an active cart, it will show up here.</p>
              </div>
            ) : filteredCarts.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No matching held orders found for "{search}".
              </div>
            ) : (
              filteredCarts.map((cart) => {
                const isExpanded = expandedId === cart.id;

                return (
                  <div
                    key={cart.id}
                    className="border rounded-lg p-3.5 bg-card hover:border-amber-400/60 transition-colors space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-base">
                            {cart.referenceLabel}
                          </span>
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatElapsed(cart.createdAt)}
                          </span>
                        </div>
                        {cart.notes && (
                          <p className="text-xs text-muted-foreground italic">
                            "{cart.notes}"
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground pt-0.5">
                          {cart.heldByUserName && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {cart.heldByUserName}
                            </span>
                          )}
                          <span>
                            {cart.items.length} {cart.items.length === 1 ? "line item" : "line items"} ({cart.totalItems} units)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <div className="text-right mr-1">
                          <span className="text-xs text-muted-foreground block">Amount</span>
                          <span className="font-bold text-base text-foreground">
                            ₦{cart.subtotal.toFixed(2)}
                          </span>
                        </div>

                        <Button
                          size="sm"
                          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 h-8 font-medium"
                          onClick={() => handleResumeClick(cart)}
                          disabled={resuming}
                        >
                          <Play className="h-3.5 w-3.5 fill-current" />
                          Resume
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setCartToDiscard(cart.id)}
                          title="Discard order"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Toggle items breakdown */}
                    <div className="pt-2 border-t border-border/40 text-xs">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : cart.id)}
                        className="flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium transition-colors"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-3.5 w-3.5" />
                            Hide items
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3.5 w-3.5" />
                            View items ({cart.items.length})
                          </>
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-2.5 space-y-1.5 bg-muted/40 p-2.5 rounded-md">
                          {cart.items.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs py-0.5"
                            >
                              <div className="truncate pr-2">
                                <span className="font-medium text-foreground">
                                  {item.productName}
                                </span>{" "}
                                <span className="text-muted-foreground">
                                  × {item.quantity} ({item.packagingLabel || item.baseUnit})
                                </span>
                              </div>
                              <span className="font-semibold shrink-0">
                                ₦{(item.unitPrice * item.quantity).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation to Discard a Held Cart */}
      <AlertDialog
        open={Boolean(cartToDiscard)}
        onOpenChange={(open) => !open && setCartToDiscard(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Discard Held Transaction?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to discard this held transaction? This cannot be undone and items will not be resumed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (cartToDiscard) {
                  await onDiscard(cartToDiscard);
                  setCartToDiscard(null);
                }
              }}
            >
              Discard Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation when Current Cart is NOT Empty */}
      <AlertDialog
        open={Boolean(cartToResume)}
        onOpenChange={(open) => !open && setCartToResume(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Replace Current Active Cart?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You currently have items in your active cart. Resuming "
              {cartToResume?.referenceLabel}" will overwrite the active cart.
              If you want to keep the current cart, please cancel and hold it first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleConfirmResumeOverwrite}
            >
              Overwrite & Resume
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

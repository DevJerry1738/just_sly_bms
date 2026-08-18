import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { PosCartItem } from "@/services/pos/pos.service";
import { Trash2, Plus, Minus, Layers } from "lucide-react";

interface CartPaneProps {
  items: PosCartItem[];
  onRemove: (productId: string) => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onUpdateUnit: (productId: string, packagingLabel?: string) => void;
  onCheckout: () => void;
  total: number;
}

export function CartPane({
  items,
  onRemove,
  onUpdateQuantity,
  onUpdateUnit,
  onCheckout,
  total,
}: CartPaneProps) {
  return (
    <Card className="h-full flex flex-col justify-between">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Cart</span>
          <span className="text-xs font-normal text-muted-foreground">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 flex-1 flex flex-col justify-between overflow-y-auto">
        {items.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No items in cart. Select a product to begin.
          </div>
        ) : (
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {items.map((item) => {
              const itemSubtotal = item.unitPrice * item.quantity;
              const hasPackaging = item.availablePackaging && item.availablePackaging.length > 0;

              return (
                <div key={item.productId} className="rounded-lg border p-3 bg-card space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <p className="font-medium text-sm leading-tight">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        ₦{item.unitPrice.toFixed(2)} / {item.packagingLabel || item.baseUnit}
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <span className="font-semibold text-sm">₦{itemSubtotal.toFixed(2)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => onRemove(item.productId)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
                    {/* Unit Selector */}
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <select
                        value={item.packagingLabel ?? item.baseUnit}
                        onChange={(e) => {
                          const val = e.target.value;
                          const selectedLabel = val === item.baseUnit ? undefined : val;
                          onUpdateUnit(item.productId, selectedLabel);
                        }}
                        className="h-7 text-xs bg-muted/50 rounded border border-input px-1.5 py-0 font-medium text-foreground w-full truncate focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                      >
                        <option value={item.baseUnit}>{item.baseUnit} (Base)</option>
                        {hasPackaging &&
                          item.availablePackaging!.map((pkg) => (
                            <option key={pkg.label} value={pkg.label}>
                              {pkg.label} ({pkg.unitsPerPackage} {item.baseUnit}s)
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Manual Quantity Stepper Input */}
                    <div className="flex items-center border rounded-md overflow-hidden bg-background shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-none border-r border-border/50"
                        onClick={() => {
                          if (item.quantity > 1) {
                            onUpdateQuantity(item.productId, item.quantity - 1);
                          } else {
                            onRemove(item.productId);
                          }
                        }}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>

                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val >= 1) {
                            onUpdateQuantity(item.productId, val);
                          }
                        }}
                        className="h-7 w-12 border-none rounded-none text-center text-xs font-semibold focus-visible:ring-0 p-0"
                      />

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-none border-l border-border/50"
                        onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-3 pt-3 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-medium">Subtotal</span>
            <span className="font-bold text-base">₦{total.toFixed(2)}</span>
          </div>
          <Button className="w-full" size="lg" onClick={onCheckout} disabled={items.length === 0}>
            Proceed to Checkout
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

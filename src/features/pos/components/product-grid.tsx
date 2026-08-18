import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package2 } from "lucide-react";

interface ProductGridProps {
  products: any[];
  loading: boolean;
  onAddToCart: (product: any) => void;
}

export function ProductGrid({ products, loading, onAddToCart }: ProductGridProps) {
  if (loading) {
    return <div className="col-span-full text-sm text-muted-foreground py-8 text-center">Loading products…</div>;
  }

  if (products.length === 0) {
    return <div className="col-span-full text-sm text-muted-foreground py-8 text-center">No products matched your search.</div>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => (
        <Card
          key={product.id}
          className="cursor-pointer transition hover:border-primary flex flex-col justify-between"
          onClick={() => onAddToCart(product)}
        >
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="truncate pr-2">{product.name}</span>
              <Package2 className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{product.code}</p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm font-semibold">
                ₦{product.retailPrice.toFixed(2)} / {product.baseUnit || "Piece"}
              </span>
              <Button variant="secondary" size="sm">
                Add
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

import { Package } from "lucide-react";

import { ModulePlaceholder } from "@/components/common/module-placeholder";

export function ProductsPage() {
  return (
    <ModulePlaceholder
      title="Products"
      description="Central product catalogue with categories, variants, barcodes and pricing tiers."
      icon={Package}
      capabilities={["Catalogue & categories", "Variants and units", "Retail & wholesale pricing", "Barcode / SKU registry", "Excel import", "Media assets"]}
    />
  );
}

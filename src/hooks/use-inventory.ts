import { useEffect, useState } from "react";
import { inventoryService, type InventoryItem, type InventoryQueryResult } from "@/services/inventory/inventory.service";
import { SyncManager } from "@/services/sync/sync-manager";

const emptyResult: InventoryQueryResult = {
  items: [],
  products: [],
  balances: [],
  categories: [],
  units: [],
  branch: null,
};

export function useInventory(branchId?: string) {
  const [data, setData] = useState<InventoryQueryResult>(emptyResult);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    if (!branchId) {
      setData(emptyResult);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const next = await inventoryService.getInventory(branchId);
    setData(next);
    setIsLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, [branchId]);

  useEffect(() => {
    const unsubscribe = SyncManager.subscribe((event) => {
      if (event === "sync:complete") {
        void refresh();
      }
    });
    return unsubscribe;
  }, [branchId]);

  return {
    items: data.items as InventoryItem[],
    products: data.products,
    balances: data.balances,
    categories: data.categories,
    units: data.units,
    branch: data.branch,
    isLoading,
    refresh,
  };
}

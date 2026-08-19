import { inventoryAlertService } from "@/services/inventory/inventory-alert.service";

let activeScan: Promise<number> | null = null;

export async function runExpiryScanner(): Promise<number> {
  if (activeScan) return activeScan;

  activeScan = inventoryAlertService
    .runExpiryScan()
    .then((alerts) => alerts.length)
    .finally(() => {
      activeScan = null;
    });

  return activeScan;
}

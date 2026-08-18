import { db } from "@/database/schema";
import { notificationService } from "./notification.service";
import { expiryWarningEvent } from "./notification-events";

export async function runExpiryScanner(): Promise<number> {
  const batches = await db.inventory_batches
    .filter((b) => b.status === "active" && !!b.expiryDate)
    .toArray();

  if (batches.length === 0) return 0;

  const now = new Date();
  const products = new Map((await db.products.toArray()).map((p) => [p.id, p]));
  const branches = new Map((await db.branches.toArray()).map((b) => [b.id, b]));

  let count = 0;

  for (const batch of batches) {
    if (!batch.expiryDate) continue;
    const expiry = new Date(batch.expiryDate);
    const diffTime = expiry.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Warn if expiring within 30 days or already expired
    if (daysRemaining <= 30) {
      const product = products.get(batch.productId);
      const branch = branches.get(batch.branchId);

      const event = expiryWarningEvent({
        productId: batch.productId,
        productName: product?.name || "Product",
        batchNumber: batch.batchNumber,
        branchId: batch.branchId,
        branchName: branch?.name || "HQ / Branch",
        expiryDate: batch.expiryDate,
        daysRemaining,
        quantity: batch.quantityOnHand,
      });

      const result = await notificationService.notify(event);
      if (result) count++;
    }
  }

  return count;
}

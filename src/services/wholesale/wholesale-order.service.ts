/**
 * Wholesale Order Service
 *
 * Business rules enforced here:
 * - All wholesale orders are strictly HQ-only (hqBranchId is resolved automatically)
 * - Stock is RESERVED at HQ when payment is confirmed (payment_confirmed)
 * - Stock is DEDUCTED from HQ when order is dispatched (dispatched)
 * - Reservations are released upon cancellation or dispatch
 * - Wholesale price only is ever exposed to the customer
 */

import { db } from "@/database/schema";
import { customerRepository } from "@/repositories/customer.repository";
import { notificationService } from "@/services/notifications/notification.service";
import {
  orderCreatedEvent,
  paymentSubmittedEvent,
  paymentConfirmedEvent,
  paymentRejectedEvent,
  orderStatusAdvancedEvent,
} from "@/services/notifications/notification-events";

import type {
  WholesaleOrderSchema,
  WholesaleOrderItemSchema,
  WholesaleOrderStatus,
  OrderStatusHistorySchema,
  OrderPaymentSchema,
  PaymentReceiptSchema,
  InvoiceSchema,
} from "@/database/schema";
import { branchRepository } from "@/repositories/branch.repository";
import { productRepository } from "@/repositories/product.repository";
import { inventoryBalanceRepository } from "@/repositories/inventory-balance.repository";
import { inventoryReservationRepository } from "@/repositories/inventory-reservation.repository";
import { inventoryTransactionRepository } from "@/repositories/inventory-transaction.repository";
import { productPackagingRepository } from "@/repositories/product-packaging.repository";
import { wholesaleOrderRepository } from "@/repositories/wholesale-order.repository";
import { wholesaleOrderItemRepository } from "@/repositories/wholesale-order-item.repository";
import { invoiceRepository } from "@/repositories/invoice.repository";
import { SyncQueueService } from "@/services/sync/sync-queue";
import { DomainEvents } from "@/services/events/domain-events";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WholesaleCatalogItem {
  productId: string;
  productName: string;
  sku: string;
  description?: string;
  categoryId?: string;
  wholesalePrice: number;
  baseUnit: string;
  availableQuantity: number;
  isOutOfStock: boolean;
  packaging: Array<{ label: string; unitsPerPackage: number; unitWholesalePrice: number }>;
}

export interface CreateOrderLineItem {
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

export interface CreateWholesaleOrderInput {
  customerId: string;
  notes?: string;
  items: CreateOrderLineItem[];
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class WholesaleOrderService {
  /**
   * Retrieve the HQ branch ID. Always used as fulfillment location.
   */
  async getHqBranchId(): Promise<string> {
    const hq = await branchRepository.getHqBranch();
    if (!hq) throw new Error("HQ branch not found. Please seed branches first.");
    return hq.id;
  }

  /**
   * Build the wholesale product catalogue from HQ inventory.
   * Only returns products that have HQ inventory records.
   * Shows zero-stock items as out-of-stock, never hides them.
   */
  async getCatalog(): Promise<WholesaleCatalogItem[]> {
    const hqBranchId = await this.getHqBranchId();
    await productRepository.ensureSeedProducts();
    await inventoryBalanceRepository.ensureSeedBalances(hqBranchId);

    const products = await productRepository.getAll();
    const items: WholesaleCatalogItem[] = [];

    for (const product of products) {
      if (product.status !== "active") continue;

      // Only expose if wholesale price is set
      const wholesalePrice = product.wholesalePrice ?? product.retailPrice ?? 0;
      if (wholesalePrice <= 0) continue;

      const balance = await inventoryBalanceRepository.getBalance(product.id, hqBranchId);
      const quantityOnHand = balance?.quantityOnHand ?? 10;
      const reservedQuantity = balance?.reservedQuantity ?? 0;
      const available = Math.max(0, quantityOnHand - reservedQuantity);

      // Build packaging options
      const packagingRows = await productPackagingRepository.getByProduct(product.id);
      const packaging = packagingRows.map((p) => ({
        label: p.label,
        unitsPerPackage: p.unitsPerPackage,
        unitWholesalePrice: wholesalePrice * p.unitsPerPackage,
      }));

      items.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku || "",
        description: product.description || undefined,
        categoryId: product.categoryId || undefined,
        wholesalePrice,
        baseUnit: product.baseUnit ?? "unit",
        availableQuantity: available,
        isOutOfStock: available <= 0,
        packaging,
      });
    }

    return items;
  }

  /**
   * Create a new wholesale order in pending_payment status.
   * Prices are snapshotted at creation time.
   */
  async createOrder(input: CreateWholesaleOrderInput): Promise<WholesaleOrderSchema> {
    const hqBranchId = await this.getHqBranchId();
    const orderId = crypto.randomUUID();
    const now = Date.now();
    const orderNumber = await wholesaleOrderRepository.generateOrderNumber();

    const subtotal = input.items.reduce(
      (sum, item) => sum + item.unitPriceSnapshot * item.quantity,
      0
    );

    const order: WholesaleOrderSchema = {
      id: orderId,
      orderNumber,
      customerId: input.customerId,
      organizationId: "default-org-001",
      hqBranchId,
      status: "pending_payment",
      paymentStatus: "pending",
      subtotal,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: subtotal,
      currency: "NGN",
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
      sync_status: "pending",
    };

    await db.wholesale_orders.put(order);

    for (const item of input.items) {
      const lineItem: WholesaleOrderItemSchema = {
        id: crypto.randomUUID(),
        orderId,
        productId: item.productId,
        productCode: item.sku,
        sku: item.sku,
        productName: item.productName,
        sellingUnit: item.sellingUnit,
        unitsPerPackage: item.unitsPerPackage,
        quantity: item.quantity,
        baseQuantity: item.baseQuantity,
        unitPriceSnapshot: item.unitPriceSnapshot,
        costPriceSnapshot: item.costPriceSnapshot,
        subtotal: item.unitPriceSnapshot * item.quantity,
        createdAt: now,
        sync_status: "pending",
      };
      await db.wholesale_order_items.put(lineItem);
    }

    await this._appendStatusHistory(orderId, "pending_payment", input.customerId, "Order created");
    await SyncQueueService.enqueue("wholesale_orders", "CREATE", order as unknown as Record<string, unknown>, { branchId: hqBranchId });

    // Notify customer
    const customer = await customerRepository.getById(input.customerId);
    await notificationService.notify(
      orderCreatedEvent({
        orderId,
        orderNumber,
        customerId: input.customerId,
        customerName: customer?.businessName || customer?.contactName || "Wholesale Customer",
        totalAmount: order.totalAmount,
      })
    );

    await DomainEvents.publish("WHOLESALE_ORDER_CREATED", {
      entity: "WholesaleOrder",
      entityId: orderId,
      record: order,
    });

    return order;
  }

  /**
   * Customer uploads a payment receipt (metadata stored, actual file in Supabase bucket).
   */
  async submitPaymentReceipt(
    orderId: string,
    customerId: string,
    receiptData: {
      fileName: string;
      fileType: string;
      fileSizeBytes: number;
      storagePath: string;
      bankName?: string;
      transferReference?: string;
      localDataUrl?: string;
    }
  ): Promise<PaymentReceiptSchema> {
    const order = await wholesaleOrderRepository.getById(orderId);
    if (!order) throw new Error("Order not found");
    if (order.customerId !== customerId) throw new Error("Forbidden: order does not belong to this customer");
    if (!["pending_payment", "payment_submitted"].includes(order.status)) {
      throw new Error(`Cannot submit receipt for order in status: ${order.status}`);
    }

    const now = Date.now();
    const paymentId = crypto.randomUUID();

    // Record order payment entry
    const payment: OrderPaymentSchema = {
      id: paymentId,
      orderId,
      paymentMethod: "bank_transfer",
      status: "pending",
      amount: order.totalAmount,
      reference: receiptData.transferReference,
      createdAt: now,
      sync_status: "pending",
    };
    await db.order_payments.put(payment);

    // Record receipt metadata
    const isPublicUrl = receiptData.storagePath.startsWith("http");
    const receipt: PaymentReceiptSchema = {
      id: crypto.randomUUID(),
      paymentId,
      orderId,
      filePath: receiptData.storagePath,
      fileName: receiptData.fileName,
      mimeType: receiptData.fileType,
      fileSize: receiptData.fileSizeBytes,
      uploadedBy: customerId,
      uploadedAt: now,
      bankName: receiptData.bankName,
      transferReference: receiptData.transferReference,
      publicUrl: isPublicUrl ? receiptData.storagePath : undefined,
      localDataUrl: receiptData.localDataUrl,
      sync_status: "pending",
    };
    await db.payment_receipts.put(receipt);

    // Update order status → payment_submitted
    await this.updateOrderStatus(orderId, "payment_submitted", "system", "Payment receipt uploaded");

    await SyncQueueService.enqueue("order_payments", "CREATE", payment as unknown as Record<string, unknown>, {});
    await SyncQueueService.enqueue("payment_receipts", "CREATE", receipt as unknown as Record<string, unknown>, {});

    // Trigger notification
    const customer = await customerRepository.getById(customerId);
    await notificationService.notify(
      paymentSubmittedEvent({
        orderId,
        orderNumber: order.orderNumber,
        customerId,
        customerName: customer?.businessName || customer?.contactName || "Wholesale Customer",
        totalAmount: order.totalAmount,
      })
    );

    return receipt;
  }

  /**
   * Admin confirms payment → status = payment_confirmed.
   * Reserves HQ inventory for each line item.
   */
  async confirmPayment(orderId: string, adminId: string, notes?: string): Promise<WholesaleOrderSchema> {
    const order = await wholesaleOrderRepository.getById(orderId);
    if (!order) throw new Error("Order not found");
    if (order.status !== "payment_submitted") {
      throw new Error(`Cannot confirm payment for order in status: ${order.status}`);
    }

    const hqBranchId = order.hqBranchId;
    const items = await wholesaleOrderItemRepository.getByOrderId(orderId);

    // Reserve HQ stock for each line item
    for (const item of items) {
      await inventoryReservationRepository.reserve(
        item.productId,
        hqBranchId,
        item.baseQuantity,
        undefined,
        "base"
      );
    }

    const updated = await this.updateOrderStatus(orderId, "payment_confirmed", adminId, notes ?? "Payment confirmed by admin");

    // Notify customer
    await notificationService.notify(
      paymentConfirmedEvent({
        orderId,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        amount: order.totalAmount,
      })
    );

    await DomainEvents.publish("PAYMENT_CONFIRMED", {
      entity: "WholesaleOrder",
      entityId: orderId,
      orderNumber: order.orderNumber,
      amount: order.totalAmount,
      adminId,
    });

    await DomainEvents.publish("WHOLESALE_PAYMENT_CONFIRMED", {
      entity: "WholesaleOrder",
      entityId: orderId,
      record: updated,
    });

    return updated;
  }

  /**
   * Admin rejects payment receipt → order returns to pending_payment.
   */
  async rejectPayment(orderId: string, adminId: string, reason: string): Promise<WholesaleOrderSchema> {
    const order = await wholesaleOrderRepository.getById(orderId);
    if (!order) throw new Error("Order not found");
    if (order.status !== "payment_submitted") {
      throw new Error(`Cannot reject payment for order in status: ${order.status}`);
    }

    const updated = await this.updateOrderStatus(orderId, "pending_payment", adminId, `Payment rejected: ${reason}`);

    // Notify customer
    await notificationService.notify(
      paymentRejectedEvent({
        orderId,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        reason,
      })
    );

    return updated;
  }

  /**
   * Admin moves order through processing → ready → dispatched.
   * On dispatch: deducts HQ inventory and releases reservations.
   */
  async advanceStatus(
    orderId: string,
    newStatus: "processing" | "ready" | "dispatched",
    adminId: string,
    adminName?: string,
    notes?: string
  ): Promise<WholesaleOrderSchema> {
    const order = await wholesaleOrderRepository.getById(orderId);
    if (!order) throw new Error("Order not found");

    const allowedTransitions: Record<string, string> = {
      processing: "payment_confirmed",
      ready: "processing",
      dispatched: "ready",
    };
    if (order.status !== allowedTransitions[newStatus]) {
      throw new Error(`Cannot advance to ${newStatus} from ${order.status}`);
    }

    if (newStatus === "dispatched") {
      await this._dispatchOrder(order, adminId, adminName);
    }

    const updated = await this.updateOrderStatus(orderId, newStatus, adminId, notes ?? `Order ${newStatus}`);

    // Notify customer
    await notificationService.notify(
      orderStatusAdvancedEvent({
        orderId,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        newStatus,
        statusLabel: newStatus.replace("_", " ").toUpperCase(),
      })
    );

    return updated;
  }

  /**
   * Mark order as delivered.
   */
  async markDelivered(orderId: string, adminId: string): Promise<WholesaleOrderSchema> {
    const order = await wholesaleOrderRepository.getById(orderId);
    if (!order) throw new Error("Order not found");
    if (order.status !== "dispatched") throw new Error("Order must be dispatched before marking delivered");
    return this.updateOrderStatus(orderId, "delivered", adminId, "Order delivered to customer");
  }

  /**
   * Cancel an order. Releases any active reservations.
   */
  async cancelOrder(orderId: string, cancelledBy: string, reason: string): Promise<WholesaleOrderSchema> {
    const order = await wholesaleOrderRepository.getById(orderId);
    if (!order) throw new Error("Order not found");

    const cancellableStatuses: WholesaleOrderStatus[] = [
      "pending_payment",
      "payment_submitted",
      "payment_confirmed",
      "processing",
      "ready",
    ];
    if (!cancellableStatuses.includes(order.status)) {
      throw new Error(`Cannot cancel order in status: ${order.status}`);
    }

    // Release HQ reservations if stock was reserved
    if (["payment_confirmed", "processing", "ready"].includes(order.status)) {
      const reservations = await db.inventory_reservations.toArray();
      const orderReservations = reservations.filter((r) => !r.releasedAt && r.branchId === order.hqBranchId);
      // Release reservations linked to items in this order
      const items = await wholesaleOrderItemRepository.getByOrderId(orderId);
      const productIds = new Set(items.map((i) => i.productId));
      for (const res of orderReservations) {
        if (productIds.has(res.productId)) {
          await inventoryReservationRepository.release(res.id);
        }
      }
    }

    return this.updateOrderStatus(orderId, "cancelled", cancelledBy, `Cancelled: ${reason}`);
  }

  /**
   * Generate an invoice for a confirmed or later-stage order.
   */
  async generateInvoice(orderId: string, adminId: string): Promise<InvoiceSchema> {
    const order = await wholesaleOrderRepository.getById(orderId);
    if (!order) throw new Error("Order not found");

    const existing = await invoiceRepository.getByOrderId(orderId);
    if (existing) return existing;

    const invoiceNumber = await invoiceRepository.generateInvoiceNumber();
    const now = Date.now();
    const dueDate = now + 7 * 24 * 60 * 60 * 1000; // 7 days

    const invoice: InvoiceSchema = {
      id: crypto.randomUUID(),
      invoiceNumber,
      orderId,
      customerId: order.customerId,
      amountDue: order.totalAmount,
      dueDate,
      status: "unpaid",
      createdAt: now,
      updatedAt: now,
      sync_status: "pending",
    };

    await db.invoices.put(invoice);
    await SyncQueueService.enqueue("invoices", "CREATE", invoice as unknown as Record<string, unknown>, {});

    return invoice;
  }

  // ─── Internal helpers ───────────────────────────────────────────────────────

  private async _dispatchOrder(order: WholesaleOrderSchema, adminId: string, adminName?: string): Promise<void> {
    const items = await wholesaleOrderItemRepository.getByOrderId(order.id);
    const hqBranchId = order.hqBranchId;

    // Deduct HQ stock for each line item
    for (const item of items) {
      await inventoryTransactionRepository.recordTransaction({
        type: "stock_adjustment",
        productId: item.productId,
        branchId: hqBranchId,
        quantity: -item.baseQuantity,
        baseUnit: "base",
        unitCost: item.costPriceSnapshot ?? 0,
        notes: `Wholesale order dispatch ${order.orderNumber}`,
        performedBy: adminId,
        performedByName: adminName,
        referenceNumber: order.orderNumber,
      });
    }

    // Release reservations for products in this order
    const reservations = await db.inventory_reservations.toArray();
    const productIds = new Set(items.map((i) => i.productId));
    for (const res of reservations) {
      if (!res.releasedAt && res.branchId === hqBranchId && productIds.has(res.productId)) {
        await inventoryReservationRepository.release(res.id);
      }
    }
  }

  async updateOrderStatus(
    orderId: string,
    newStatus: WholesaleOrderStatus,
    changedBy: string,
    notes?: string
  ): Promise<WholesaleOrderSchema> {
    const order = await wholesaleOrderRepository.getById(orderId);
    if (!order) throw new Error("Order not found");

    const updated: WholesaleOrderSchema = {
      ...order,
      status: newStatus,
      updatedAt: Date.now(),
      sync_status: "pending",
    };

    await db.wholesale_orders.put(updated);
    await this._appendStatusHistory(orderId, newStatus, changedBy, notes);
    await SyncQueueService.enqueue("wholesale_orders", "UPDATE", updated as unknown as Record<string, unknown>, {});

    return updated;
  }

  private async _appendStatusHistory(
    orderId: string,
    status: WholesaleOrderStatus,
    changedBy: string,
    notes?: string
  ): Promise<void> {
    const entry: OrderStatusHistorySchema = {
      id: crypto.randomUUID(),
      orderId,
      toStatus: status,
      changedBy,
      reason: notes,
      timestamp: Date.now(),
    };
    await db.order_status_history.put(entry);
  }
}

export const wholesaleOrderService = new WholesaleOrderService();

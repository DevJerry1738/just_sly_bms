import type { NotificationPriority, NotificationType } from "@/database/schema";

export interface NotificationEvent {
  type: NotificationType;
  priority: NotificationPriority;
  entityType: string;
  entityId: string;
  entityRoute?: string;
  data: Record<string, unknown>;
  organizationId?: string;
  branchId?: string;
  targetUserId?: string;
  targetCustomerId?: string;
}

export function orderCreatedEvent(data: {
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  totalAmount: number;
}): NotificationEvent {
  return {
    type: "order_created",
    priority: "info",
    entityType: "wholesale_order",
    entityId: data.orderId,
    entityRoute: "/wholesale-orders",
    data,
    targetCustomerId: data.customerId,
  };
}

export function paymentSubmittedEvent(data: {
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  totalAmount: number;
}): NotificationEvent {
  return {
    type: "payment_submitted",
    priority: "important",
    entityType: "wholesale_order",
    entityId: data.orderId,
    entityRoute: "/wholesale-orders",
    data,
    targetCustomerId: data.customerId,
  };
}

export function paymentConfirmedEvent(data: {
  orderId: string;
  orderNumber: string;
  customerId: string;
  amount: number;
}): NotificationEvent {
  return {
    type: "payment_confirmed",
    priority: "important",
    entityType: "wholesale_order",
    entityId: data.orderId,
    entityRoute: "/portal/orders",
    data,
    targetCustomerId: data.customerId,
  };
}

export function paymentRejectedEvent(data: {
  orderId: string;
  orderNumber: string;
  customerId: string;
  reason?: string;
}): NotificationEvent {
  return {
    type: "payment_rejected",
    priority: "critical",
    entityType: "wholesale_order",
    entityId: data.orderId,
    entityRoute: "/portal/orders",
    data,
    targetCustomerId: data.customerId,
  };
}

export function orderStatusAdvancedEvent(data: {
  orderId: string;
  orderNumber: string;
  customerId: string;
  newStatus: string;
  statusLabel: string;
}): NotificationEvent {
  return {
    type:
      data.newStatus === "processing"
        ? "order_processing"
        : data.newStatus === "ready"
        ? "order_ready"
        : data.newStatus === "dispatched"
        ? "order_dispatched"
        : "order_delivered",
    priority: "info",
    entityType: "wholesale_order",
    entityId: data.orderId,
    entityRoute: "/portal/orders",
    data,
    targetCustomerId: data.customerId,
  };
}

export function lowStockEvent(data: {
  productId: string;
  productName: string;
  branchId: string;
  branchName: string;
  quantityRemaining: number;
  threshold: number;
}): NotificationEvent {
  return {
    type: "low_stock",
    priority: "important",
    entityType: "inventory",
    entityId: `${data.productId}::${data.branchId}`,
    entityRoute: "/inventory",
    data,
    branchId: data.branchId,
  };
}

export function expiryWarningEvent(data: {
  productId: string;
  productName: string;
  batchNumber: string;
  branchId: string;
  branchName: string;
  expiryDate: string;
  daysRemaining: number;
  quantity: number;
}): NotificationEvent {
  return {
    type: data.daysRemaining <= 0 ? "expired_stock" : "expiry_warning",
    priority: data.daysRemaining <= 0 ? "critical" : data.daysRemaining <= 7 ? "important" : "info",
    entityType: "inventory_batch",
    entityId: `${data.productId}::${data.batchNumber}`,
    entityRoute: "/inventory",
    data,
    branchId: data.branchId,
  };
}

export function branchTransferEvent(data: {
  transferId: string;
  transferNumber: string;
  sourceBranchId: string;
  sourceBranchName: string;
  destinationBranchId: string;
  destinationBranchName: string;
  action: "created" | "accepted" | "rejected";
}): NotificationEvent {
  const typeMap = {
    created: "branch_transfer_created" as const,
    accepted: "branch_transfer_accepted" as const,
    rejected: "branch_transfer_rejected" as const,
  };
  return {
    type: typeMap[data.action],
    priority: data.action === "rejected" ? "critical" : "info",
    entityType: "inventory_transfer",
    entityId: data.transferId,
    entityRoute: "/inventory",
    data,
    branchId: data.destinationBranchId,
  };
}

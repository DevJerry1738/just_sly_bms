import type { NotificationEvent } from "./notification-events";

export function getNotificationContent(event: NotificationEvent): { title: string; message: string } {
  const d = event.data;

  switch (event.type) {
    case "order_created":
    case "new_wholesale_order":
      return {
        title: `New Wholesale Order ${d.orderNumber}`,
        message: `Order ${d.orderNumber} placed by ${d.customerName} for ₦${Number(d.totalAmount).toLocaleString()}.`,
      };

    case "payment_submitted":
    case "payment_receipt_submitted":
      return {
        title: `Payment Submitted — ${d.orderNumber}`,
        message: `${d.customerName} uploaded a payment receipt for order ${d.orderNumber}.`,
      };

    case "payment_confirmed":
      return {
        title: `Payment Confirmed — ${d.orderNumber}`,
        message: `Your payment for order ${d.orderNumber} has been confirmed. Processing order now.`,
      };

    case "payment_rejected":
      return {
        title: `Payment Receipt Rejected — ${d.orderNumber}`,
        message: `Payment receipt for ${d.orderNumber} was rejected.${d.reason ? ` Reason: ${d.reason}` : ""}`,
      };

    case "order_processing":
      return {
        title: `Order Processing — ${d.orderNumber}`,
        message: `Order ${d.orderNumber} is now being processed at HQ warehouse.`,
      };

    case "order_ready":
      return {
        title: `Order Ready — ${d.orderNumber}`,
        message: `Order ${d.orderNumber} is packed and ready for dispatch.`,
      };

    case "order_dispatched":
      return {
        title: `Order Dispatched — ${d.orderNumber}`,
        message: `Order ${d.orderNumber} has been dispatched for delivery.`,
      };

    case "order_delivered":
      return {
        title: `Order Delivered — ${d.orderNumber}`,
        message: `Order ${d.orderNumber} has been marked as delivered. Thank you!`,
      };

    case "order_cancelled":
      return {
        title: `Order Cancelled — ${d.orderNumber}`,
        message: `Order ${d.orderNumber} has been cancelled.`,
      };

    case "low_stock":
      return {
        title: `Low Stock: ${d.productName}`,
        message: `${d.productName} has ${d.quantityRemaining} units remaining at ${d.branchName} (threshold: ${d.threshold}).`,
      };

    case "expiry_warning":
      return {
        title: `Expiring Soon: ${d.productName}`,
        message: `Batch ${d.batchNumber} of ${d.productName} (${d.quantity} units) expires in ${d.daysRemaining} days (${d.expiryDate}).`,
      };

    case "expired_stock":
      return {
        title: `EXPIRED: ${d.productName}`,
        message: `Batch ${d.batchNumber} of ${d.productName} (${d.quantity} units) at ${d.branchName} expired on ${d.expiryDate}.`,
      };

    case "branch_transfer_created":
      return {
        title: `New Branch Transfer ${d.transferNumber}`,
        message: `Transfer ${d.transferNumber} created from ${d.sourceBranchName} to ${d.destinationBranchName}.`,
      };

    case "branch_transfer_accepted":
      return {
        title: `Transfer Accepted — ${d.transferNumber}`,
        message: `Transfer ${d.transferNumber} was accepted by ${d.destinationBranchName}.`,
      };

    case "branch_transfer_rejected":
      return {
        title: `Transfer Rejected — ${d.transferNumber}`,
        message: `Transfer ${d.transferNumber} was rejected by ${d.destinationBranchName}.`,
      };

    default:
      return {
        title: "System Notification",
        message: String(d.message || "An operational update has occurred."),
      };
  }
}

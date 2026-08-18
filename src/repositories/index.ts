export { BaseRepository } from "./base.repository";
export {
  productsRepository,
  inventoryRepository,
  salesRepository,
  ordersRepository,
  customersRepository,
  notificationsRepository,
  ProductsRepository,
  InventoryRepository,
  SalesRepository,
  OrdersRepository,
  CustomersRepository,
  NotificationsRepository,
} from "./entity.repositories";

// Sprint 3 — Product & Pricing Management
export { unitOfMeasureRepository, UnitOfMeasureRepository, DEFAULT_UNITS } from "./unit-of-measure.repository";
export { categoryRepository, CategoryRepository } from "./category.repository";
export { productRepository, ProductRepository, generateProductCode, isProductCodeUnique } from "./product.repository";
export { productPackagingRepository, ProductPackagingRepository } from "./product-packaging.repository";
export { priceHistoryRepository, PriceHistoryRepository } from "./price-history.repository";
export { auditLogRepository, AuditLogRepository } from "./audit-log.repository";

// Sprint 4 — Inventory Management
export { inventoryTransactionRepository, InventoryTransactionRepository } from "./inventory-transaction.repository";
export { inventoryBalanceRepository, InventoryBalanceRepository } from "./inventory-balance.repository";
export { inventoryBatchRepository, InventoryBatchRepository } from "./inventory-batch.repository";
export { inventoryAdjustmentRepository, InventoryAdjustmentRepository } from "./inventory-adjustment.repository";
export { inventoryAlertRepository, InventoryAlertRepository } from "./inventory-alert.repository";
export { stockCountRepository, StockCountRepository } from "./stock-count.repository";

// Sprint 6 — Retail POS
export { saleItemsRepository, SaleItemsRepository } from "./sale-items.repository";
export { salePaymentsRepository, SalePaymentsRepository } from "./sale-payments.repository";
export { saleVoidsRepository, SaleVoidsRepository } from "./sale-voids.repository";

// Sprint 7 — Wholesale Portal
export { customerRepository, CustomerRepository } from "./customer.repository";
export { wholesaleOrderRepository, WholesaleOrderRepository } from "./wholesale-order.repository";
export { wholesaleOrderItemRepository, WholesaleOrderItemRepository } from "./wholesale-order-item.repository";
export { paymentReceiptRepository, PaymentReceiptRepository } from "./payment-receipt.repository";
export { invoiceRepository, InvoiceRepository } from "./invoice.repository";

// Organization settings (bank transfer, branding)
export { organizationRepository, OrganizationRepository, DEFAULT_ORGANIZATION_ID } from "./organization.repository";

// Sprint 8 — Notifications
export { notificationRepository, NotificationRepository } from "./notification.repository";
export { notificationDeliveryRepository, NotificationDeliveryRepository } from "./notification-delivery.repository";
export { notificationPreferenceRepository, NotificationPreferenceRepository } from "./notification-preference.repository";


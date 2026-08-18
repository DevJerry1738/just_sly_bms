import { BaseRepository } from "./base.repository";
import { db, type EmailTemplateSchema } from "@/database/schema";

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplateSchema[] = [
  {
    id: "tpl-wholesale-received",
    key: "wholesale_order_received",
    category: "wholesale",
    name: "Wholesale Order Received",
    subject: "Order Confirmation - Order #{{order_number}}",
    body: "Hello {{customer_name}},\n\nThank you for your order! We have received your wholesale order #{{order_number}} totaling {{order_total}}.\n\nPlease proceed to submit payment using the instructions provided.\n\nBest regards,\n{{business_name}}",
    variables: ["customer_name", "order_number", "order_total", "business_name"],
    isActive: true,
    isSystem: true,
    updatedAt: 1700000000000,
    sync_status: "synced",
  },
  {
    id: "tpl-wholesale-payment-submitted",
    key: "wholesale_payment_submitted",
    category: "wholesale",
    name: "Payment Received Notification",
    subject: "Payment Upload Received - Order #{{order_number}}",
    body: "Hello {{customer_name}},\n\nWe have received your payment proof for order #{{order_number}}. Our finance team will review and confirm your payment shortly.\n\nThank you,\n{{business_name}}",
    variables: ["customer_name", "order_number", "business_name"],
    isActive: true,
    isSystem: true,
    updatedAt: 1700000000000,
    sync_status: "synced",
  },
  {
    id: "tpl-wholesale-confirmed",
    key: "wholesale_payment_confirmed",
    category: "wholesale",
    name: "Wholesale Order Confirmed",
    subject: "Payment Confirmed - Order #{{order_number}}",
    body: "Hello {{customer_name}},\n\nYour payment for order #{{order_number}} ({{order_total}}) has been confirmed. Your order is now being processed for dispatch from {{branch_name}}.\n\nThank you for your business,\n{{business_name}}",
    variables: ["customer_name", "order_number", "order_total", "branch_name", "business_name"],
    isActive: true,
    isSystem: true,
    updatedAt: 1700000000000,
    sync_status: "synced",
  },
  {
    id: "tpl-wholesale-dispatched",
    key: "wholesale_order_dispatched",
    category: "wholesale",
    name: "Wholesale Order Dispatched",
    subject: "Order Dispatched - Order #{{order_number}}",
    body: "Hello {{customer_name}},\n\nGreat news! Your order #{{order_number}} has been dispatched. Reference / Tracking: {{tracking_reference}}.\n\nThank you,\n{{business_name}}",
    variables: ["customer_name", "order_number", "tracking_reference", "business_name"],
    isActive: true,
    isSystem: true,
    updatedAt: 1700000000000,
    sync_status: "synced",
  },
  {
    id: "tpl-inventory-low-stock",
    key: "inventory_low_stock",
    category: "inventory",
    name: "Low Stock Alert",
    subject: "Low Stock Alert: {{product_name}} at {{branch_name}}",
    body: "Attention Inventory Team,\n\nProduct '{{product_name}}' (SKU: {{product_sku}}) at {{branch_name}} has dropped below the low stock threshold.\n\nCurrent Quantity: {{current_qty}}\nReorder Point: {{reorder_threshold}}\n\nPlease initiate reorder or transfer.\n\n{{business_name}} Inventory Engine",
    variables: ["product_name", "product_sku", "branch_name", "current_qty", "reorder_threshold", "business_name"],
    isActive: true,
    isSystem: true,
    updatedAt: 1700000000000,
    sync_status: "synced",
  },
  {
    id: "tpl-inventory-expiry",
    key: "inventory_expiry_warning",
    category: "inventory",
    name: "Expiry Warning Alert",
    subject: "Batch Expiry Warning: {{product_name}}",
    body: "Attention Manager,\n\nBatch #{{batch_number}} of product '{{product_name}}' at {{branch_name}} is expiring on {{expiry_date}}.\n\nQuantity Remaining: {{batch_qty}}\n\nPlease take appropriate sales discount or disposal action.\n\n{{business_name}} System Alert",
    variables: ["batch_number", "product_name", "branch_name", "expiry_date", "batch_qty", "business_name"],
    isActive: true,
    isSystem: true,
    updatedAt: 1700000000000,
    sync_status: "synced",
  },
  {
    id: "tpl-transfer-created",
    key: "transfer_created",
    category: "transfer",
    name: "Branch Transfer Request Created",
    subject: "New Stock Transfer #{{transfer_number}}",
    body: "Hello {{destination_branch}} Manager,\n\nA new stock transfer (#{{transfer_number}}) has been created from {{source_branch}} to {{destination_branch}}.\n\nPlease log in to review and accept the transfer upon arrival.\n\n{{business_name}} System",
    variables: ["transfer_number", "source_branch", "destination_branch", "business_name"],
    isActive: true,
    isSystem: true,
    updatedAt: 1700000000000,
    sync_status: "synced",
  },
];

export class EmailTemplateRepository extends BaseRepository<EmailTemplateSchema> {
  constructor() {
    super("email_templates", db.email_templates);
  }

  /** Fetch all email templates, seeding defaults if table is empty */
  async getAllTemplates(): Promise<EmailTemplateSchema[]> {
    const existing = await this.getAll();
    if (existing.length > 0) return existing;

    const now = Date.now();
    const seeded: EmailTemplateSchema[] = DEFAULT_EMAIL_TEMPLATES.map((t) => ({
      ...t,
      updatedAt: now,
    }));

    for (const item of seeded) {
      await this.table.put(item);
    }
    return seeded;
  }

  /** Find template by key */
  async getByKey(key: string): Promise<EmailTemplateSchema | undefined> {
    return this.table.where("key").equals(key).first();
  }
}

export const emailTemplateRepository = new EmailTemplateRepository();

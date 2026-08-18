import { organizationRepository } from "@/repositories/organization.repository";
import { productRepository } from "@/repositories/product.repository";
import { emailTemplateRepository } from "@/repositories/email-template.repository";
import { DomainEvents } from "@/services/events/domain-events";
import type { OrganizationSchema, ProductSchema, EmailTemplateSchema } from "@/database/schema";

export class SystemSettingsService {
  /**
   * Resolve effective low-stock threshold for a product:
   * 1. Product-specific lowStockThreshold (if > 0)
   * 2. Organization default_low_stock_threshold (if set)
   * 3. Fallback default = 5
   */
  async getLowStockThreshold(product?: Partial<ProductSchema>): Promise<number> {
    if (product?.lowStockThreshold && product.lowStockThreshold > 0) {
      return product.lowStockThreshold;
    }
    const org = await organizationRepository.getPrimaryOrganization();
    return org.default_low_stock_threshold ?? 5;
  }

  /**
   * Update system-wide default low-stock threshold.
   * Option to bulk-update existing products if explicitly requested.
   */
  async updateLowStockDefault(
    newThreshold: number,
    adminId: string,
    adminName?: string,
    applyToExisting = false
  ): Promise<OrganizationSchema> {
    const orgBefore = await organizationRepository.getPrimaryOrganization();
    const prevThreshold = orgBefore.default_low_stock_threshold ?? 5;

    const updatedOrg = await organizationRepository.updatePrimaryOrganization({
      default_low_stock_threshold: newThreshold,
    });

    if (applyToExisting) {
      const allProducts = await productRepository.getAll();
      for (const p of allProducts) {
        await productRepository.updateProduct(p.id, {
          lowStockThreshold: newThreshold,
          updatedByUserId: adminId,
          updatedByName: adminName,
        });
      }
    }

    await DomainEvents.publish("LOW_STOCK_DEFAULT_CHANGED", {
      entity: "OrganizationSettings",
      entityId: updatedOrg.id,
      userId: adminId,
      actorName: adminName,
      before: { default_low_stock_threshold: prevThreshold },
      after: { default_low_stock_threshold: newThreshold, appliedToExisting: applyToExisting },
      description: `Changed default low stock threshold from ${prevThreshold} to ${newThreshold}${applyToExisting ? " (applied to all existing products)" : ""}`,
    });

    return updatedOrg;
  }

  /**
   * Update notification channel preferences per category
   */
  async updateNotificationChannels(
    channels: Record<string, { inApp: boolean; email: boolean; whatsapp: boolean }>,
    adminId: string,
    adminName?: string
  ): Promise<OrganizationSchema> {
    const orgBefore = await organizationRepository.getPrimaryOrganization();

    const updatedOrg = await organizationRepository.updatePrimaryOrganization({
      notification_channels: channels,
    });

    await DomainEvents.publish("NOTIFICATION_SETTINGS_CHANGED", {
      entity: "OrganizationSettings",
      entityId: updatedOrg.id,
      userId: adminId,
      actorName: adminName,
      before: { notification_channels: orgBefore.notification_channels },
      after: { notification_channels: channels },
      description: "Updated system notification channel preferences",
    });

    return updatedOrg;
  }

  /**
   * Update an email template
   */
  async updateEmailTemplate(
    templateId: string,
    updates: { subject: string; body: string; isActive: boolean },
    adminId: string,
    adminName?: string
  ): Promise<EmailTemplateSchema> {
    const before = await emailTemplateRepository.getById(templateId);
    if (!before) throw new Error(`Template ${templateId} not found`);

    const now = Date.now();
    const updated: EmailTemplateSchema = {
      ...before,
      subject: updates.subject,
      body: updates.body,
      isActive: updates.isActive,
      updatedBy: adminName || adminId,
      updatedAt: now,
      sync_status: "pending",
    };

    await emailTemplateRepository.update(templateId, updated);

    await DomainEvents.publish("EMAIL_TEMPLATE_CHANGED", {
      entity: "EmailTemplate",
      entityId: templateId,
      userId: adminId,
      actorName: adminName,
      before: { subject: before.subject, body: before.body, isActive: before.isActive },
      after: { subject: updated.subject, body: updated.body, isActive: updated.isActive },
      description: `Updated email template '${before.name}' (${before.key})`,
    });

    return updated;
  }
}

export const systemSettingsService = new SystemSettingsService();

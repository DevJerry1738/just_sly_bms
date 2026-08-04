import { BaseRepository } from "./base.repository";
import { db, type InventoryReservationSchema } from "@/database/schema";
import { SyncQueueService } from "@/services/sync/sync-queue";
import { DomainEvents } from "@/services/events/domain-events";
import { inventoryBalanceService } from "@/services/inventory/inventory-balance.service";

// ---------------------------------------------------------------------------
// InventoryReservationRepository
// ---------------------------------------------------------------------------

export class InventoryReservationRepository extends BaseRepository<InventoryReservationSchema> {
  constructor() {
    super("inventory_reservations", db.inventory_reservations);
  }

  /**
   * Reserve stock for a transfer. Prevents overselling.
   * Throws if not enough available stock.
   */
  async reserve(
    productId: string,
    branchId: string,
    quantity: number,
    transferId?: string,
    baseUnit?: string
  ): Promise<InventoryReservationSchema> {
    if (quantity <= 0) {
      throw new Error("Reservation quantity must be positive");
    }

    // Check available stock (on hand - reserved)
    const available = await this.getAvailableQuantity(productId, branchId);
    if (available < quantity) {
      throw new Error(
        `Insufficient stock available. Requested: ${quantity}, Available: ${available}`
      );
    }

    const now = Date.now();
    const reservation: InventoryReservationSchema = {
      id: crypto.randomUUID(),
      productId,
      branchId,
      transferId,
      quantityReserved: quantity,
      baseUnit: baseUnit || "base",
      createdAt: now,
      sync_status: "pending",
    };

    await db.inventory_reservations.put(reservation);
    await SyncQueueService.enqueue(
      "inventory_reservations",
      "CREATE",
      reservation as unknown as Record<string, unknown>,
      { branchId }
    );
    await DomainEvents.publish("RESERVATION_CREATED", {
      entity: "InventoryReservation",
      entityId: reservation.id,
      record: reservation,
    });

    return reservation;
  }

  /**
   * Release a reservation (e.g., when transfer is cancelled or rejected).
   */
  async release(reservationId: string): Promise<void> {
    const reservation = await this.getById(reservationId);
    if (!reservation) {
      throw new Error(`[Repository] InventoryReservation with id "${reservationId}" not found`);
    }

    if (reservation.releasedAt) {
      throw new Error("Reservation already released");
    }

    const updated: InventoryReservationSchema = {
      ...reservation,
      releasedAt: Date.now(),
      sync_status: "pending",
    };

    await db.inventory_reservations.put(updated);
    await SyncQueueService.enqueue(
      "inventory_reservations",
      "UPDATE",
      updated as unknown as Record<string, unknown>,
      { branchId: reservation.branchId }
    );
    await DomainEvents.publish("RESERVATION_RELEASED", {
      entity: "InventoryReservation",
      entityId: reservationId,
      record: updated,
    });
  }

  /**
   * Release all reservations for a transfer (e.g., when transfer is cancelled).
   */
  async releaseByTransfer(transferId: string): Promise<void> {
    const reservations = await db.inventory_reservations
      .where("transferId")
      .equals(transferId)
      .toArray();

    for (const reservation of reservations) {
      if (!reservation.releasedAt) {
        await this.release(reservation.id);
      }
    }
  }

  /**
   * Get total reserved quantity for a product at a branch.
   */
  async getReservedQuantity(productId: string, branchId: string): Promise<number> {
    const reservations = await db.inventory_reservations.toArray();
    return reservations
      .filter(
        (r) =>
          r.productId === productId && r.branchId === branchId && !r.releasedAt
      )
      .reduce((sum, r) => sum + r.quantityReserved, 0);
  }

  /**
   * Get available quantity (on hand - reserved - damaged, etc).
   * Uses inventoryBalanceService to get current on-hand quantity.
   */
  async getAvailableQuantity(productId: string, branchId: string): Promise<number> {
    const balance = await inventoryBalanceService.getBalance(productId, branchId);
    if (!balance) return 0;

    const reserved = await this.getReservedQuantity(productId, branchId);
    const available = Math.max(0, balance.quantityOnHand - balance.reservedQuantity - reserved);
    return available;
  }

  /**
   * Get all active reservations for a branch.
   */
  async getActiveReservationsByBranch(branchId: string): Promise<InventoryReservationSchema[]> {
    const reservations = await db.inventory_reservations.toArray();
    return reservations.filter((r) => r.branchId === branchId && !r.releasedAt);
  }

  /**
   * Get all reservations for a specific transfer.
   */
  async getByTransfer(transferId: string): Promise<InventoryReservationSchema[]> {
    return db.inventory_reservations
      .where("transferId")
      .equals(transferId)
      .toArray();
  }
}

export const inventoryReservationRepository = new InventoryReservationRepository();

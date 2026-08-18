import { db } from "@/database/schema";
import type { PaymentReceiptSchema } from "@/database/schema";
import { BaseRepository } from "./base.repository";

export class PaymentReceiptRepository extends BaseRepository<PaymentReceiptSchema> {
  constructor() {
    super("payment_receipts", db.payment_receipts);
  }

  /** Find receipt by order ID */
  async getByOrderId(orderId: string): Promise<PaymentReceiptSchema | undefined> {
    return db.payment_receipts.where("orderId").equals(orderId).first();
  }

  /** Find receipt by payment ID */
  async getByPaymentId(paymentId: string): Promise<PaymentReceiptSchema | undefined> {
    return db.payment_receipts.where("paymentId").equals(paymentId).first();
  }
}

export const paymentReceiptRepository = new PaymentReceiptRepository();

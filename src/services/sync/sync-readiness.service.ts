import { db } from "@/database/schema";
import { branchContextService } from "@/services/branch/branch-context.service";
import { productRepository } from "@/repositories/product.repository";
import { categoryRepository } from "@/repositories/category.repository";
import { unitOfMeasureRepository } from "@/repositories/unit-of-measure.repository";
import { inventoryBalanceRepository } from "@/repositories/inventory-balance.repository";

export interface SyncReadinessState {
  isReady: boolean;
  isBootstrapping: boolean;
  reason?: string;
  productCount: number;
  branchCount: number;
  inventoryCount: number;
}

class SyncReadinessService {
  private state: SyncReadinessState = {
    isReady: false,
    isBootstrapping: true,
    reason: "Initializing local data",
    productCount: 0,
    branchCount: 0,
    inventoryCount: 0,
  };

  getState(): SyncReadinessState {
    return this.state;
  }

  async bootstrapCriticalData(user: { id?: string | null; email?: string | null } | null, profile: { branch_id?: string | null } | null): Promise<SyncReadinessState> {
    this.state = { ...this.state, isBootstrapping: true, reason: "Loading critical data" };

    try {
      const [branches, products, categories, units] = await Promise.all([
        db.branches.count(),
        productRepository.getAll(),
        categoryRepository.getActiveCategories(),
        unitOfMeasureRepository.getActiveUnits(),
      ]);

      const branchResult = await branchContextService.resolveForUser(user, profile);
      const branchId = branchResult.activeBranch?.id;
      let inventoryCount = 0;
      if (branchId) {
        inventoryCount = (await inventoryBalanceRepository.getByBranch(branchId)).length;
      }

      this.state = {
        isReady: Boolean(branchResult.activeBranch && products.length > 0),
        isBootstrapping: false,
        reason: branchResult.activeBranch ? undefined : "No branch has been assigned to your account.",
        productCount: products.length,
        branchCount: branches,
        inventoryCount,
      };
      return this.state;
    } catch (error) {
      console.error("[SyncReadinessService] Bootstrap failed", error);
      this.state = {
        ...this.state,
        isBootstrapping: false,
        isReady: false,
        reason: error instanceof Error ? error.message : "Bootstrap failed",
      };
      return this.state;
    }
  }
}

export const syncReadinessService = new SyncReadinessService();

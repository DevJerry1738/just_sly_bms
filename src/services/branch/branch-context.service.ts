import { db, type BranchSchema } from "@/database/schema";
import { branchRepository } from "@/repositories/branch.repository";

export type BranchResolutionStatus = "ready" | "no-branch-assigned" | "no-branches" | "loading" | "error";

export interface BranchResolutionResult {
  branches: BranchSchema[];
  activeBranch: BranchSchema | null;
  status: BranchResolutionStatus;
  reason?: string;
}

interface CurrentUserLike {
  id?: string | null;
  email?: string | null;
}

interface CurrentProfileLike {
  branch_id?: string | null;
}

class BranchContextService {
  private static readonly STORAGE_KEY = "justsly.active_branch_id";
  private listeners = new Set<(state: BranchResolutionResult) => void>();
  private currentState: BranchResolutionResult = {
    branches: [],
    activeBranch: null,
    status: "loading",
    reason: "Loading branch context",
  };

  subscribe(listener: (state: BranchResolutionResult) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(state: BranchResolutionResult): void {
    this.currentState = state;
    this.listeners.forEach((listener) => listener(state));
  }

  getCurrentState(): BranchResolutionResult {
    return this.currentState;
  }

  async resolveForUser(user: CurrentUserLike | null, profile: CurrentProfileLike | null): Promise<BranchResolutionResult> {
    try {
      const branches = await branchRepository.ensureSeedBranches();
      if (branches.length === 0) {
        const state: BranchResolutionResult = { branches: [], activeBranch: null, status: "no-branches", reason: "No branches are available yet." };
        this.emit(state);
        return state;
      }

      let activeBranch: BranchSchema | null = null;
      const storedId = typeof window !== "undefined" ? window.localStorage.getItem(BranchContextService.STORAGE_KEY) : null;

      if (user && profile?.branch_id) {
        activeBranch = branches.find((branch) => branch.id === profile.branch_id) ?? null;
      }

      if (!activeBranch && user) {
        const allStaff = await db.staff.toArray();
        const staffMember = allStaff.find(
          (entry) =>
            (user.id && entry.authUserId === user.id) ||
            (user.email && entry.email.toLowerCase() === user.email.toLowerCase())
        );

        if (staffMember?.branchId) {
          activeBranch = branches.find((branch) => branch.id === staffMember.branchId) ?? null;
        }
      }

      if (!activeBranch && storedId) {
        activeBranch = branches.find((branch) => branch.id === storedId) ?? null;
      }

      if (!activeBranch && this.currentState.activeBranch) {
        activeBranch = branches.find((branch) => branch.id === this.currentState.activeBranch?.id) ?? null;
      }

      if (activeBranch && typeof window !== "undefined") {
        window.localStorage.setItem(BranchContextService.STORAGE_KEY, activeBranch.id);
      }

      const status: BranchResolutionStatus = activeBranch ? "ready" : "no-branch-assigned";
      const state: BranchResolutionResult = {
        branches,
        activeBranch,
        status,
        reason: activeBranch ? undefined : "No branch has been assigned to your account.",
      };

      this.emit(state);
      return state;
    } catch (error) {
      console.error("[BranchContextService] Error resolving branch context", error);
      const state: BranchResolutionResult = {
        branches: [],
        activeBranch: null,
        status: "error",
        reason: error instanceof Error ? error.message : "Unable to resolve branch context.",
      };
      this.emit(state);
      return state;
    }
  }

  async setActiveBranchId(id: string, branches: BranchSchema[]): Promise<BranchResolutionResult> {
    if (id === "ALL") {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(BranchContextService.STORAGE_KEY, "ALL");
      }
      const state: BranchResolutionResult = {
        branches,
        activeBranch: null,
        status: "ready",
        reason: undefined,
      };
      this.emit(state);
      return state;
    }

    const target = branches.find((branch) => branch.id === id) ?? null;
    if (!target) {
      return this.getCurrentState();
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(BranchContextService.STORAGE_KEY, target.id);
    }

    const state: BranchResolutionResult = {
      branches,
      activeBranch: target,
      status: "ready",
      reason: undefined,
    };

    this.emit(state);
    return state;
  }
}

export const branchContextService = new BranchContextService();

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { BranchSchema } from "@/database/schema";
import { useAuth } from "@/providers/auth-provider";
import { branchContextService, type BranchResolutionResult } from "@/services/branch/branch-context.service";
import { SyncManager } from "@/services/sync/sync-manager";

interface BranchContextValue {
  activeBranch: BranchSchema | null;
  branches: BranchSchema[];
  setActiveBranchId: (id: string) => void;
  isLoading: boolean;
  refetchBranches: () => Promise<void>;
}

const BranchContext = createContext<BranchContextValue | null>(null);
const STORAGE_KEY = "justsly.active_branch_id";

export function BranchProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [branches, setBranches] = useState<BranchSchema[]>([]);
  const [activeBranch, setActiveBranch] = useState<BranchSchema | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<BranchResolutionResult["status"]>("loading");

  const loadBranches = async () => {
    setIsLoading(true);
    const result = await branchContextService.resolveForUser(user, profile);
    setBranches(result.branches);
    setActiveBranch(result.activeBranch);
    setStatus(result.status);
    setIsLoading(false);
  };

  useEffect(() => {
    void loadBranches();
  }, [user?.id, user?.email, profile?.branch_id]);

  useEffect(() => {
    const unsubscribe = SyncManager.subscribe((event) => {
      if (event === "sync:complete") {
        void loadBranches();
      }
    });
    return unsubscribe;
  }, [user?.id, user?.email, profile?.branch_id]);

  useEffect(() => {
    const unsubscribe = branchContextService.subscribe((state) => {
      setBranches(state.branches);
      setActiveBranch(state.activeBranch);
      setStatus(state.status);
      setIsLoading(state.status === "loading");
    });
    return unsubscribe;
  }, []);

  const setActiveBranchId = async (id: string) => {
    const result = await branchContextService.setActiveBranchId(id, branches);
    setBranches(result.branches);
    setActiveBranch(result.activeBranch);
    setStatus(result.status);
  };

  const value = useMemo<BranchContextValue>(
    () => ({
      activeBranch,
      branches,
      setActiveBranchId,
      isLoading,
      refetchBranches: loadBranches,
    }),
    [activeBranch, branches, isLoading],
  );

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error("useBranch must be used within <BranchProvider>");
  return ctx;
}

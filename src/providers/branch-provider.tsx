import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { BranchSchema } from "@/database/schema";
import { branchRepository } from "@/repositories/branch.repository";

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
  const [branches, setBranches] = useState<BranchSchema[]>([]);
  const [activeBranch, setActiveBranch] = useState<BranchSchema | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadBranches = async () => {
    try {
      const list = await branchRepository.ensureSeedBranches();
      setBranches(list);

      const storedId = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      const found = list.find((b) => b.id === storedId) || list[0] || null;
      setActiveBranch(found);
    } catch (err) {
      console.error("[BranchProvider] Error loading branches:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  const setActiveBranchId = (id: string) => {
    const target = branches.find((b) => b.id === id);
    if (target) {
      setActiveBranch(target);
      localStorage.setItem(STORAGE_KEY, target.id);
    }
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

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  RotateCcw,
  Search,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Lock,
  Sparkles,
  Info,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { userPermissionOverrideRepository } from "@/repositories/user-permission-override.repository";
import { roleRepository } from "@/repositories/role.repository";
import { useAuth } from "@/providers/auth-provider";
import { useAuthorization } from "@/hooks/use-authorization";
import type { StaffSchema, RoleSchema, UserPermissionOverrideSchema } from "@/database/schema";
import {
  ROLE_PERMISSIONS,
  PROTECTED_PERMISSIONS,
  type Permission,
  type PermissionCategory,
  type SystemRoleCode,
} from "@/types/rbac";

interface StaffPermissionsTabProps {
  staff: StaffSchema;
  role?: RoleSchema | null;
  onUpdated?: () => void;
}

interface PermissionRow {
  permission: Permission;
  category: string;
  label: string;
  description: string;
  source: "GRANT" | "DENY" | "ROLE" | "DEFAULT_DENY" | "PROTECTED";
  isInherited: boolean;
  isGranted: boolean;
  isDenied: boolean;
  isProtected: boolean;
  override?: UserPermissionOverrideSchema;
}

const CATEGORY_LABELS: Record<string, string> = {
  dashboard: "Dashboard & Overview",
  pos: "Point of Sale (POS)",
  sales: "Sales & Wholesale Orders",
  products: "Products & Pricing",
  inventory: "Inventory & Stock Control",
  customers: "Customer Accounts",
  branches: "Branches & Operations",
  staff: "Staff & User Management",
  reports: "Reports & Analytics",
  notifications: "Notifications",
  audit_logs: "Audit Logs",
  settings: "System Settings",
};

const ALL_PERMISSIONS_CATALOG: { permission: Permission; category: string; label: string; description: string }[] = [
  // Dashboard
  { permission: "dashboard:view", category: "dashboard", label: "View Dashboard", description: "Access main dashboard overview metrics" },

  // POS
  { permission: "sales:create", category: "pos", label: "Process Sales (POS)", description: "Create checkout transactions at POS" },
  { permission: "sales:print", category: "pos", label: "Print Receipts", description: "Print or reprint customer POS receipts" },

  // Sales & Wholesale
  { permission: "sales:view", category: "sales", label: "View Sales History", description: "Browse past retail and POS transaction logs" },
  { permission: "wholesale:view", category: "sales", label: "View Wholesale Orders", description: "Browse wholesale customer orders desk" },
  { permission: "wholesale:manage", category: "sales", label: "Manage Wholesale Orders", description: "Confirm payments, dispatch and deliver wholesale orders" },
  { permission: "sales:approve", category: "sales", label: "Approve Discounts & Refunds", description: "Authorize special discounts or voided transactions" },
  { permission: "sales:export", category: "sales", label: "Export Sales Data", description: "Download CSV reports of sales history" },

  // Products
  { permission: "products:view", category: "products", label: "View Products", description: "Browse product catalog and packaging details" },
  { permission: "products:create", category: "products", label: "Create Products", description: "Add new items and packaging rules to catalog" },
  { permission: "products:update", category: "products", label: "Edit Products", description: "Update product titles, SKUs, and units" },
  { permission: "products:import", category: "products", label: "Import Products", description: "Bulk upload CSV product catalog files" },
  { permission: "pricing:view", category: "products", label: "View Selling Prices", description: "View customer prices across packaging types" },
  { permission: "pricing:edit", category: "products", label: "Edit Prices", description: "Modify product selling prices" },
  { permission: "products:view_cost", category: "products", label: "View Cost Prices", description: "View product purchase unit costs (Protected)" },
  { permission: "products:edit_cost", category: "products", label: "Edit Cost Prices", description: "Modify product unit purchase costs (Protected)" },

  // Inventory
  { permission: "inventory:view", category: "inventory", label: "View Inventory Balances", description: "View current branch stock levels and batches" },
  { permission: "inventory:adjust", category: "inventory", label: "Adjust Inventory Stock", description: "Perform manual stock additions or deductions" },
  { permission: "inventory:opening_stock", category: "inventory", label: "Set Opening Stock", description: "Initialize opening stock balances for new items" },
  { permission: "inventory:stock_count", category: "inventory", label: "Perform Stock Counts", description: "Start and submit physical stock audit sessions" },
  { permission: "inventory:manage_batches", category: "inventory", label: "Manage Batches & Expiry", description: "Create, edit, or offload batch expiry records" },
  { permission: "inventory:acknowledge_alerts", category: "inventory", label: "Acknowledge Alerts", description: "Clear or acknowledge inventory warnings" },
  { permission: "inventory:export", category: "inventory", label: "Export Stock Reports", description: "Download inventory valuation and balance files" },
  { permission: "inventory:view_cost", category: "inventory", label: "View Inventory Cost Valuation", description: "Access total FIFO cost valuation reports (Protected)" },

  // Customers
  { permission: "customers:view", category: "customers", label: "View Customers", description: "View customer list and account balances" },
  { permission: "customers:create", category: "customers", label: "Create Customer Accounts", description: "Register new wholesale or retail customers" },
  { permission: "customers:update", category: "customers", label: "Edit Customer Info", description: "Update customer contact and credit limit details" },

  // Branches
  { permission: "branches:view", category: "branches", label: "View Branches", description: "See branch office locations and details" },
  { permission: "branches:create", category: "branches", label: "Create Branches", description: "Add new store locations to organization" },
  { permission: "branches:update", category: "branches", label: "Edit Branch Info", description: "Update store configuration and address" },

  // Staff
  { permission: "staff:view", category: "staff", label: "View Staff List", description: "See team members and roles" },
  { permission: "staff:create", category: "staff", label: "Create Staff", description: "Register new staff users" },
  { permission: "staff:update", category: "staff", label: "Edit Staff Info", description: "Update employee role and branch assignment" },
  { permission: "staff:permissions", category: "staff", label: "Manage Individual Permissions", description: "Grant or deny custom permission overrides (Protected)" },

  // Reports
  { permission: "reports:view", category: "reports", label: "View Reports & Analytics", description: "Access executive charts and business analytics" },
  { permission: "reports:export", category: "reports", label: "Export Financial Analytics", description: "Download CSV business intelligence reports" },

  // System
  { permission: "notifications:view", category: "notifications", label: "View In-App Notifications", description: "Receive activity and alert notifications" },
  { permission: "audit_logs:view", category: "audit_logs", label: "View Audit Trail", description: "Browse system audit logs and domain events" },
  { permission: "audit_logs:export", category: "audit_logs", label: "Export Audit Logs", description: "Download audit log entries (Protected)" },
  { permission: "settings:view", category: "settings", label: "View System Settings", description: "See organization settings" },
  { permission: "settings:manage", category: "settings", label: "Manage System Settings", description: "Update organization details (Protected / Super Admin)" },
];

export function StaffPermissionsTab({ staff, role, onUpdated }: StaffPermissionsTabProps) {
  const { user: currentUser } = useAuth();
  const { isSuperAdmin, hasPermission: currentHasPermission, refetchPermissions: refreshCurrentAuth } = useAuthorization();

  const [overrides, setOverrides] = useState<UserPermissionOverrideSchema[]>([]);
  const [rolePerms, setRolePerms] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "inherited" | "granted" | "denied" | "protected">("all");

  // Change confirmation dialog state
  const [changeTarget, setChangeTarget] = useState<{
    permission: Permission;
    label: string;
    targetEffect: "INHERITED" | "GRANT" | "DENY";
    currentEffect: "INHERITED" | "GRANT" | "DENY";
  } | null>(null);
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Bulk reset confirmation dialog
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Bulk module grant/revoke dialog
  const [bulkTarget, setBulkTarget] = useState<{ category: string; action: "grant_all" | "revoke_all" | "reset" } | null>(null);

  const loadData = useCallback(async () => {
    if (!staff.id) return;
    setIsLoading(true);
    try {
      const userOverrides = await userPermissionOverrideRepository.getOverridesForUser(staff.id, staff.authUserId, staff.email);
      setOverrides(userOverrides || []);

      // Resolve role permissions
      let resolvedRolePerms: Permission[] = [];
      const roleCode = (role?.code || staff.roleId || staff.role) as SystemRoleCode | undefined;
      if (roleCode && ROLE_PERMISSIONS[roleCode]) {
        resolvedRolePerms = ROLE_PERMISSIONS[roleCode];
      } else {
        resolvedRolePerms = ROLE_PERMISSIONS["sales_staff"];
      }
      setRolePerms(resolvedRolePerms);
    } catch (err) {
      console.error("[StaffPermissionsTab] Error loading permission overrides:", err);
      toast.error("Failed to load staff permissions.");
    } finally {
      setIsLoading(false);
    }
  }, [staff.id, staff.role, role?.code]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Compute permission row models
  const permissionRows = useMemo<PermissionRow[]>(() => {
    return ALL_PERMISSIONS_CATALOG.map((item) => {
      const isProtected = PROTECTED_PERMISSIONS.includes(item.permission);
      const override = overrides.find((o) => o.permissionId === item.permission);
      const inRole = rolePerms.includes(item.permission);

      let source: PermissionRow["source"] = "DEFAULT_DENY";
      if (isProtected && !isSuperAdmin) {
        source = "PROTECTED";
      } else if (override?.effect === "DENY") {
        source = "DENY";
      } else if (override?.effect === "GRANT") {
        source = "GRANT";
      } else if (inRole) {
        source = "ROLE";
      }

      return {
        ...item,
        source,
        isInherited: !override,
        isGranted: source === "GRANT" || (source === "ROLE" && !override),
        isDenied: source === "DENY" || source === "DEFAULT_DENY",
        isProtected,
        override,
      };
    });
  }, [overrides, rolePerms, isSuperAdmin]);

  // Summary counts
  const summary = useMemo(() => {
    const total = permissionRows.length;
    const granted = permissionRows.filter((r) => r.override?.effect === "GRANT").length;
    const denied = permissionRows.filter((r) => r.override?.effect === "DENY").length;
    const inherited = permissionRows.filter((r) => !r.override).length;
    const protectedCount = permissionRows.filter((r) => r.isProtected).length;
    return { total, granted, denied, inherited, protectedCount };
  }, [permissionRows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return permissionRows.filter((row) => {
      const matchSearch =
        row.label.toLowerCase().includes(search.toLowerCase()) ||
        row.description.toLowerCase().includes(search.toLowerCase()) ||
        row.permission.toLowerCase().includes(search.toLowerCase()) ||
        row.category.toLowerCase().includes(search.toLowerCase());

      if (!matchSearch) return false;

      if (statusFilter === "inherited") return row.isInherited;
      if (statusFilter === "granted") return row.override?.effect === "GRANT";
      if (statusFilter === "denied") return row.override?.effect === "DENY";
      if (statusFilter === "protected") return row.isProtected;

      return true;
    });
  }, [permissionRows, search, statusFilter]);

  // Group by category
  const groupedRows = useMemo(() => {
    const map = new Map<string, PermissionRow[]>();
    for (const row of filteredRows) {
      const list = map.get(row.category) || [];
      list.push(row);
      map.set(row.category, list);
    }
    return map;
  }, [filteredRows]);

  // Check delegation authority
  const canManagePermissions = isSuperAdmin || currentHasPermission("staff:permissions");

  const initiateChange = (row: PermissionRow, targetEffect: "INHERITED" | "GRANT" | "DENY") => {
    if (!canManagePermissions) {
      toast.error("You are not authorized to manage staff permissions.");
      return;
    }

    if (row.isProtected && !isSuperAdmin) {
      toast.error("Protected permissions can only be delegated by Super Admin.");
      return;
    }

    // Delegation safeguard: actor must have the permission themselves before granting it to another user
    if (targetEffect === "GRANT" && !isSuperAdmin && !currentHasPermission(row.permission)) {
      toast.error(`You cannot grant "${row.label}" because you do not hold this permission yourself.`);
      return;
    }

    // Admin self-protection safeguard: Admin cannot remove their own final permission management access
    if (currentUser?.id === staff.id && row.permission === "staff:permissions" && targetEffect === "DENY") {
      toast.error("Safeguard: You cannot revoke your own staff permission management access.");
      return;
    }

    const currentEffect = row.override?.effect ? row.override.effect : "INHERITED";
    if (currentEffect === targetEffect) return;

    setChangeTarget({
      permission: row.permission,
      label: row.label,
      targetEffect,
      currentEffect,
    });
    setReason("");
  };

  const handleConfirmChange = async () => {
    if (!changeTarget || !staff.id) return;
    setIsSaving(true);
    try {
      const additionalUserIds = [staff.authUserId, staff.email].filter(Boolean) as string[];
      const canonicalUserId = staff.authUserId ?? staff.id;
      if (changeTarget.targetEffect === "INHERITED") {
        await userPermissionOverrideRepository.removeOverride(canonicalUserId, changeTarget.permission, currentUser?.id, additionalUserIds);
        toast.success(`Reset "${changeTarget.label}" to role inheritance.`);
      } else {
        await userPermissionOverrideRepository.setOverride(
          canonicalUserId,
          changeTarget.permission,
          changeTarget.targetEffect,
          reason,
          currentUser?.id ?? "admin",
          "org-default",
          additionalUserIds
        );
        toast.success(`Updated "${changeTarget.label}" to ${changeTarget.targetEffect}.`);
      }

      await loadData();
      if (currentUser?.id === staff.id) {
        await refreshCurrentAuth();
      }
      if (onUpdated) onUpdated();
      setChangeTarget(null);
    } catch (err) {
      console.error("[StaffPermissionsTab] Error saving permission override:", err);
      toast.error("Failed to save permission change.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetAll = async () => {
    if (!staff.id) return;
    setIsSaving(true);
    try {
      const canonicalUserId = staff.authUserId ?? staff.id;
      const additionalUserIds = [staff.authUserId, staff.email].filter(Boolean) as string[];
      const count = await userPermissionOverrideRepository.resetUserOverrides(canonicalUserId, currentUser?.id, additionalUserIds);
      toast.success(`Cleared ${count} custom permission overrides for ${staff.firstName} ${staff.lastName}.`);
      await loadData();
      if (currentUser?.id === staff.id) {
        await refreshCurrentAuth();
      }
      if (onUpdated) onUpdated();
      setIsResetConfirmOpen(false);
    } catch (err) {
      console.error("[StaffPermissionsTab] Error resetting overrides:", err);
      toast.error("Failed to reset permission overrides.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkModuleAction = async () => {
    if (!bulkTarget || !staff.id) return;
    setIsSaving(true);
    try {
      const canonicalUserId = staff.authUserId ?? staff.id;
      const additionalUserIds = [staff.authUserId, staff.email].filter(Boolean) as string[];
      const catRows = ALL_PERMISSIONS_CATALOG.filter((p) => p.category === bulkTarget.category);
      let updatedCount = 0;

      for (const row of catRows) {
        // Skip protected permissions if not super admin
        if (PROTECTED_PERMISSIONS.includes(row.permission) && !isSuperAdmin) continue;

        if (bulkTarget.action === "grant_all") {
          // Delegation safeguard
          if (!isSuperAdmin && !currentHasPermission(row.permission)) continue;
          await userPermissionOverrideRepository.setOverride(canonicalUserId, row.permission, "GRANT", "Bulk grant by module", currentUser?.id, "org-default", additionalUserIds);
          updatedCount++;
        } else if (bulkTarget.action === "revoke_all") {
          await userPermissionOverrideRepository.setOverride(canonicalUserId, row.permission, "DENY", "Bulk revoke by module", currentUser?.id, "org-default", additionalUserIds);
          updatedCount++;
        } else if (bulkTarget.action === "reset") {
          await userPermissionOverrideRepository.removeOverride(canonicalUserId, row.permission, currentUser?.id, additionalUserIds);
          updatedCount++;
        }
      }

      toast.success(`Updated ${updatedCount} permissions in ${CATEGORY_LABELS[bulkTarget.category] || bulkTarget.category}.`);
      await loadData();
      if (currentUser?.id === staff.id) {
        await refreshCurrentAuth();
      }
      if (onUpdated) onUpdated();
      setBulkTarget(null);
    } catch (err) {
      console.error("[StaffPermissionsTab] Bulk module update error:", err);
      toast.error("Failed to apply bulk module changes.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-card/60 backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base">
              {staff.firstName} {staff.lastName}
            </h3>
            <Badge variant="outline" className="font-mono text-xs">
              {role?.name || staff.role || "Staff"}
            </Badge>
            {overrides.length > 0 && (
              <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs">
                {overrides.length} Custom Overrides
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {staff.email} • Assigned to {staff.branchId ? "Authorized Branch" : "All Branches"}
          </p>
        </div>

        {canManagePermissions && overrides.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsResetConfirmOpen(true)}
            className="text-rose-500 hover:text-rose-600 border-rose-500/30 hover:bg-rose-500/10 shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Reset to Role Defaults
          </Button>
        )}
      </div>

      {/* Metric Cards Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-3 bg-muted/20">
          <p className="text-[11px] text-muted-foreground font-medium">Total Matrix</p>
          <p className="text-xl font-bold mt-0.5">{summary.total}</p>
        </Card>
        <Card className="p-3 bg-muted/20">
          <p className="text-[11px] text-muted-foreground font-medium">Inherited</p>
          <p className="text-xl font-bold mt-0.5 text-slate-400">{summary.inherited}</p>
        </Card>
        <Card className="p-3 bg-emerald-500/5 border-emerald-500/20">
          <p className="text-[11px] text-emerald-500 font-medium">Explicit Grants</p>
          <p className="text-xl font-bold mt-0.5 text-emerald-500">{summary.granted}</p>
        </Card>
        <Card className="p-3 bg-rose-500/5 border-rose-500/20">
          <p className="text-[11px] text-rose-500 font-medium">Explicit Denies</p>
          <p className="text-xl font-bold mt-0.5 text-rose-500">{summary.denied}</p>
        </Card>
        <Card className="p-3 bg-amber-500/5 border-amber-500/20">
          <p className="text-[11px] text-amber-500 font-medium">Protected</p>
          <p className="text-xl font-bold mt-0.5 text-amber-500">{summary.protectedCount}</p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-xl border">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <Input
            placeholder="Search permissions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <Tabs value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)} className="w-full sm:w-auto">
          <TabsList className="h-9 text-xs w-full sm:w-auto">
            <TabsTrigger value="all">All ({permissionRows.length})</TabsTrigger>
            <TabsTrigger value="inherited">Inherited ({summary.inherited})</TabsTrigger>
            <TabsTrigger value="granted">Granted ({summary.granted})</TabsTrigger>
            <TabsTrigger value="denied">Denied ({summary.denied})</TabsTrigger>
            <TabsTrigger value="protected">Protected ({summary.protectedCount})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Main Permissions Matrix Table grouped by Module */}
      {isLoading ? (
        <div className="p-12 text-center text-sm text-muted-foreground bg-card border rounded-xl">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 opacity-60" />
          Loading permissions catalog...
        </div>
      ) : groupedRows.size === 0 ? (
        <div className="p-12 text-center text-sm text-muted-foreground bg-card border rounded-xl space-y-1">
          <Info className="w-6 h-6 text-muted-foreground mx-auto mb-1 opacity-70" />
          <p className="font-semibold text-foreground">No permissions found</p>
          <p className="text-xs text-muted-foreground">Try clearing search or changing status filter criteria.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(groupedRows.entries()).map(([category, rows]) => {
            const catTitle = CATEGORY_LABELS[category] || category.toUpperCase();
            return (
              <Card key={category} className="overflow-hidden border">
                {/* Module Header Bar */}
                <div className="flex items-center justify-between p-3.5 bg-muted/40 border-b">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    <h4 className="font-semibold text-sm">{catTitle}</h4>
                    <Badge variant="outline" className="text-[10px] uppercase font-mono">
                      {rows.length} perms
                    </Badge>
                  </div>

                  {canManagePermissions && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 px-2"
                        onClick={() => setBulkTarget({ category, action: "grant_all" })}
                      >
                        Grant All
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 px-2"
                        onClick={() => setBulkTarget({ category, action: "revoke_all" })}
                      >
                        Revoke All
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 px-2"
                        onClick={() => setBulkTarget({ category, action: "reset" })}
                      >
                        Reset Module
                      </Button>
                    </div>
                  )}
                </div>

                {/* Permission Rows */}
                <div className="divide-y divide-border">
                  {rows.map((row) => {
                    const currentEffect = row.override?.effect ? row.override.effect : "INHERITED";
                    return (
                      <div
                        key={row.permission}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 gap-3 hover:bg-muted/20 transition-colors"
                      >
                        <div className="space-y-0.5 max-w-xl">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{row.label}</span>
                            {row.isProtected && (
                              <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-500 bg-amber-500/5">
                                <Lock className="w-3 h-3 mr-1" /> Protected
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{row.description}</p>
                        </div>

                        {/* Permission State Indicator & Control */}
                        <div className="flex items-center gap-3 shrink-0">
                          {/* Visual Indicator */}
                          <div className="flex items-center gap-1.5 text-xs font-medium">
                            {row.override?.effect === "GRANT" ? (
                              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1 px-2 py-0.5">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                Explicitly Granted
                              </Badge>
                            ) : row.override?.effect === "DENY" ? (
                              <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/30 gap-1 px-2 py-0.5">
                                <XCircle className="w-3 h-3 text-rose-400" />
                                Explicitly Denied
                              </Badge>
                            ) : row.source === "ROLE" ? (
                              <Badge variant="outline" className="text-slate-300 border-slate-700 bg-slate-800/40 gap-1 px-2 py-0.5">
                                <ShieldCheck className="w-3 h-3 text-slate-400" />
                                Inherited from Role
                              </Badge>
                            ) : row.source === "PROTECTED" ? (
                              <Badge variant="outline" className="text-amber-400 border-amber-500/30 bg-amber-500/10 gap-1 px-2 py-0.5">
                                <Lock className="w-3 h-3 text-amber-400" />
                                Super Admin Only
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-slate-500 border-slate-800 gap-1 px-2 py-0.5">
                                <ShieldOff className="w-3 h-3 text-slate-500" />
                                Default Denied
                              </Badge>
                            )}
                          </div>

                          {/* Control Dropdown */}
                          {canManagePermissions && (
                            <Select
                              value={currentEffect}
                              onValueChange={(val: any) => initiateChange(row, val)}
                              disabled={row.isProtected && !isSuperAdmin}
                            >
                              <SelectTrigger className="w-32 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="INHERITED">Inherited</SelectItem>
                                <SelectItem value="GRANT">Grant</SelectItem>
                                <SelectItem value="DENY">Deny</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Permission Change Confirmation Dialog */}
      <Dialog open={!!changeTarget} onOpenChange={(open) => !open && setChangeTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-primary" />
              Confirm Permission Change
            </DialogTitle>
            <DialogDescription>
              You are updating access settings for <strong>{staff.firstName} {staff.lastName}</strong>.
            </DialogDescription>
          </DialogHeader>

          {changeTarget && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 rounded-lg border bg-muted/30 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Permission:</span>
                  <span className="font-semibold">{changeTarget.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current State:</span>
                  <span className="font-medium capitalize">{changeTarget.currentEffect}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">New State:</span>
                  <span className="font-bold text-primary capitalize">{changeTarget.targetEffect}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reason-input" className="text-xs font-semibold">
                  Reason for change (Optional)
                </Label>
                <Textarea
                  id="reason-input"
                  placeholder="e.g. Promoted to temporary branch inventory supervisor..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="text-xs resize-none h-20"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setChangeTarget(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirmChange} disabled={isSaving}>
              {isSaving ? "Saving..." : "Confirm Change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Reset Confirmation Dialog */}
      <Dialog open={isResetConfirmOpen} onOpenChange={setIsResetConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-500">
              <RotateCcw className="w-5 h-5" />
              Reset Permissions to Role Defaults?
            </DialogTitle>
            <DialogDescription>
              This will remove all <strong>{overrides.length} custom permission overrides</strong> for{" "}
              <strong>{staff.firstName} {staff.lastName}</strong> and restore access strictly based on the{" "}
              <strong>{role?.name || staff.role || "Role"}</strong> default configuration.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsResetConfirmOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleResetAll} disabled={isSaving}>
              {isSaving ? "Resetting..." : "Reset All Overrides"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Module Dialog */}
      <Dialog open={!!bulkTarget} onOpenChange={(open) => !open && setBulkTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Confirm Module Bulk Action
            </DialogTitle>
            <DialogDescription>
              Apply bulk update across all permissions in{" "}
              <strong>{bulkTarget ? CATEGORY_LABELS[bulkTarget.category] || bulkTarget.category : ""}</strong> for{" "}
              <strong>{staff.firstName} {staff.lastName}</strong>.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setBulkTarget(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleBulkModuleAction} disabled={isSaving}>
              {isSaving ? "Applying..." : "Apply Bulk Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

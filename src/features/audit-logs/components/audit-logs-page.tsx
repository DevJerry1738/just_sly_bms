import { useState, useEffect, useCallback } from "react";
import { formatSafe } from "@/lib/format-date";
import {
  ScrollText,
  Search,
  Download,
  Filter,
  RefreshCw,
  Eye,
  ShieldAlert,
  Calendar,
  User,
  Building,
  Tag,
} from "lucide-react";
import { toast } from "sonner";

import { useAuthorization } from "@/hooks/use-authorization";
import { useBranch } from "@/providers/branch-provider";
import { auditLogRepository, type AuditLogFilters } from "@/repositories/audit-log.repository";
import { branchRepository } from "@/repositories/branch.repository";
import type { AuditLogSchema, BranchSchema } from "@/database/schema";
import { DomainEvents } from "@/services/events/domain-events";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CardsSkeleton } from "@/components/common/skeletons";
import { AuditDetailDrawer } from "./audit-detail-drawer";

export function AuditLogsPage() {
  const { hasPermission, isSuperAdmin } = useAuthorization();
  const { activeBranch } = useBranch();
  const canView = hasPermission("audit_logs:view");
  const canExport = hasPermission("audit_logs:export");

  const [logs, setLogs] = useState<AuditLogSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<BranchSchema[]>([]);
  const [actors, setActors] = useState<{ userId: string; userName: string }[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditLogSchema | null>(null);

  // Filters state
  const [filters, setFilters] = useState<AuditLogFilters>({
    module: "ALL",
    userId: "ALL",
    branchId: "ALL",
    search: "",
  });

  const loadData = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const [fetchedLogs, fetchedBranches, fetchedActors, fetchedModules] = await Promise.all([
        auditLogRepository.queryLogs(
          isSuperAdmin ? filters : { ...filters, branchId: activeBranch?.id ?? "NONE" },
          150,
        ),
        isSuperAdmin
          ? branchRepository.getAll()
          : Promise.resolve(activeBranch ? [activeBranch] : []),
        auditLogRepository.getActors(),
        auditLogRepository.getModules(),
      ]);
      setLogs(fetchedLogs);
      setBranches(fetchedBranches);
      setActors(fetchedActors);
      setModules(fetchedModules);
    } catch (err) {
      console.error("[AuditLogsPage] Failed to load audit logs:", err);
      toast.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [activeBranch, canView, filters, isSuperAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Export CSV
  const handleExport = async () => {
    if (!canExport) {
      toast.error("You do not have permission to export audit logs");
      return;
    }

    try {
      const exportLogs = await auditLogRepository.queryLogs(filters, 1000);
      if (exportLogs.length === 0) {
        toast.info("No audit logs match current filters to export");
        return;
      }

      const headers = ["Timestamp", "Date", "Actor", "User ID", "Module", "Action", "Entity", "Entity ID", "Description", "IP Address"];
      const rows = exportLogs.map((l) => [
        l.timestamp,
        `"${formatSafe(l.timestamp, "yyyy-MM-dd HH:mm:ss")}"`,

        `"${(l.userName || "System").replace(/"/g, '""')}"`,
        `"${l.userId}"`,
        `"${(l.module || l.entity).replace(/"/g, '""')}"`,
        `"${l.action}"`,
        `"${l.entity}"`,
        `"${l.entityId}"`,
        `"${(l.description || "").replace(/"/g, '""')}"`,
        `"${l.ipAddress || ""}"`,
      ]);

      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Audit_Logs_${formatSafe(Date.now(), "yyyyMMdd_HHmmss")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Self-audit the export event
      await DomainEvents.publish("AUDIT_EXPORTED", {
        description: `Exported ${exportLogs.length} audit records to CSV`,
        count: exportLogs.length,
        filters,
      });

      toast.success(`Successfully exported ${exportLogs.length} audit log records`);
    } catch (err) {
      console.error("[AuditLogsPage] Export failed:", err);
      toast.error("Failed to export audit logs");
    }
  };

  if (!canView) {
    return (
      <div className="p-12 text-center space-y-4 animate-fade-in">
        <ShieldAlert className="size-12 mx-auto text-destructive" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          You do not have administrative permission to view system audit logs. This security event has been logged.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Audit Logs"
        description="Immutable record of user access, inventory adjustments, POS transactions, and administrative changes across all branches."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={`size-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            {canExport && (
              <Button variant="default" size="sm" onClick={handleExport}>
                <Download className="size-4 mr-1.5" /> Export CSV
              </Button>
            )}
          </div>
        }
      />

      {/* Filter Toolbar */}
      <Card className="border shadow-xs">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search action, actor, entity..."
                className="pl-9 h-9 text-xs"
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              />
            </div>

            {/* Module Filter */}
            <Select value={filters.module} onValueChange={(val) => setFilters((prev) => ({ ...prev, module: val }))}>
              <SelectTrigger className="h-9 text-xs">
                <Tag className="size-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Filter Module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Modules</SelectItem>
                {modules.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* User / Actor Filter */}
            <Select value={filters.userId} onValueChange={(val) => setFilters((prev) => ({ ...prev, userId: val }))}>
              <SelectTrigger className="h-9 text-xs">
                <User className="size-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Filter Actor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Actors</SelectItem>
                {actors.map((a) => (
                  <SelectItem key={a.userId} value={a.userId}>
                    {a.userName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Branch Filter */}
            <Select value={filters.branchId} onValueChange={(val) => setFilters((prev) => ({ ...prev, branchId: val }))}>
              <SelectTrigger className="h-9 text-xs">
                <Building className="size-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Filter Branch" />
              </SelectTrigger>
              <SelectContent>
                {isSuperAdmin && <SelectItem value="ALL">All Branches</SelectItem>}
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      {loading ? (
        <CardsSkeleton count={3} />
      ) : logs.length === 0 ? (
        <Card className="p-12 text-center">
          <ScrollText className="size-10 mx-auto text-muted-foreground/60 mb-3" />
          <h3 className="text-sm font-semibold">No Audit Records Found</h3>
          <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters or search terms.</p>
        </Card>
      ) : (
        <div className="border rounded-lg bg-card overflow-hidden shadow-xs">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[180px] text-xs">Timestamp</TableHead>
                <TableHead className="text-xs">Actor</TableHead>
                <TableHead className="text-xs">Module</TableHead>
                <TableHead className="text-xs">Action / Event</TableHead>
                <TableHead className="text-xs">Description</TableHead>
                <TableHead className="w-[80px] text-right text-xs">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id} className="hover:bg-muted/30 text-xs">
                  <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                    {formatSafe(log.timestamp, "dd MMM yyyy HH:mm:ss")}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div>{log.userName || "System"}</div>
                    {log.branchId && <div className="text-[10px] text-muted-foreground font-mono">Branch: {log.branchId}</div>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-[10px] uppercase bg-muted/50">
                      {String(log.module || log.entity || "SYSTEM")}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono font-medium">
                    <span className="text-primary">{log.action}</span>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {String(log.description || `${log.action} on ${log.entity} (${log.entityId})`)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => setSelectedLog(log)}>
                      <Eye className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Drawer */}
      <AuditDetailDrawer log={selectedLog} open={!!selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  );
}

import { useState } from "react";
import { formatSafe } from "@/lib/format-date";
import { User, Calendar, Shield, Activity, FileJson, ChevronRight } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AuditLogSchema } from "@/database/schema";

interface AuditDetailDrawerProps {
  log: AuditLogSchema | null;
  open: boolean;
  onClose: () => void;
}

export function AuditDetailDrawer({ log, open, onClose }: AuditDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<"diff" | "raw">("diff");

  if (!log) return null;

  const before = log.before || {};
  const after = log.after || {};

  // Compute key-value differences between before and after objects
  const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  const diffs = allKeys
    .filter((k) => k !== "updatedAt" && k !== "updated_at" && k !== "sync_status")
    .map((key) => {
      const valBefore = before[key];
      const valAfter = after[key];
      const isChanged = JSON.stringify(valBefore) !== JSON.stringify(valAfter);
      return { key, valBefore, valAfter, isChanged };
    });

  const changedDiffs = diffs.filter((d) => d.isChanged);

  return (
    <Drawer open={open} onOpenChange={(val) => !val && onClose()}>
      <DrawerContent className="max-w-3xl mx-auto max-h-[85vh] flex flex-col">
        <DrawerHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs uppercase bg-muted">
                  {log.module || log.entity}
                </Badge>
                <Badge variant="secondary" className="font-mono text-xs">
                  {log.action}
                </Badge>
              </div>
              <DrawerTitle className="text-lg font-semibold tracking-tight">
                {log.description || `${log.action} on ${log.entity}`}
              </DrawerTitle>
              <DrawerDescription className="text-xs text-muted-foreground">
                Audit Event ID: <span className="font-mono">{log.id}</span>
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Metadata Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-card border rounded-lg space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <User className="size-3.5" /> Actor
              </div>
              <p className="text-sm font-medium truncate">{log.userName || "System"}</p>
              <p className="text-[11px] text-muted-foreground font-mono truncate">{log.userId}</p>
            </div>

            <div className="p-3 bg-card border rounded-lg space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="size-3.5" /> Timestamp
              </div>
              <p className="text-sm font-medium">{formatSafe(log.timestamp, "MMM dd, yyyy")}</p>
              <p className="text-[11px] text-muted-foreground font-mono">{formatSafe(log.timestamp, "HH:mm:ss a")}</p>
            </div>

            <div className="p-3 bg-card border rounded-lg space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Shield className="size-3.5" /> Entity Ref
              </div>
              <p className="text-sm font-medium uppercase">{log.entity}</p>
              <p className="text-[11px] text-muted-foreground font-mono truncate">{log.entityId}</p>
            </div>

            <div className="p-3 bg-card border rounded-lg space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Activity className="size-3.5" /> Origin
              </div>
              <p className="text-sm font-medium">{log.branchId ? `Branch: ${log.branchId}` : "Global System"}</p>
              <p className="text-[11px] text-muted-foreground font-mono truncate">{log.ipAddress || "Local PWA"}</p>
            </div>
          </div>

          {/* Diff View Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "diff" | "raw")} className="space-y-4">
            <TabsList className="h-9 p-1 bg-muted">
              <TabsTrigger value="diff" className="text-xs gap-1.5 px-3">
                <ChevronRight className="size-3.5" /> Change Summary ({changedDiffs.length})
              </TabsTrigger>
              <TabsTrigger value="raw" className="text-xs gap-1.5 px-3">
                <FileJson className="size-3.5" /> Raw JSON Payload
              </TabsTrigger>
            </TabsList>

            <TabsContent value="diff" className="space-y-3">
              {changedDiffs.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground bg-muted/20 border border-dashed rounded-lg">
                  No specific field changes recorded for this event.
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted text-muted-foreground border-b uppercase font-mono text-[10px]">
                      <tr>
                        <th className="p-2.5 font-semibold">Field</th>
                        <th className="p-2.5 font-semibold">Previous Value</th>
                        <th className="p-2.5 font-semibold">New Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {changedDiffs.map((d) => (
                        <tr key={d.key} className="hover:bg-muted/30">
                          <td className="p-2.5 font-mono font-medium">{d.key}</td>
                          <td className="p-2.5 text-destructive bg-destructive/5 font-mono">
                            {d.valBefore !== undefined ? JSON.stringify(d.valBefore) : <span className="text-muted-foreground italic">none</span>}
                          </td>
                          <td className="p-2.5 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 font-mono font-semibold">
                            {d.valAfter !== undefined ? JSON.stringify(d.valAfter) : <span className="text-muted-foreground italic">none</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="raw">
              <div className="p-4 bg-slate-950 text-slate-100 font-mono text-xs rounded-lg overflow-x-auto border">
                <pre>{JSON.stringify(log, null, 2)}</pre>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DrawerFooter className="border-t pt-3 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

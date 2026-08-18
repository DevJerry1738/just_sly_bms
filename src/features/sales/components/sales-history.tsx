import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Eye, Filter, RefreshCw, ShoppingCart } from "lucide-react";
import type { SalesSchema } from "@/database/schema";
import { salesRepository } from "@/repositories/entity.repositories";
import { SaleDetailModal } from "@/features/sales/components/sale-detail";
import { SyncManager } from "@/services/sync/sync-manager";
import { useBranch } from "@/providers/branch-provider";

export function SalesHistory() {
  const { activeBranch } = useBranch();
  const [sales, setSales] = useState<SalesSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");

  // Selected sale for detail modal
  const [selectedSale, setSelectedSale] = useState<SalesSchema | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const loadSales = useCallback(async () => {
    setLoading(true);
    try {
      let allSales = await salesRepository.getAll();
      if (activeBranch?.id) {
        allSales = allSales.filter((s) => s.branchId === activeBranch.id);
      }
      // Sort newest first
      allSales.sort((a, b) => b.createdAt - a.createdAt);
      setSales(allSales);
    } catch (err) {
      console.error("Error loading sales history:", err);
    } finally {
      setLoading(false);
    }
  }, [activeBranch?.id]);

  useEffect(() => {
    void loadSales();
  }, [loadSales]);

  useEffect(() => {
    const unsubscribe = SyncManager.subscribe((event) => {
      if (event === "sync:complete") {
        void loadSales();
      }
    });
    return unsubscribe;
  }, [loadSales]);

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      // Search term
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const matchNumber = sale.saleNumber.toLowerCase().includes(query);
        const matchCashier = (sale.createdByName ?? sale.createdBy).toLowerCase().includes(query);
        if (!matchNumber && !matchCashier) return false;
      }

      // Status filter
      if (statusFilter !== "all" && sale.status !== statusFilter) {
        return false;
      }

      // Payment filter
      if (paymentFilter !== "all" && sale.paymentMethod !== paymentFilter) {
        return false;
      }

      return true;
    });
  }, [sales, search, statusFilter, paymentFilter]);

  const handleRowClick = (sale: SalesSchema) => {
    setSelectedSale(sale);
    setDetailOpen(true);
  };

  const totalRevenue = useMemo(() => {
    return filteredSales
      .filter((s) => s.status !== "voided")
      .reduce((sum, s) => sum + s.totalAmount, 0);
  }, [filteredSales]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales History</h1>
          <p className="text-sm text-muted-foreground">
            Review completed and voided retail transactions.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadSales()}>
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
              Total Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredSales.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              ₦{totalRevenue.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
              Voided Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {filteredSales.filter((s) => s.status === "voided").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-card p-3 rounded-lg border">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sale number or cashier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[130px] text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="voided">Voided</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>

          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="h-9 w-[140px] text-xs">
              <SelectValue placeholder="Payment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              <SelectItem value="card">Card</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-card overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-semibold border-b">
            <tr>
              <th className="p-3">Receipt #</th>
              <th className="p-3">Date & Time</th>
              <th className="p-3">Cashier</th>
              <th className="p-3">Payment</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  Loading sales history...
                </td>
              </tr>
            ) : filteredSales.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  <div className="flex flex-col items-center space-y-2">
                    <ShoppingCart className="h-8 w-8 text-muted-foreground/50" />
                    <span>No sales found matching criteria.</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredSales.map((sale) => (
                <tr
                  key={sale.id}
                  className="hover:bg-muted/40 transition cursor-pointer"
                  onClick={() => handleRowClick(sale)}
                >
                  <td className="p-3 font-semibold text-foreground">{sale.saleNumber}</td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(sale.createdAt).toLocaleString("en-NG", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {sale.createdByName ?? sale.createdBy}
                  </td>
                  <td className="p-3 capitalize">{sale.paymentMethod.replace("_", " ")}</td>
                  <td className="p-3 text-right font-bold">₦{sale.totalAmount.toFixed(2)}</td>
                  <td className="p-3 text-center">
                    <Badge
                      variant={
                        sale.status === "voided"
                          ? "destructive"
                          : sale.status === "completed"
                          ? "default"
                          : "outline"
                      }
                      className="text-[10px]"
                    >
                      {sale.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => handleRowClick(sale)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Sale Detail Modal */}
      <SaleDetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        sale={selectedSale}
        onSaleUpdated={() => void loadSales()}
      />
    </div>
  );
}

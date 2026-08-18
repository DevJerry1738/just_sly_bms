import { useState, useEffect, useCallback } from "react";
import {
  Users, UserPlus, Search, Building2, Phone, Mail,
  MoreHorizontal, Edit, Ban, CheckCircle, RefreshCw,
  Loader2, UserCheck, UserX, MapPin, FileText, KeyRound,
  Eye, EyeOff, ShieldCheck, ShieldOff, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";

import { customerRepository } from "@/repositories/customer.repository";
import type { CustomerAccountSchema, CustomerAccountStatus } from "@/database/schema";
import {
  createWholesaleCustomerUser,
  resetWholesaleCustomerPassword,
} from "@/features/customers/customer.functions";

/* ─── Status config ─────────────────────────────────────────────────────── */

const STATUS_CONFIG: Record<CustomerAccountStatus, { label: string; variant: string }> = {
  active: { label: "Active", variant: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" },
  inactive: { label: "Inactive", variant: "border-slate-500/30 text-slate-400 bg-slate-500/10" },
  suspended: { label: "Suspended", variant: "border-red-500/30 text-red-400 bg-red-500/10" },
};

/* ─── Form interfaces ────────────────────────────────────────────────────── */

interface CustomerForm {
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  creditLimit: string;
  status: CustomerAccountStatus;
  notes: string;
}

const emptyForm: CustomerForm = {
  businessName: "",
  contactName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  country: "Nigeria",
  creditLimit: "",
  status: "active",
  notes: "",
};

interface CredentialForm {
  password: string;
  confirmPassword: string;
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerAccountSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CustomerAccountStatus>("all");

  // Customer create/edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CustomerAccountSchema | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Credentials dialog — shown after new customer creation OR via row action
  const [credsDialogOpen, setCredsDialogOpen] = useState(false);
  const [credsTarget, setCredsTarget] = useState<CustomerAccountSchema | null>(null);
  const [credsForm, setCredsForm] = useState<CredentialForm>({ password: "", confirmPassword: "" });
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);
  const [isNewCustomer, setIsNewCustomer] = useState(false); // controls dialog messaging

  /* ── Data loading ─────────────────────────────────────────────────────── */

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const all = await customerRepository.getAll();
      setCustomers(all.sort((a, b) => b.createdAt - a.createdAt));
    } catch {
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  /* ── Customer dialog helpers ──────────────────────────────────────────── */

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (customer: CustomerAccountSchema) => {
    setEditTarget(customer);
    const contact = String(customer.contactName || customer.contactPerson || "");
    const addr = String(customer.address || customer.street || "");
    setForm({
      businessName: String(customer.businessName ?? ""),
      contactName: contact,
      email: customer.email,
      phone: String(customer.phone ?? ""),
      address: addr,
      city: String(customer.city ?? ""),
      state: String(customer.state ?? ""),
      country: String(customer.country ?? "Nigeria"),
      creditLimit: customer.creditLimit ? String(customer.creditLimit) : "",
      status: customer.status,
      notes: String(customer.notes ?? ""),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.contactName.trim()) {
      toast.error("Contact name is required");
      return;
    }
    if (!form.email.trim()) {
      toast.error("Email is required");
      return;
    }
    setSaving(true);
    try {
      const now = Date.now();
      if (editTarget) {
        // ── Edit existing customer ──────────────────────────────────────
        const updated: CustomerAccountSchema = {
          ...editTarget,
          businessName: form.businessName || undefined,
          contactName: form.contactName,
          contactPerson: form.contactName,
          email: form.email.toLowerCase(),
          phone: form.phone || undefined,
          address: form.address || undefined,
          street: form.address || undefined,
          city: form.city || undefined,
          state: form.state || undefined,
          country: form.country || undefined,
          creditLimit: form.creditLimit ? parseFloat(form.creditLimit) : undefined,
          status: form.status,
          notes: form.notes || undefined,
          updatedAt: now,
          sync_status: "pending",
        };
        await customerRepository.update(editTarget.id, updated);
        toast.success("Customer updated successfully");
        setDialogOpen(false);
        loadCustomers();
      } else {
        // ── Create new customer ─────────────────────────────────────────
        const existing = await customerRepository.getByEmail(form.email);
        if (existing) {
          toast.error("A customer with this email already exists");
          return;
        }
        const code = await customerRepository.generateCustomerCode();
        const newCustomer: CustomerAccountSchema = {
          id: crypto.randomUUID(),
          customerCode: code,
          businessName: form.businessName || undefined,
          contactName: form.contactName,
          contactPerson: form.contactName,
          email: form.email.toLowerCase(),
          phone: form.phone || undefined,
          address: form.address || undefined,
          street: form.address || undefined,
          city: form.city || undefined,
          state: form.state || undefined,
          country: form.country || undefined,
          creditLimit: form.creditLimit ? parseFloat(form.creditLimit) : undefined,
          status: form.status,
          notes: form.notes || undefined,
          createdAt: now,
          updatedAt: now,
          sync_status: "pending",
        };
        await customerRepository.create(newCustomer);
        toast.success(`Customer ${code} created — now set their portal login password`);

        setDialogOpen(false);
        await loadCustomers();

        // ── Immediately open the Set Credentials dialog ─────────────────
        setCredsTarget(newCustomer);
        setCredsForm({ password: "", confirmPassword: "" });
        setIsNewCustomer(true);
        setShowPw(false);
        setShowConfirmPw(false);
        setCredsDialogOpen(true);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save customer");
    } finally {
      setSaving(false);
    }
  };

  /* ── Credentials dialog helpers ───────────────────────────────────────── */

  const openSetCreds = (customer: CustomerAccountSchema) => {
    setCredsTarget(customer);
    setCredsForm({ password: "", confirmPassword: "" });
    setIsNewCustomer(false);
    setShowPw(false);
    setShowConfirmPw(false);
    setCredsDialogOpen(true);
  };

  const handleSaveCreds = async () => {
    if (!credsTarget) return;

    if (credsForm.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (credsForm.password !== credsForm.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setSavingCreds(true);
    try {
      if (credsTarget.authUserId) {
        // ── Reset existing auth account's password ──────────────────────
        await resetWholesaleCustomerPassword({
          data: {
            authUserId: credsTarget.authUserId,
            newPassword: credsForm.password,
          },
        });
        toast.success("Portal password updated successfully");
      } else {
        // ── Create a brand-new Supabase auth account ────────────────────
        const { authUserId } = await createWholesaleCustomerUser({
          data: {
            email: credsTarget.email,
            password: credsForm.password,
            contactName: String(credsTarget.contactName || credsTarget.contactPerson || ""),
          },
        });
        // Link the auth user ID back to the customer record
        await customerRepository.update(credsTarget.id, {
          ...credsTarget,
          authUserId,
          updatedAt: Date.now(),
          sync_status: "pending",
        });
        toast.success("Portal access created — customer can now log in");
        loadCustomers();
      }
      setCredsDialogOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to set credentials");
    } finally {
      setSavingCreds(false);
    }
  };

  /* ── Status toggle ────────────────────────────────────────────────────── */

  const toggleStatus = async (customer: CustomerAccountSchema) => {
    const newStatus: CustomerAccountStatus =
      customer.status === "active" ? "suspended" : "active";
    try {
      await customerRepository.update(customer.id, {
        ...customer,
        status: newStatus,
        updatedAt: Date.now(),
        sync_status: "pending",
      });
      toast.success(`Customer ${newStatus === "active" ? "activated" : "suspended"}`);
      loadCustomers();
    } catch {
      toast.error("Failed to update status");
    }
  };

  /* ── Derived data ─────────────────────────────────────────────────────── */

  const filtered = customers.filter((c) => {
    const contact = String(c.contactName || c.contactPerson || "");
    const business = String(c.businessName ?? "");
    const matchesSearch =
      !search ||
      contact.toLowerCase().includes(search.toLowerCase()) ||
      business.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.customerCode.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: customers.length,
    active: customers.filter((c) => c.status === "active").length,
    suspended: customers.filter((c) => c.status === "suspended").length,
    inactive: customers.filter((c) => c.status === "inactive").length,
  };

  /* ─── Render ──────────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col gap-6 p-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage wholesale customer accounts and portal access.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 shrink-0">
          <UserPlus className="size-4" />
          Add Customer
        </Button>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Customers", value: stats.total, icon: Users, color: "text-blue-500" },
          { label: "Active", value: stats.active, icon: UserCheck, color: "text-emerald-500" },
          { label: "Suspended", value: stats.suspended, icon: Ban, color: "text-red-500" },
          { label: "Inactive", value: stats.inactive, icon: UserX, color: "text-slate-500" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1 text-foreground">{stat.value}</p>
                </div>
                <div className={`rounded-lg p-2.5 bg-muted ${stat.color}`}>
                  <stat.icon className="size-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Filters + Table ────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <TabsList>
                <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
                <TabsTrigger value="active">Active ({stats.active})</TabsTrigger>
                <TabsTrigger value="suspended">Suspended ({stats.suspended})</TabsTrigger>
                <TabsTrigger value="inactive">Inactive ({stats.inactive})</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search customers…"
                  className="pl-9 w-64"
                />
              </div>
              <Button variant="outline" size="icon" onClick={loadCustomers}>
                <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              <span className="text-sm">Loading customers…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Users className="size-10 opacity-30" />
              <p className="text-sm">
                {search || statusFilter !== "all" ? "No customers match your filters" : "No customers yet"}
              </p>
              {!search && statusFilter === "all" && (
                <Button size="sm" onClick={openCreate} className="mt-1 gap-2">
                  <UserPlus className="size-4" /> Add first customer
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="hidden md:table-cell">Contact</TableHead>
                  <TableHead className="hidden lg:table-cell">Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Portal Access</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((customer) => {
                  const statusCfg = STATUS_CONFIG[customer.status];
                  const title = String(
                    customer.businessName || customer.contactName || customer.contactPerson || "Customer"
                  );
                  const initial = title.charAt(0).toUpperCase();
                  const hasPortalAccess = Boolean(customer.authUserId);
                  return (
                    <TableRow
                      key={customer.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openEdit(customer)}
                    >
                      <TableCell>
                        <div className="flex items-start gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                            {initial}
                          </div>
                          <div>
                            <p className="font-medium text-sm text-foreground">{title}</p>
                            <p className="text-xs text-muted-foreground font-mono">{customer.customerCode}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Mail className="size-3" />
                            <span>{customer.email}</span>
                          </div>
                          {customer.phone && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Phone className="size-3" />
                              <span>{customer.phone}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {customer.city || customer.state ? (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Building2 className="size-3" />
                            <span>{[customer.city, customer.state].filter(Boolean).join(", ")}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[11px] ${statusCfg.variant}`}>
                          {statusCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {hasPortalAccess ? (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-500">
                            <ShieldCheck className="size-3.5" />
                            <span className="hidden sm:inline">Enabled</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-amber-500">
                            <ShieldAlert className="size-3.5" />
                            <span className="hidden sm:inline">No Login</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(customer)} className="gap-2">
                              <Edit className="size-3.5" /> Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openSetCreds(customer)}
                              className="gap-2"
                            >
                              <KeyRound className="size-3.5" />
                              {customer.authUserId ? "Reset Portal Password" : "Set Portal Password"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => toggleStatus(customer)}
                              className={`gap-2 ${customer.status === "active" ? "text-red-500" : "text-emerald-500"}`}
                            >
                              {customer.status === "active" ? (
                                <><Ban className="size-3.5" /> Suspend</>
                              ) : (
                                <><CheckCircle className="size-3.5" /> Activate</>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════
          Create / Edit Customer Dialog
      ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl h-[85vh] max-h-[85vh] p-0 flex flex-col gap-0 overflow-hidden border-border/80 shadow-2xl rounded-xl">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60 bg-muted/20 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                {editTarget ? <Edit className="size-5" /> : <UserPlus className="size-5" />}
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
                  {editTarget ? "Edit Wholesale Customer" : "Add Wholesale Customer"}
                  {editTarget?.customerCode && (
                    <Badge variant="outline" className="font-mono text-[11px] bg-muted/50">
                      {editTarget.customerCode}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {editTarget
                    ? "Update account details and portal status for this customer."
                    : "Create a new wholesale customer profile. You'll set their portal password in the next step."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-6">

            {/* Section 1: Business & Contact */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
                <Building2 className="size-3.5" />
                <span>Business & Contact Information</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-medium">Business / Company Name</Label>
                  <Input
                    value={form.businessName}
                    onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
                    placeholder="e.g. Acme Distributors Ltd."
                    className="bg-background"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1">
                    Contact Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={form.contactName}
                    onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                    placeholder="e.g. John Doe"
                    required
                    className="bg-background"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1">
                    Email Address <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="john@acme.com"
                    required
                    disabled={Boolean(editTarget)} // email can't change once linked to auth
                    className="bg-background disabled:opacity-60"
                  />
                  {editTarget && (
                    <p className="text-[11px] text-muted-foreground">
                      Email cannot be changed after account creation.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Phone Number</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+234 800 000 0000"
                    className="bg-background"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Account Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm((f) => ({ ...f, status: v as CustomerAccountStatus }))}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active (Access Granted)</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="suspended">Suspended (Access Blocked)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator className="bg-border/60" />

            {/* Section 2: Location & Credit */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
                <MapPin className="size-3.5" />
                <span>Location & Financial Terms</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Credit Limit (NGN)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.creditLimit}
                    onChange={(e) => setForm((f) => ({ ...f, creditLimit: e.target.value }))}
                    placeholder="0"
                    className="bg-background"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Country</Label>
                  <Input
                    value={form.country}
                    onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                    placeholder="Nigeria"
                    className="bg-background"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">City</Label>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    placeholder="Lagos"
                    className="bg-background"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">State / Region</Label>
                  <Input
                    value={form.state}
                    onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                    placeholder="Lagos State"
                    className="bg-background"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-medium">Street Address</Label>
                  <Input
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="e.g. 123 Marina Street, Victoria Island"
                    className="bg-background"
                  />
                </div>
              </div>
            </div>

            <Separator className="bg-border/60" />

            {/* Section 3: Notes */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
                <FileText className="size-3.5" />
                <span>Internal Notes</span>
              </div>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Any additional information, special terms, or notes about this customer…"
                rows={3}
                className="resize-none bg-background text-xs"
              />
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border/60 bg-muted/20 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 shrink-0">
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto gap-2">
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {saving
                ? "Saving…"
                : editTarget
                  ? "Save Changes"
                  : "Create Customer →"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          Set / Reset Portal Password Dialog
      ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={credsDialogOpen} onOpenChange={(open) => {
        if (!open && isNewCustomer) {
          toast.info("You can set a password later from the customer's row menu.");
        }
        setCredsDialogOpen(open);
      }}>
        <DialogContent className="max-w-md border-border/80 shadow-2xl rounded-xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <KeyRound className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  {credsTarget?.authUserId ? "Reset Portal Password" : "Set Portal Password"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {credsTarget?.authUserId
                    ? `Update the portal login password for ${credsTarget.businessName || credsTarget.contactName || credsTarget.email}.`
                    : isNewCustomer
                      ? `Set a portal login password so ${credsTarget?.businessName || credsTarget?.contactName || "this customer"} can access the Wholesale Portal.`
                      : `Create portal login credentials for ${credsTarget?.businessName || credsTarget?.contactName || "this customer"}.`}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Customer email indicator */}
          {credsTarget && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border/50 text-xs text-muted-foreground">
              <Mail className="size-3.5 shrink-0" />
              <span className="font-medium">Login email:</span>
              <span className="font-mono text-foreground">{credsTarget.email}</span>
            </div>
          )}

          <div className="space-y-4 py-1">
            {/* Password */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1">
                Password <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="portal-password"
                  type={showPw ? "text" : "password"}
                  value={credsForm.password}
                  onChange={(e) => setCredsForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Minimum 8 characters"
                  className="pr-10 bg-background"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1">
                Confirm Password <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="portal-confirm-password"
                  type={showConfirmPw ? "text" : "password"}
                  value={credsForm.confirmPassword}
                  onChange={(e) => setCredsForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                  placeholder="Re-enter password"
                  className={`pr-10 bg-background ${
                    credsForm.confirmPassword && credsForm.password !== credsForm.confirmPassword
                      ? "border-red-500/60 focus-visible:ring-red-500/30"
                      : ""
                  }`}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {credsForm.confirmPassword && credsForm.password !== credsForm.confirmPassword && (
                <p className="text-[11px] text-red-400">Passwords do not match</p>
              )}
            </div>

            {/* Info note */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-xs text-blue-400">
              <ShieldOff className="size-3.5 mt-0.5 shrink-0" />
              <span>
                Share this password securely with the customer. They can change it
                from their portal profile after logging in.
              </span>
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setCredsDialogOpen(false)}
              disabled={savingCreds}
              className="w-full sm:w-auto"
            >
              {isNewCustomer ? "Skip for now" : "Cancel"}
            </Button>
            <Button
              onClick={handleSaveCreds}
              disabled={
                savingCreds ||
                credsForm.password.length < 8 ||
                credsForm.password !== credsForm.confirmPassword
              }
              className="w-full sm:w-auto gap-2"
            >
              {savingCreds ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              {savingCreds
                ? "Saving…"
                : credsTarget?.authUserId
                  ? "Update Password"
                  : "Create Portal Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

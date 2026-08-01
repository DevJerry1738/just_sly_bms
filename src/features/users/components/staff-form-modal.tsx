import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { useServerFn } from "@tanstack/react-start";
import { createStaffUser, inviteStaffUser } from "../staff.functions";
import { staffSchema, type StaffFormValues } from "../schemas/staff.schema";
import type { BranchSchema, RoleSchema, StaffSchema } from "@/database/schema";
import { generateTemporaryPassword, staffRepository, type StaffCredentials } from "@/repositories/staff.repository";
import { roleRepository } from "@/repositories/role.repository";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

interface StaffFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: BranchSchema[];
  staff?: StaffSchema | null;
  onSuccess: () => void;
}

export function StaffFormModal({ open, onOpenChange, branches, staff, onSuccess }: StaffFormModalProps) {
  const isEdit = Boolean(staff);
  const [roles, setRoles] = useState<RoleSchema[]>([]);
  const [creationResult, setCreationResult] = useState<{
    credentials: StaffCredentials | null;
    successMessage: string;
  } | null>(null);

  const createStaffUserFn = useServerFn(createStaffUser);
  const inviteStaffUserFn = useServerFn(inviteStaffUser);

  const form = useForm<StaffFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(staffSchema) as any,
    defaultValues: {
      firstName: "",
      lastName: "",
      preferredName: "",
      email: "",
      phone: "",
      branchId: "",
      roleId: "",
      employmentId: "",
      onboardingMode: "manual",
    },
  });

  useEffect(() => {
    void (async () => {
      const systemRoles = await roleRepository.ensureSystemRoles();
      setRoles(systemRoles);
    })();
  }, []);

  useEffect(() => {
    if (staff) {
      form.reset({
        firstName: staff.firstName,
        lastName: staff.lastName,
        preferredName: staff.preferredName ?? "",
        email: staff.email,
        phone: staff.phone ?? "",
        branchId: staff.branchId,
        roleId: staff.roleId ?? "",
        employmentId: staff.employmentId ?? "",
        onboardingMode: "manual",
      });
    } else {
      form.reset();
    }
  }, [staff, form]);

  useEffect(() => {
    if (!open) {
      setCreationResult(null);
      form.reset();
    }
  }, [open, form]);

  const onSubmit = async (values: StaffFormValues) => {
    try {
      if (typeof window !== "undefined" && !navigator.onLine) {
        toast.error("An internet connection is required to manage staff credentials.");
        return;
      }

      if (isEdit && staff) {
        await staffRepository.updateStaff(staff.id, {
          firstName: values.firstName,
          lastName: values.lastName,
          preferredName: values.preferredName || undefined,
          email: values.email,
          phone: values.phone || undefined,
          branchId: values.branchId,
          roleId: values.roleId,
          employmentId: values.employmentId || undefined,
          updatedAt: Date.now(),
        });
        toast.success("Staff member updated successfully.");
        onSuccess();
        onOpenChange(false);
        return;
      }

      const fullName = `${values.firstName} ${values.lastName}`;
      let authUserId: string | undefined;
      let credentials: StaffCredentials | null = null;

      if (values.onboardingMode === "manual") {
        const temporaryPassword = generateTemporaryPassword();
        const response = await createStaffUserFn({
          data: {
            email: values.email,
            password: temporaryPassword,
            fullName,
          },
        });
        authUserId = response.authUserId;

        const result = await staffRepository.createStaff(
          { ...values, authUserId },
          "manual",
          temporaryPassword,
        );
        credentials = result.credentials;
      } else {
        const response = await inviteStaffUserFn({
          data: {
            email: values.email,
            fullName,
            redirectTo: `${window.location.origin}/auth?type=recovery`,
          },
        });
        authUserId = response.authUserId;
        await staffRepository.createStaff({ ...values, authUserId }, "invite");
      }

      toast.success("Staff member created successfully.");
      setCreationResult({
        credentials,
        successMessage:
          values.onboardingMode === "manual"
            ? "Manual login credentials are ready for this staff member. Share them securely."
            : `An invitation email has been sent to ${values.email}.`,
      });
      onSuccess();
    } catch (error) {
      console.error("[StaffFormModal] Save failed", error);
      toast.error(isEdit ? "Failed to update staff member." : "Failed to add staff member.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Team Member" : "Add Team Member"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update staff profile and branch assignment."
              : "Invite a new team member or create credentials manually for offline onboarding."}
          </DialogDescription>
        </DialogHeader>

        {!creationResult ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Jane" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="preferredName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred name</FormLabel>
                    <FormControl>
                      <Input placeholder="Janie" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="jane@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+233 24 000 0000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="branchId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Branch *</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select branch" />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="roleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role *</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!isEdit && (
                <FormField
                  control={form.control}
                  name="onboardingMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Onboarding mode</FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose mode" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual">Manual credentials</SelectItem>
                            <SelectItem value="invite">Send invite</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="employmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employment ID</FormLabel>
                    <FormControl>
                      <Input placeholder="EMP-0001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {isEdit ? "Save changes" : "Add staff"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <div className="space-y-6 py-4">
            <div className="rounded-2xl border border-border bg-muted/5 p-6">
              <p className="text-sm font-medium text-foreground">{creationResult?.successMessage}</p>
              {creationResult?.credentials ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-xl border border-border bg-background p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Employee code</p>
                    <p className="mt-2 text-lg font-semibold">{creationResult.credentials.employeeCode}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-background p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Temporary password</p>
                    <p className="mt-2 font-mono text-lg font-semibold">{creationResult.credentials.temporaryPassword}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
                    {creationResult.credentials.loginNote}
                  </div>
                </div>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreationResult(null);
                  onOpenChange(false);
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
        </DialogContent>
      </Dialog>
  );
}

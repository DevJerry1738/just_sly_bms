import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CheckCircle2, CreditCard, Eye, EyeOff, Lock, Loader2, User, Zap } from "lucide-react";

import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { db } from "@/database/schema";
import { staffRepository } from "@/repositories/staff.repository";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

import { queryKeys } from "@/lib/query-keys";
import { saveUserPreferences, loadUserPreferences } from "@/services/user-preferences.service";
import { changePassword, loadUserProfile, removeAvatar, saveUserProfile, uploadAvatar } from "@/services/user-profile.service";
import {
  userPreferencesSchema,
  userProfileSchema,
  userSecuritySchema,
  type UserPreferencesFormValues,
  type UserProfileFormValues,
  type UserSecurityFormValues,
} from "../schemas/profile.schema";

const AVATAR_ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_AVATAR_SIZE = 1024 * 1024 * 2; // 2MB

export function UserProfilePage() {
  const { user, profile: authProfile } = useAuth();
  const { status } = useNetworkStatus();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const [selectedAvatar, setSelectedAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("profile");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const staffQuery = useQuery({
    queryKey: ["currentStaffRecord", userId, user?.email],
    queryFn: async () => {
      if (!userId && !user?.email) return null;
      const allStaff = await db.staff.toArray();
      const staffMember = allStaff.find(
        (s) => (userId && s.authUserId === userId) || (user?.email && s.email.toLowerCase() === user.email.toLowerCase())
      );
      if (!staffMember) return null;
      const [allBranches, allRoles] = await Promise.all([
        db.branches.toArray(),
        db.roles.toArray(),
      ]);
      const branchRecord = allBranches.find((b) => b.id === staffMember.branchId);
      const roleRecord = allRoles.find(
        (r) => r.id === staffMember.roleId || r.code === staffMember.roleId || r.id === staffMember.role || r.code === staffMember.role
      );
      return {
        staffMember,
        branchName: branchRecord?.name ?? "Global",
        roleName: roleRecord?.name ?? staffMember.roleId ?? staffMember.role ?? "Viewer",
      };
    },
    enabled: Boolean(userId || user?.email),
  });

  const profileQuery = useQuery({
    queryKey: queryKeys.auth.profile(userId ?? "guest"),
    queryFn: async () => {
      if (!userId) throw new Error("No authenticated user.");
      return loadUserProfile(userId, {
        email: user?.email ?? "",
        displayName: user?.fullName ?? "",
        role: (authProfile as any)?.role ?? "viewer",
      });
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 5,
  });

  const preferencesQuery = useQuery({
    queryKey: ["userPreferences", userId],
    queryFn: async () => {
      if (!userId) throw new Error("No authenticated user.");
      return loadUserPreferences(userId);
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 5,
  });

  const profileMutation = useMutation({
    mutationFn: async (values: UserProfileFormValues) => {
      const updatedProfile = await saveUserProfile(userId!, values);
      if (staffQuery.data?.staffMember) {
        await staffRepository.updateStaff(staffQuery.data.staffMember.id, {
          preferredName: values.preferredName || undefined,
          phone: values.phone || undefined,
        });
      }
      return updatedProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.profile(userId ?? "guest") });
      queryClient.invalidateQueries({ queryKey: ["currentStaffRecord"] });
      toast.success("Profile updated successfully.");
    },
    onError: () => toast.error("Failed to save profile updates."),
  });

  const preferencesMutation = useMutation({
    mutationFn: (values: UserPreferencesFormValues) => saveUserPreferences(userId!, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userPreferences", userId] });
      toast.success("Preferences saved successfully.");
    },
    onError: () => toast.error("Failed to save preferences."),
  });

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      return uploadAvatar(userId!, file);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.profile(userId ?? "guest") });
      toast.success("Avatar updated successfully.");
      setSelectedAvatar(null);
    },
    onError: (error) => {
      console.error(error);
      toast.error("Failed to update avatar.");
    },
  });

  const removeAvatarMutation = useMutation({
    mutationFn: () => removeAvatar(userId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.profile(userId ?? "guest") });
      toast.success("Avatar removed successfully.");
    },
    onError: () => toast.error("Failed to remove avatar."),
  });

  const passwordMutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: UserSecurityFormValues) => changePassword(currentPassword, newPassword),
    onSuccess: () => {
      toast.success("Password changed successfully.");
      securityForm.reset();
    },
    onError: (error) => {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Password change failed.");
    },
  });

  const profileForm = useForm<UserProfileFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(userProfileSchema) as any,
    defaultValues: {
      displayName: "",
      preferredName: "",
      phone: "",
      jobTitle: "",
      timezone: "UTC",
      language: "en",
      dateFormat: "DD/MM/YYYY",
      timeFormat: "24h",
    },
  });

  const securityForm = useForm<UserSecurityFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(userSecuritySchema) as any,
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const preferencesForm = useForm<UserPreferencesFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(userPreferencesSchema) as any,
    defaultValues: {
      theme: theme,
      compactMode: false,
      tableDensity: "default",
      language: "en",
      notificationPreferences: true,
    },
  });

  useEffect(() => {
    if (profileQuery.data) {
      profileForm.reset({
        displayName: profileQuery.data.displayName,
        preferredName: profileQuery.data.preferredName ?? "",
        phone: profileQuery.data.phone ?? "",
        jobTitle: profileQuery.data.jobTitle ?? "",
        timezone: profileQuery.data.timezone ?? "UTC",
        language: profileQuery.data.language ?? "en",
        dateFormat: profileQuery.data.dateFormat ?? "DD/MM/YYYY",
        timeFormat: profileQuery.data.timeFormat ?? "24h",
      });
      setAvatarPreview(profileQuery.data.avatarUrl ?? null);
    }
  }, [profileForm, profileQuery.data]);

  useEffect(() => {
    if (preferencesQuery.data) {
      preferencesForm.reset({
        theme: preferencesQuery.data.theme,
        compactMode: preferencesQuery.data.compactMode,
        tableDensity: preferencesQuery.data.tableDensity,
        language: preferencesQuery.data.language,
        notificationPreferences: preferencesQuery.data.notificationPreferences,
      });
      if (preferencesQuery.data.theme !== theme) {
        setTheme(preferencesQuery.data.theme);
      }
    }
  }, [preferencesForm, preferencesQuery.data, setTheme, theme]);

  useEffect(() => {
    if (!selectedAvatar) return;
    const objectUrl = URL.createObjectURL(selectedAvatar);
    setAvatarPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedAvatar]);

  const canEdit = profileQuery.isSuccess && user;
  const lastLogin = profileQuery.data?.lastLogin ? new Date(profileQuery.data.lastLogin).toLocaleString() : "Not available";
  const createdDate = profileQuery.data?.createdAt ? new Date(profileQuery.data.createdAt).toLocaleDateString() : "Not available";

  const profileStatus = profileQuery.data?.accountStatus ?? "active";
  const role = staffQuery.data?.roleName ?? (profileQuery.data as any)?.role ?? (authProfile as any)?.role ?? "Viewer";
  const branch = staffQuery.data?.branchName ?? profileQuery.data?.branch ?? "Global";
  const preferredName = profileQuery.data?.preferredName || staffQuery.data?.staffMember?.preferredName || "—";

  const isOffline = status === "offline";

  function onAvatarFileChange(file: File | null) {
    if (!file) return;
    if (!AVATAR_ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Choose a JPG, PNG, or WEBP image.");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      toast.error("Avatar must be smaller than 2MB.");
      return;
    }
    setSelectedAvatar(file);
    if (userId) avatarMutation.mutate(file);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border">
          <CardHeader>
            <CardTitle className="text-lg">Account Profile</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              View and manage your personal account details, security settings, and preferences.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Display Name</p>
                <p className="text-sm font-medium">{profileQuery.data?.displayName ?? user?.fullName ?? "—"}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Preferred Name</p>
                <p className="text-sm font-medium">{preferredName}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Email</p>
                <p className="text-sm font-medium">{user?.email ?? "—"}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Role</p>
                <p className="text-sm font-medium">{role}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Branch</p>
                <p className="text-sm font-medium">{branch}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Status</p>
                <p className="text-sm font-medium">{profileStatus}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Last Login</p>
                <p className="text-sm font-medium">{lastLogin}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Created</p>
                <p className="text-sm font-medium">{createdDate}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border">
          <CardHeader>
            <CardTitle className="text-lg">Avatar</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Upload a profile photo for your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border p-4 text-center">
              <Avatar className="size-24">
                {avatarPreview ? <AvatarImage src={avatarPreview} alt="User avatar" /> : null}
                <AvatarFallback className="bg-primary/10 text-primary text-[18px] font-semibold">
                  {user?.fullName?.slice(0, 2).toUpperCase() ?? "U"}
                </AvatarFallback>
              </Avatar>
              <p className="text-sm text-muted-foreground">
                Accepted formats: JPG, PNG, WEBP. Max size 2MB.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label htmlFor="avatar-upload" className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-xs font-medium transition hover:bg-muted">
                  <Camera className="size-3 mr-2" />
                  Upload Avatar
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(event) => onAvatarFileChange(event.target.files?.[0] ?? null)}
                />
                <Button variant="outline" size="sm" disabled={!profileQuery.data || removeAvatarMutation.isPending} onClick={() => removeAvatarMutation.mutate()}>
                  Remove
                </Button>
              </div>
            </div>
            {isOffline && (
              <p className="text-[11px] text-amber-600">Offline mode: avatar upload changes will be prepared locally and synced when you're back online.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Account Settings</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Manage profile data, security, preferences, and account activity.
            </CardDescription>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
            <Zap className="size-3" /> {isOffline ? "Offline" : "Online"}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4 gap-2">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="pt-4">
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit((values) => profileMutation.mutate(values))} className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <FormField
                      control={profileForm.control}
                      name="displayName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Display Name</FormLabel>
                          <FormControl>
                            <Input {...field} className="h-10 text-xs" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name="preferredName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preferred Name</FormLabel>
                          <FormControl>
                            <Input {...field} className="h-10 text-xs" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input {...field} type="tel" className="h-10 text-xs" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name="jobTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Job Title</FormLabel>
                          <FormControl>
                            <Input {...field} className="h-10 text-xs" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name="timezone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Timezone</FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <SelectTrigger className="h-10 text-xs">
                                <SelectValue placeholder="Select timezone" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="UTC">UTC</SelectItem>
                                <SelectItem value="GMT">GMT</SelectItem>
                                <SelectItem value="WAT">WAT</SelectItem>
                                <SelectItem value="EST">EST</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name="language"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Language</FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <SelectTrigger className="h-10 text-xs">
                                <SelectValue placeholder="Select language" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="en">English</SelectItem>
                                <SelectItem value="es">Español</SelectItem>
                                <SelectItem value="fr">Français</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name="dateFormat"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date Format</FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <SelectTrigger className="h-10 text-xs">
                                <SelectValue placeholder="Select format" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name="timeFormat"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time Format</FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <SelectTrigger className="h-10 text-xs">
                                <SelectValue placeholder="Select format" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="24h">24-hour</SelectItem>
                                <SelectItem value="12h">12-hour</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Button type="submit" size="sm" disabled={!canEdit || profileMutation.isPending}>
                      {profileMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Save Profile"}
                    </Button>
                    {isOffline && <span className="text-xs text-amber-600">Changes will sync when you are online.</span>}
                  </div>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="security" className="pt-4">
              <Card className="border bg-muted p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Last Password Change</p>
                    <p className="text-sm font-medium">{profileQuery.data?.lastPasswordChange ? new Date(profileQuery.data.lastPasswordChange).toLocaleDateString() : "Not available"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Current Device</p>
                    <p className="text-sm font-medium">Browser session</p>
                  </div>
                </div>
              </Card>
              <Form {...securityForm}>
                <form onSubmit={securityForm.handleSubmit((values) => passwordMutation.mutate(values))} className="space-y-4 pt-4 max-w-xl">
                  <FormField
                    control={securityForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type={showCurrentPassword ? "text" : "password"}
                              className="h-10 pr-10 text-xs"
                              autoComplete="current-password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowCurrentPassword((prev) => !prev)}
                              className="absolute inset-y-0 right-3 inline-flex items-center text-muted-foreground hover:text-foreground"
                              aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                            >
                              {showCurrentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={securityForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type={showNewPassword ? "text" : "password"}
                              className="h-10 pr-10 text-xs"
                              autoComplete="new-password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword((prev) => !prev)}
                              className="absolute inset-y-0 right-3 inline-flex items-center text-muted-foreground hover:text-foreground"
                              aria-label={showNewPassword ? "Hide password" : "Show password"}
                            >
                              {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={securityForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type={showConfirmPassword ? "text" : "password"}
                              className="h-10 pr-10 text-xs"
                              autoComplete="new-password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword((prev) => !prev)}
                              className="absolute inset-y-0 right-3 inline-flex items-center text-muted-foreground hover:text-foreground"
                              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                            >
                              {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-center gap-3 pt-2">
                    <Button type="submit" size="sm" disabled={passwordMutation.isPending || isOffline}>
                      {passwordMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Change Password"}
                    </Button>
                    {isOffline && <span className="text-xs text-amber-600">Password changes require online connectivity.</span>}
                  </div>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="preferences" className="pt-4">
              <Form {...preferencesForm}>
                <form onSubmit={preferencesForm.handleSubmit((values) => {
                  setTheme(values.theme);
                  preferencesMutation.mutate(values);
                })} className="space-y-4 max-w-xl">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={preferencesForm.control}
                      name="theme"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Theme</FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <SelectTrigger className="h-10 text-xs">
                                <SelectValue placeholder="Select theme" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="system">System</SelectItem>
                                <SelectItem value="light">Light</SelectItem>
                                <SelectItem value="dark">Dark</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={preferencesForm.control}
                      name="language"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Language</FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <SelectTrigger className="h-10 text-xs">
                                <SelectValue placeholder="Select language" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="en">English</SelectItem>
                                <SelectItem value="es">Español</SelectItem>
                                <SelectItem value="fr">Français</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name="dateFormat"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date Format</FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                              <SelectTrigger className="h-10 text-xs">
                                <SelectValue placeholder="Select format" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name="timeFormat"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time Format</FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                              <SelectTrigger className="h-10 text-xs">
                                <SelectValue placeholder="Select format" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="24h">24-hour</SelectItem>
                                <SelectItem value="12h">12-hour</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={preferencesForm.control}
                    name="compactMode"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <FormLabel className="mb-1">Compact Mode</FormLabel>
                          <div className="text-[11px] text-muted-foreground">Placeholder for more compact layout preferences.</div>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={preferencesForm.control}
                    name="notificationPreferences"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <FormLabel className="mb-1">Notification Preferences</FormLabel>
                          <div className="text-[11px] text-muted-foreground">Placeholder for notification preference settings.</div>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="flex items-center gap-3 pt-2">
                    <Button type="submit" size="sm" disabled={preferencesMutation.isPending}>
                      {preferencesMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Save Preferences"}
                    </Button>
                    {isOffline && <span className="text-xs text-amber-600">Preference changes queue while offline.</span>}
                  </div>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="activity" className="pt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border">
                  <CardHeader>
                    <CardTitle className="text-sm">Recent Activity</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">Account events and login activity will appear here.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-sm text-muted-foreground">
                      <div className="rounded-lg border bg-background p-3">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Login History</p>
                        <p className="mt-2 text-sm">Coming soon: device, location, and session history.</p>
                      </div>
                      <div className="rounded-lg border bg-background p-3">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Security Events</p>
                        <p className="mt-2 text-sm">Coming soon: password updates, MFA, and device management.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border">
                  <CardHeader>
                    <CardTitle className="text-sm">Device Summary</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">Current session details and device status.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-sm">
                      <div className="rounded-lg border bg-background p-3">
                        <p className="font-semibold">Current Session</p>
                        <p className="text-[11px] text-muted-foreground">Browser session</p>
                      </div>
                      <div className="rounded-lg border bg-background p-3">
                        <p className="font-semibold">Status</p>
                        <p className="text-[11px] text-muted-foreground">{isOffline ? "Offline" : "Online"}</p>
                      </div>
                      <div className="rounded-lg border bg-background p-3">
                        <p className="font-semibold">Latest Login</p>
                        <p className="text-[11px] text-muted-foreground">{lastLogin}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

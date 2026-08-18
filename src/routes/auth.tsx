import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Eye, EyeOff, ShieldCheck, Layers, Zap } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { DomainEvents } from "@/services/events/domain-events";
import { APP_CONFIG } from "@/config/app";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoNoBg from "@/assets/logo_no_bg.webp";
import { useNetworkStatus } from "@/hooks/use-network-status";

import { ForgotPasswordDialog } from "@/features/auth/components/forgot-password-dialog";
import { SetPasswordPanel } from "@/features/auth/components/set-password-panel";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Just Sly Business Management Suite" },
      { name: "description", content: "Secure access to the Just Sly Business Management Suite." },
      { property: "og:title", content: "Sign in — Just Sly Business Management Suite" },
      { property: "og:description", content: "Secure access to the Just Sly Business Management Suite." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const networkState = useNetworkStatus();
  const isOffline = networkState.status === "offline";
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const [isRecoverySession, setIsRecoverySession] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState<string | undefined>();
  const [recoveryMode, setRecoveryMode] = useState<"invite" | "recovery">("invite");

  useEffect(() => {
    const getUrlType = () => {
      if (typeof window === "undefined") return undefined;
      const params = new URLSearchParams(window.location.search);
      const searchType = params.get("type");
      if (searchType) return searchType;
      if (window.location.hash.includes("type=recovery")) return "recovery";
      if (window.location.hash.includes("type=invite")) return "invite";
      return undefined;
    };

    const typeParam = getUrlType();

    // Detect hash tokens or recovery state from Supabase auth
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && (typeParam === "invite" || typeParam === "recovery"))) {
        setIsRecoverySession(true);
        setRecoveryEmail(session?.user?.email);
        setRecoveryMode(typeParam === "recovery" ? "recovery" : "invite");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      const isInviteOrRecovery =
        typeParam === "invite" ||
        typeParam === "recovery" ||
        (typeof window !== "undefined" &&
          (window.location.hash.includes("type=invite") || window.location.hash.includes("type=recovery")));
      if (session && isInviteOrRecovery) {
        setIsRecoverySession(true);
        setRecoveryEmail(session.user.email);
        setRecoveryMode(typeParam === "recovery" ? "recovery" : "invite");
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const environmentLabel = useMemo(
    () => import.meta.env.MODE?.toLowerCase() ?? "development",
    [],
  );

  function validateForm() {
    let valid = true;
    setAuthError(null);
    if (!email.trim()) {
      setEmailError("Email is required.");
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Enter a valid email address.");
      valid = false;
    } else {
      setEmailError(null);
    }

    if (!password) {
      setPasswordError("Password is required.");
      valid = false;
    } else {
      setPasswordError(null);
    }

    return valid;
  }

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault();
    if (isOffline) {
      toast.error("An internet connection is required to authenticate.");
      return;
    }

    if (!validateForm()) {
      return;
    }

    setPending(true);
    setAuthError(null);

    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
    setPending(false);

    if (error) {
      DomainEvents.publish("LOGIN_FAILED", {
        userName: email,
        description: `Failed login attempt for ${email}`,
        reason: error.message,
      });

      const message =
        "Invalid email or password. Please try again.";
      setAuthError(message);
      toast.error(message);
      return;
    }

    // Route wholesale customers to their portal, staff to the dashboard
    const role = signInData.user?.user_metadata?.role as string | undefined;
    if (role === "wholesale_customer") {
      toast.success("Welcome to your wholesale portal.");
      navigate({ to: "/portal/shop", replace: true });
    } else {
      toast.success("Welcome back.");
      navigate({ to: "/", replace: true });
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[440px_1fr]">
        <section className="hidden flex-col justify-between border-r border-border bg-surface px-12 py-14 lg:flex">
          <div className="space-y-10">
            <div className="flex items-center gap-3">
              <img src={logoNoBg} alt={APP_CONFIG.name} className="h-10 w-auto object-contain" />
              <div>
                <p className="text-sm font-semibold tracking-tight text-foreground">{APP_CONFIG.name}</p>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Business Management Suite</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <p className="text-4xl font-semibold leading-tight tracking-tight text-foreground">
                  Manage branches, inventory, sales and operations from one secure platform.
                </p>
              </div>
              <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                A secure management console designed for multi-branch organizations and enterprise workflows.
              </p>
            </div>

            <div className="space-y-4 border-t border-border/70 pt-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-3">
                <ShieldCheck className="size-4 text-primary shrink-0" />
                <span>Enterprise-grade access controls and audit logging.</span>
              </div>
              <div className="flex items-center gap-3">
                <Layers className="size-4 text-primary shrink-0" />
                <span>Multi-branch operations with clear role segmentation.</span>
              </div>
              <div className="flex items-center gap-3">
                <Zap className="size-4 text-primary shrink-0" />
                <span>Trusted business workflows with offline-aware sync readiness.</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-xs text-muted-foreground">
            <span>Version {APP_CONFIG.version}</span>
            <span>{environmentLabel.toUpperCase()}</span>
            <span>© {new Date().getFullYear()} {APP_CONFIG.name}. All rights reserved.</span>
          </div>
        </section>

        <section className="flex items-center justify-center px-4 py-12 sm:px-6 lg:px-10">
          <div className="w-full max-w-md">
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <img src={logoNoBg} alt={APP_CONFIG.name} className="h-10 w-auto object-contain" />
              <div>
                <p className="text-sm font-semibold tracking-tight text-foreground">{APP_CONFIG.name}</p>
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Business Management Suite</p>
              </div>
            </div>

            <Card className="border border-border bg-card shadow-sm">
              {isRecoverySession ? (
                <SetPasswordPanel mode={recoveryMode} userEmail={recoveryEmail} />
              ) : (
                <>
                  <CardHeader className="space-y-3 px-6 pt-6">
                    <div className="space-y-1">
                      <CardTitle className="text-2xl font-semibold">Secure sign in</CardTitle>
                      <CardDescription className="text-sm text-muted-foreground">
                        Sign in to your {APP_CONFIG.name} workspace.
                      </CardDescription>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6 px-6 pb-6">
                    {isOffline ? (
                  <div className="rounded-xl border border-amber-200/80 bg-amber-50 p-4 text-sm text-amber-900">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4" />
                      <div>
                        <p className="font-medium">Offline mode detected</p>
                        <p>An internet connection is required to authenticate.</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>Retry when connectivity returns.</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        disabled={isOffline}
                        onClick={() => window.location.reload()}
                        className="px-2.5"
                      >
                        Retry
                      </Button>
                    </div>
                  </div>
                ) : null}

                <form noValidate autoComplete="off" onSubmit={handleSignIn} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="auth-email" className="text-xs font-medium text-foreground">
                      Email address
                    </Label>
                    <Input
                      id="auth-email"
                      type="email"
                      autoComplete="email"
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={pending}
                      aria-invalid={Boolean(emailError)}
                      placeholder="you@justsly.com"
                      className="h-11 text-sm"
                    />
                    {emailError ? (
                      <p className="text-xs text-destructive">{emailError}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <Label htmlFor="auth-password" className="text-xs font-medium text-foreground">
                        Password
                      </Label>
                      <button
                        type="button"
                        onClick={() => setForgotPasswordOpen(true)}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        id="auth-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyUp={(event) => setCapsLockOn(event.getModifierState("CapsLock"))}
                        onKeyDown={(event) => setCapsLockOn(event.getModifierState("CapsLock"))}
                        disabled={pending}
                        aria-invalid={Boolean(passwordError)}
                        className="h-11 pr-10 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="absolute inset-y-0 right-3 inline-flex items-center rounded-md px-2 text-muted-foreground transition hover:text-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {passwordError ? (
                      <p className="text-xs text-destructive">{passwordError}</p>
                    ) : capsLockOn ? (
                      <p className="text-xs text-amber-700">Caps lock is on.</p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="remember-me"
                      checked={rememberMe}
                      onCheckedChange={(value) => setRememberMe(Boolean(value))}
                    />
                    <label htmlFor="remember-me" className="text-sm text-foreground">
                      Remember me
                    </label>
                  </div>

                  {authError ? (
                    <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                      {authError}
                    </p>
                  ) : null}

                  <Button type="submit" size="lg" className="w-full text-sm font-medium" disabled={pending || isOffline} isLoading={pending}>
                    {pending ? "Signing in..." : "Sign in"}
                  </Button>
                </form>
              </CardContent>

              <CardFooter className="flex flex-col gap-2 px-6 pb-6 pt-0 text-xs text-muted-foreground">
                <p>All accounts are provisioned by Super Administrators. No self-service registration.</p>
                <p>
                  Need help? Contact <a href={`mailto:${APP_CONFIG.supportEmail}`} className="text-primary hover:underline">{APP_CONFIG.supportEmail}</a>.
                </p>
              </CardFooter>
                </>
              )}
            </Card>

            <div className="mt-6 text-center text-[11px] leading-5 text-muted-foreground">
              <p>{APP_CONFIG.name} — {APP_CONFIG.description}</p>
              <p className="mt-2">Version {APP_CONFIG.version} · {environmentLabel}</p>
            </div>
          </div>
        </section>
      </div>

      <ForgotPasswordDialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen} />
    </main>
  );
}

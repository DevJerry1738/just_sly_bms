import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, ShieldCheck, Zap, Layers } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { APP_CONFIG } from "@/config/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import logoNoBg from "@/assets/logo_no_bg.webp";

import { ForgotPasswordDialog } from "@/features/auth/components/forgot-password-dialog";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Just Sly Suite" },
      { name: "description", content: "Secure access to the Just Sly business management suite." },
      { property: "og:title", content: "Sign in — Just Sly Suite" },
      { property: "og:description", content: "Secure access to the Just Sly business management suite." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault();
    if (typeof window !== "undefined" && !navigator.onLine) {
      toast.error("Authentication unavailable offline. Please check your internet connection.");
      return;
    }
    setPending(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/", replace: true });
  }

  async function handleSignUp(event: React.FormEvent) {
    event.preventDefault();
    if (typeof window !== "undefined" && !navigator.onLine) {
      toast.error("Account creation requires an internet connection.");
      return;
    }
    setPending(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created. Check your inbox to confirm your email.");
  }

  async function handleGoogle() {
    if (typeof window !== "undefined" && !navigator.onLine) {
      toast.error("Google sign-in requires an internet connection.");
      return;
    }
    setPending(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setPending(false);
      toast.error("Google sign-in failed. Please try again.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/", replace: true });
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2 bg-background">
      <section className="hidden flex-col justify-between border-r border-border bg-surface p-12 lg:flex relative overflow-hidden">
        <div className="flex items-center gap-3">
          <img src={logoNoBg} alt={APP_CONFIG.name} className="h-10 w-auto object-contain" />
          <span className="font-semibold text-lg tracking-tight text-foreground">{APP_CONFIG.name}</span>
        </div>

        <div className="space-y-6 max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-foreground">
            Run every branch from one control room.
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Inventory, retail, wholesale and analytics — unified, auditable and built for scale.
          </p>

          <div className="space-y-3 pt-4 border-t border-border/60">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 text-primary shrink-0" />
              <span>Role-based access control & full audit logging</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Zap className="size-4 text-primary shrink-0" />
              <span>Real-time stock velocity & multi-branch ledger</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Layers className="size-4 text-primary shrink-0" />
              <span>Unified retail POS & wholesale order management</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>v{APP_CONFIG.version}</span>
          <span>Enterprise Edition</span>
        </div>
      </section>

      <section className="flex items-center justify-center px-4 py-12">
        <Card variant="flat" className="w-full max-w-sm border-0 sm:border shadow-none sm:shadow-2xs">
          <CardHeader className="space-y-1 p-6">
            <div className="flex justify-center mb-2 lg:hidden">
              <img src={logoNoBg} alt={APP_CONFIG.name} className="h-12 w-auto object-contain" />
            </div>
            <CardTitle className="text-xl font-semibold">Welcome back</CardTitle>
            <CardDescription className="text-xs">Sign in to your {APP_CONFIG.name} workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 p-6 pt-0">
            <Button variant="outline" size="sm" className="w-full text-xs gap-2" onClick={handleGoogle} disabled={pending}>
              <svg className="size-3.5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Continue with Google
            </Button>

            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or continue with email
              <span className="h-px flex-1 bg-border" />
            </div>

            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2 h-8 p-0.5 bg-muted">
                <TabsTrigger value="signin" className="text-xs py-1">Sign in</TabsTrigger>
                <TabsTrigger value="signup" className="text-xs py-1">Create account</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form className="space-y-3.5 pt-3" onSubmit={handleSignIn}>
                  <div className="space-y-1.5">
                    <Label htmlFor="signin-email" className="text-xs">Email address</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@justsly.com"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signin-password" className="text-xs">Password</Label>
                      <button
                        type="button"
                        onClick={() => setForgotPasswordOpen(true)}
                        className="text-[11px] text-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <Input
                      id="signin-password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <Button type="submit" size="sm" className="w-full text-xs font-medium" disabled={pending}>
                    {pending ? <Loader2 className="size-3.5 animate-spin" /> : "Sign in"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form className="space-y-3.5 pt-3" onSubmit={handleSignUp}>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-name" className="text-xs">Full name</Label>
                    <Input
                      id="signup-name"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Sly Mensah"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-email" className="text-xs">Email address</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-password" className="text-xs">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <Button type="submit" size="sm" className="w-full text-xs font-medium" disabled={pending}>
                    {pending ? <Loader2 className="size-3.5 animate-spin" /> : "Create account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </section>
      <ForgotPasswordDialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen} />
    </main>
  );
}

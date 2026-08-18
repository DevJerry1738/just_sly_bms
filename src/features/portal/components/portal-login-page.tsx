import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Lock, Mail, ArrowRight, Building2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { APP_CONFIG } from "@/config/app";
import logoNoBg from "@/assets/logo_no_bg.webp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { customerRepository } from "@/repositories/customer.repository";

export function PortalLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated as an active customer, redirect to shop
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        const customer = await customerRepository.getByEmail(data.session.user.email ?? "");
        if (customer && customer.status === "active") {
          navigate({ to: "/portal/shop" });
        }
      }
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      if (!data.user) throw new Error("Authentication failed.");

      // Verify this is a registered wholesale customer account
      const customer = await customerRepository.getByEmail(email);
      if (!customer) {
        await supabase.auth.signOut();
        throw new Error("No wholesale account found for this email. Please contact your account manager.");
      }
      if (customer.status === "suspended") {
        await supabase.auth.signOut();
        throw new Error("Your account has been suspended. Please contact support.");
      }
      if (customer.status === "inactive") {
        await supabase.auth.signOut();
        throw new Error("Your account is inactive. Please contact your account manager.");
      }

      toast.success("Welcome back!", { description: `Signed in as ${customer.contactName}` });
      navigate({ to: "/portal/shop" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 flex items-center justify-center p-4">

      {/* Background glow orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-indigo-700/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-purple-700/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-indigo-600/5 rounded-full blur-2xl" />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-[420px]">

        {/* ── Brand identity ─────────────────────────────────────────────── */}
        <div className="text-center mb-8 space-y-4">
          <div className="inline-flex flex-col items-center gap-3">
            <img
              src={logoNoBg}
              alt={APP_CONFIG.name}
              className="h-16 w-auto object-contain drop-shadow-[0_0_20px_rgba(99,102,241,0.4)]"
            />
            <div className="space-y-1">
              <h1 className="text-3xl font-black tracking-tight text-white">
                {APP_CONFIG.name}
              </h1>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10">
                <span className="text-xs font-semibold text-indigo-300 uppercase tracking-widest">
                  Wholesale Partner Portal
                </span>
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed max-w-xs mx-auto">
            Exclusive B2B ordering platform for Just Sly wholesale partners.
          </p>
        </div>

        {/* ── Login Card ──────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden">
          
          {/* Card top accent */}
          <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

          <div className="p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Sign in to your account</h2>
              <p className="text-sm text-slate-400 mt-1.5">
                Enter your credentials to access your wholesale order desk.
              </p>
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="size-4 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <div className="size-1.5 rounded-full bg-red-400" />
                </div>
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="portal-email" className="text-sm font-medium text-slate-300">
                  Email address
                </Label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                  <Input
                    id="portal-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(null); }}
                    placeholder="you@company.com"
                    className="pl-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500/50 rounded-xl transition-all"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="portal-password" className="text-sm font-medium text-slate-300">
                  Password
                </Label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                  <Input
                    id="portal-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    placeholder="••••••••"
                    className="pl-10 pr-11 h-11 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500/50 rounded-xl transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 mt-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold shadow-lg shadow-indigo-500/25 border-0 rounded-xl transition-all duration-200 gap-2"
              >
                {loading ? (
                  <>
                    <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in to portal
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </form>

            {/* Trust indicators */}
            <div className="flex items-center gap-3 pt-2 border-t border-white/10">
              <ShieldCheck className="size-4 text-emerald-400 shrink-0" />
              <p className="text-xs text-slate-500 leading-relaxed">
                Secured by Just Sly. This portal is exclusively for authorised wholesale partners.
              </p>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-6 text-center flex items-center justify-center gap-2 text-xs text-slate-600">
          <Building2 className="size-3.5 shrink-0" />
          <span>Don't have an account? Contact your account manager to get started.</span>
        </div>

      </div>
    </div>
  );
}

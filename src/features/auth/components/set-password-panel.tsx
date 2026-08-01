import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SetPasswordPanelProps {
  mode?: "invite" | "recovery";
  userEmail?: string;
  onSuccess?: () => void;
}

export function SetPasswordPanel({ mode = "invite", userEmail, onSuccess }: SetPasswordPanelProps) {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const title = mode === "invite" ? "Welcome! Set your password" : "Reset your password";
  const description =
    mode === "invite"
      ? "Create a password for your account to complete your registration."
      : "Enter a new password for your account.";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!password || password.length < 8) {
      setErrorMsg("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setPending(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMsg(error.message);
        toast.error(error.message);
        return;
      }

      toast.success("Password updated successfully! Welcome aboard.");
      if (onSuccess) {
        onSuccess();
      } else {
        navigate({ to: "/", replace: true });
      }
    } catch (err: any) {
      const msg = err?.message || "Failed to set password. Please try again.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <CardHeader className="space-y-3 px-6 pt-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <KeyRound className="size-5" />
          </div>
          <div>
            <CardTitle className="text-xl font-semibold">{title}</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">{description}</CardDescription>
          </div>
        </div>
        {userEmail ? (
          <p className="text-xs text-muted-foreground">
            Account: <span className="font-medium text-foreground">{userEmail}</span>
          </p>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-6 px-6 pb-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-xs font-medium text-foreground">
              New password
            </Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={pending}
                placeholder="At least 8 characters"
                className="h-11 pr-10 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((curr) => !curr)}
                className="absolute inset-y-0 right-3 inline-flex items-center rounded-md px-2 text-muted-foreground transition hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-xs font-medium text-foreground">
              Confirm password
            </Label>
            <Input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={pending}
              placeholder="Re-enter new password"
              className="h-11 text-sm"
            />
          </div>

          {errorMsg ? (
            <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {errorMsg}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="w-full text-sm font-medium" disabled={pending} isLoading={pending}>
            {pending ? "Saving..." : "Set Password & Continue"}
          </Button>
        </form>
      </CardContent>
    </>
  );
}

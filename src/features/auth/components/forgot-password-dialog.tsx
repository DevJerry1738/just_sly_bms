import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ForgotPasswordDialog({ open, onOpenChange }: ForgotPasswordDialogProps) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (typeof window !== "undefined" && !navigator.onLine) {
      toast.error("You are offline. Password reset requires an active internet connection.");
      return;
    }

    setPending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?type=recovery`,
    });
    setPending(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setSent(true);
    toast.success("Password reset link sent to your email.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Reset Password</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Enter your email address and we'll send you a link to reset your account password.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="space-y-4 py-2 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Mail className="size-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Check your email</p>
              <p className="text-xs text-muted-foreground">
                We sent a instructions link to <span className="font-semibold text-foreground">{email}</span>.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                setSent(false);
                onOpenChange(false);
              }}
            >
              Back to Sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="reset-email" className="text-xs">Email address</Label>
              <Input
                id="reset-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@justsly.com"
                className="h-8 text-xs"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={pending} className="text-xs">
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : "Send Reset Link"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

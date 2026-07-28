import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader className="flex-row gap-4 items-start space-y-0">
          {destructive && (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive mt-0.5">
              <AlertTriangle className="size-5" />
            </span>
          )}
          <div className="space-y-1">
            <AlertDialogTitle className="text-base font-semibold">{title}</AlertDialogTitle>
            {description ? (
              <AlertDialogDescription className="text-xs text-muted-foreground leading-normal">
                {description}
              </AlertDialogDescription>
            ) : null}
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-2">
          <AlertDialogCancel className="h-8 text-xs">{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => void onConfirm()}
            className={cn(
              "h-8 text-xs font-medium",
              destructive && buttonVariants({ variant: "destructive", size: "sm" }),
            )}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

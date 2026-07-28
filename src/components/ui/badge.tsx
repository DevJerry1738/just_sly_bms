import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow-2xs hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow-2xs hover:bg-destructive/90",
        success:
          "border-success/20 bg-success/10 text-success hover:bg-success/15",
        warning:
          "border-warning/20 bg-warning/10 text-warning-foreground hover:bg-warning/15",
        danger:
          "border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/15",
        info:
          "border-info/20 bg-info/10 text-info hover:bg-info/15",
        muted:
          "border-transparent bg-muted text-muted-foreground hover:bg-muted/80",
        outline: "text-foreground border-border",
        ghost: "border-transparent bg-transparent text-muted-foreground hover:bg-accent",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-2 py-0 text-[11px]",
        lg: "px-3 py-1 text-xs font-semibold",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, size, dot, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span className="size-1.5 rounded-full bg-current opacity-80" />
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };

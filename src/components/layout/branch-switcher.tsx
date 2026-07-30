import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { useBranch } from "@/providers/branch-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export function BranchSwitcher() {
  const { activeBranch, branches, setActiveBranchId } = useBranch();

  if (!branches.length) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-2 px-2.5 text-xs font-normal bg-card hover:bg-accent border-border/80"
          aria-label="Select active branch"
        >
          <Building2 className="size-3.5 text-primary shrink-0" />
          <span className="max-w-36 truncate font-semibold text-foreground">
            {activeBranch?.name ?? "Select Branch"}
          </span>
          <ChevronsUpDown className="size-3 text-muted-foreground opacity-70 shrink-0 ml-auto" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Active Branch Context
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {branches.map((b) => {
          const isSelected = activeBranch?.id === b.id;
          return (
            <DropdownMenuItem
              key={b.id}
              onClick={() => setActiveBranchId(b.id)}
              className="flex items-center justify-between text-xs py-2 cursor-pointer"
            >
              <div className="flex flex-col min-w-0 pr-2">
                <span className="font-semibold truncate text-foreground">{b.name}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{b.code} • {b.city}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {b.status === "active" ? (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-500/30 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0">
                    {b.status}
                  </Badge>
                )}
                {isSelected && <Check className="size-3.5 text-primary" />}
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

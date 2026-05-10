"use client";
import { ChevronsUpDown, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { switchOrganization } from "@/lib/actions/portfolio";
import { ROLE_LABELS } from "@/lib/enums";
import { cn } from "@/lib/utils";

type Option = { id: string; name: string; role: string };

export function OrgSwitcher({
  currentOrgId,
  currentOrgName,
  options,
}: {
  currentOrgId: string;
  currentOrgName: string;
  options: Option[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium hover:bg-accent"
      >
        <span>{currentOrgName}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-md border bg-popover shadow-md">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Switch workspace
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {options.map((opt) => {
              const active = opt.id === currentOrgId;
              return (
                <li key={opt.id}>
                  <form action={switchOrganization}>
                    <input type="hidden" name="orgId" value={opt.id} />
                    <button
                      type="submit"
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent",
                        active && "bg-accent/40"
                      )}
                    >
                      <div>
                        <div className="font-medium">{opt.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {ROLE_LABELS[opt.role as keyof typeof ROLE_LABELS] ?? opt.role}
                        </div>
                      </div>
                      {active ? <Check className="h-4 w-4 text-primary" /> : null}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
          <div className="border-t bg-muted/40 px-3 py-2">
            <a href="/portfolio" className="text-xs text-primary hover:underline">
              View full portfolio →
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

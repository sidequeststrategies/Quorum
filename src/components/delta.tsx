import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtUSD } from "@/lib/finance";
import type { MetricDelta } from "@/lib/meeting-compare";

function fmtVal(v: number, money: boolean, pct?: boolean) {
  if (money) return fmtUSD(v, { compact: true });
  return pct ? `${v}%` : String(v);
}

// KPI tile with movement vs the previous meeting (or another baseline —
// customize the wording via sinceLabel/noPriorLabel).
export function DeltaStat({
  d,
  sinceLabel = "since last meeting",
  noPriorLabel = "no prior meeting data",
}: {
  d: MetricDelta;
  sinceLabel?: string;
  noPriorLabel?: string;
}) {
  const hasDelta = d.delta != null && d.delta !== 0;
  const up = (d.delta ?? 0) > 0;
  const good = hasDelta ? (up ? d.goodWhenUp : !d.goodWhenUp) : true;
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{d.label}</p>
      <p className="text-xl font-bold">{d.current != null ? fmtVal(d.current, d.money, d.pct) : "—"}</p>
      {d.previous != null ? (
        hasDelta ? (
          <p className={cn("mt-0.5 flex items-center gap-1 text-xs font-medium", good ? "text-emerald-700" : "text-red-700")}>
            {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {up ? "+" : "−"}
            {fmtVal(Math.abs(d.delta!), d.money, d.pct)} {sinceLabel}
          </p>
        ) : (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowRight className="h-3.5 w-3.5" /> unchanged
          </p>
        )
      ) : (
        <p className="mt-0.5 text-xs text-muted-foreground">{noPriorLabel}</p>
      )}
    </div>
  );
}

// "was X → now Y" transition chip; renders nothing if unchanged and quiet=true.
export function Transition({
  from,
  to,
  labels,
  quiet = false,
}: {
  from: string | null;
  to: string | null;
  labels?: Record<string, string>;
  quiet?: boolean;
}) {
  const lbl = (v: string | null) => (v ? (labels?.[v] ?? v) : "—");
  if (!from || from === to) {
    if (quiet) return null;
    return <span className="text-xs text-muted-foreground">{from ? "unchanged" : "new"}</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
      {lbl(from)} <ArrowRight className="h-3 w-3" /> {lbl(to)}
    </span>
  );
}

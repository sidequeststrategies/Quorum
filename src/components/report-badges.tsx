import { cn } from "@/lib/utils";
import {
  CUSTOMER_HEALTH_LABELS,
  CUSTOMER_STATUS_LABELS,
  MILESTONE_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  RISK_STATUS_LABELS,
} from "@/lib/enums";

function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        className
      )}
    >
      {children}
    </span>
  );
}

const OK = "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
const WARN = "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
const BAD = "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300";
const NEUTRAL = "bg-secondary text-secondary-foreground";
const INFO = "bg-accent text-accent-foreground";

export function ProjectStatusBadge({ status }: { status: string }) {
  const cls =
    status === "ON_TRACK" ? OK : status === "AT_RISK" ? WARN : status === "OFF_TRACK" ? BAD : status === "COMPLETED" ? INFO : NEUTRAL;
  return <Pill className={cls}>{PROJECT_STATUS_LABELS[status] ?? status}</Pill>;
}

export function MilestoneStatusBadge({ status }: { status: string }) {
  const cls = status === "DONE" ? OK : status === "SLIPPED" ? BAD : status === "IN_PROGRESS" ? INFO : NEUTRAL;
  return <Pill className={cls}>{MILESTONE_STATUS_LABELS[status] ?? status}</Pill>;
}

export function RiskStatusBadge({ status }: { status: string }) {
  const cls = status === "CLOSED" ? NEUTRAL : status === "ACCEPTED" ? INFO : status === "MITIGATING" ? WARN : BAD;
  return <Pill className={cls}>{RISK_STATUS_LABELS[status] ?? status}</Pill>;
}

// Severity = likelihood × impact (1–25).
export function RiskSeverityBadge({ likelihood, impact }: { likelihood: number; impact: number }) {
  const score = likelihood * impact;
  const cls = score >= 15 ? BAD : score >= 8 ? WARN : OK;
  return <Pill className={cls}>{score}</Pill>;
}

export function CustomerStatusBadge({ status }: { status: string }) {
  const cls =
    status === "ACTIVE" ? OK : status === "AT_RISK" ? WARN : status === "CHURNED" ? BAD : status === "PILOT" ? INFO : NEUTRAL;
  return <Pill className={cls}>{CUSTOMER_STATUS_LABELS[status] ?? status}</Pill>;
}

export function HealthDot({ health }: { health: string }) {
  const cls = health === "GREEN" ? "bg-emerald-500" : health === "AMBER" ? "bg-amber-500" : "bg-red-500";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className={cn("h-2.5 w-2.5 rounded-full", cls)} />
      {CUSTOMER_HEALTH_LABELS[health] ?? health}
    </span>
  );
}

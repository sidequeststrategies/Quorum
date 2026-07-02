// Assembles everything the board sees for one reporting period (a calendar
// month). Used by the per-meeting board pack page and the dashboard's
// cycle checklist — one query layer so both always agree.

import { and, asc, desc, eq, gte, inArray, lt, lte, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  customers,
  customerUpdates,
  financialSnapshots,
  gtmUpdates,
  projects,
  projectMilestones,
  projectUpdates,
  risks,
  teamUpdates,
} from "@/db/schema";

export function monthRange(period: Date) {
  const start = new Date(period.getFullYear(), period.getMonth(), 1);
  const end = new Date(period.getFullYear(), period.getMonth() + 1, 1);
  return { start, end };
}

export async function getBoardPackData(organizationId: string, period: Date) {
  const { start, end } = monthRange(period);

  const [snapshots, projectList, updatesInPeriod, milestones, openRisks, team, customerList, custUpdates, gtm] =
    await Promise.all([
      db
        .select()
        .from(financialSnapshots)
        .where(and(eq(financialSnapshots.organizationId, organizationId), lt(financialSnapshots.period, end)))
        .orderBy(asc(financialSnapshots.period)),
      db
        .select()
        .from(projects)
        .where(and(eq(projects.organizationId, organizationId), ne(projects.status, "COMPLETED"))),
      db
        .select({ u: projectUpdates, projectName: projects.name })
        .from(projectUpdates)
        .innerJoin(projects, eq(projectUpdates.projectId, projects.id))
        .where(
          and(eq(projects.organizationId, organizationId), gte(projectUpdates.period, start), lt(projectUpdates.period, end))
        ),
      db
        .select({ m: projectMilestones, projectId: projects.id })
        .from(projectMilestones)
        .innerJoin(projects, eq(projectMilestones.projectId, projects.id))
        .where(eq(projects.organizationId, organizationId))
        .orderBy(asc(projectMilestones.order)),
      db
        .select()
        .from(risks)
        .where(and(eq(risks.organizationId, organizationId), ne(risks.status, "CLOSED"))),
      db
        .select()
        .from(teamUpdates)
        .where(and(eq(teamUpdates.organizationId, organizationId), gte(teamUpdates.period, start), lt(teamUpdates.period, end)))
        .limit(1),
      db
        .select()
        .from(customers)
        .where(and(eq(customers.organizationId, organizationId), inArray(customers.status, ["PILOT", "ACTIVE", "AT_RISK"])))
        .orderBy(desc(customers.arr)),
      db
        .select({ u: customerUpdates, customerName: customers.name, customerArr: customers.arr })
        .from(customerUpdates)
        .innerJoin(customers, eq(customerUpdates.customerId, customers.id))
        .where(
          and(
            eq(customers.organizationId, organizationId),
            gte(customerUpdates.period, start),
            lt(customerUpdates.period, end)
          )
        ),
      db
        .select()
        .from(gtmUpdates)
        .where(and(eq(gtmUpdates.organizationId, organizationId), gte(gtmUpdates.period, start), lt(gtmUpdates.period, end)))
        .limit(1),
    ]);

  const snapshot =
    snapshots.find((s) => s.period >= start && s.period < end) ?? snapshots[snapshots.length - 1] ?? null;
  const snapshotIsCurrent = !!snapshot && snapshot.period >= start && snapshot.period < end;

  const sortedRisks = [...openRisks].sort((a, b) => b.likelihood * b.impact - a.likelihood * a.impact);

  return {
    period,
    snapshots,
    snapshot,
    snapshotIsCurrent,
    projects: projectList,
    projectUpdates: updatesInPeriod,
    milestones,
    risks: sortedRisks,
    teamUpdate: team[0] ?? null,
    customers: customerList,
    customerUpdates: custUpdates,
    gtmUpdate: gtm[0] ?? null,
  };
}

export type BoardPackData = Awaited<ReturnType<typeof getBoardPackData>>;

// Checklist used on the dashboard: what still needs doing before the pack is
// complete for the month.
export function cycleChecklist(data: BoardPackData) {
  const activeProjects = data.projects.length;
  const projectsWithUpdate = new Set(data.projectUpdates.map((x) => x.u.projectId)).size;
  const trackedCustomers = data.customers.length;
  const customersWithUpdate = new Set(data.customerUpdates.map((x) => x.u.customerId)).size;

  return [
    { key: "financials", label: "Financial snapshot", href: "/financials", done: data.snapshotIsCurrent },
    {
      key: "projects",
      label: `Project write-ups (${projectsWithUpdate}/${activeProjects})`,
      href: "/projects",
      done: activeProjects > 0 && projectsWithUpdate >= activeProjects,
    },
    {
      key: "risks",
      label: `Risk register (${data.risks.length} open)`,
      href: "/risks",
      // The register always carries over; "done" just means it exists.
      done: data.risks.length > 0,
    },
    { key: "team", label: "Team update", href: "/team", done: !!data.teamUpdate },
    {
      key: "customers",
      label: `Customer health (${customersWithUpdate}/${trackedCustomers})`,
      href: "/customers",
      done: trackedCustomers > 0 && customersWithUpdate >= trackedCustomers,
    },
    { key: "gtm", label: "Sales & GTM update", href: "/sales", done: !!data.gtmUpdate },
  ];
}

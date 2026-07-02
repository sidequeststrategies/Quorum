// The branded, published report document. Consulting-grade and rigid: the
// section order, numbering, typography, and standard visuals come from the
// template and live data — identical every month regardless of how the
// content was written in the editor.

import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { financialSnapshots, gtmUpdates, meetings, organizations, reportTemplates, reports, users } from "@/db/schema";
import { requireMembership } from "@/lib/session";
import { groupBlocksBySection, seedDocFromValues, type DocBlock } from "@/lib/report-doc";
import type { TemplateSection } from "@/lib/report-template-defs";
import { Blocks } from "@/components/report-blocks";
import { BrandMark } from "@/components/brand-logo";
import { CashChart } from "@/components/cash-chart";
import { TrendBars } from "@/components/metric-charts";
import { fmtUSD } from "@/lib/finance";
import { formatDateOnly, formatPeriod } from "@/lib/utils";
import { PrintButton } from "./print-button";

// Sections that get a standardized auto-visual in the published output.
const KPI_SECTIONS = new Set(["metrics"]);
const TREND_SECTIONS = new Set(["financials"]);
const PIPELINE_SECTIONS = new Set(["gtm", "sales", "customers"]);

export default async function ReportViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { membership } = await requireMembership();

  const rows = await db
    .select({
      r: reports,
      tmpName: reportTemplates.name,
      tmpSections: reportTemplates.sections,
      authorName: users.name,
      authorEmail: users.email,
      meetingTitle: meetings.title,
      meetingAt: meetings.scheduledAt,
      orgName: organizations.name,
    })
    .from(reports)
    .innerJoin(users, eq(reports.authorId, users.id))
    .innerJoin(organizations, eq(reports.organizationId, organizations.id))
    .leftJoin(reportTemplates, eq(reports.templateId, reportTemplates.id))
    .leftJoin(meetings, eq(reports.meetingId, meetings.id))
    .where(and(eq(reports.id, id), eq(reports.organizationId, membership.organizationId)))
    .limit(1);
  const row = rows[0];
  if (!row) notFound();

  let sections: TemplateSection[] = [];
  try {
    sections = JSON.parse(row.tmpSections ?? "[]") as TemplateSection[];
  } catch {
    /* noop */
  }

  let values: Record<string, string> = {};
  try {
    values = JSON.parse(row.r.values) as Record<string, string>;
  } catch {
    /* noop */
  }

  let blocks: DocBlock[] = [];
  try {
    blocks = row.r.document ? (JSON.parse(row.r.document) as DocBlock[]) : [];
  } catch {
    /* noop */
  }
  if (blocks.length === 0) blocks = seedDocFromValues(sections, values);

  const { bySection, preamble } = groupBlocksBySection(blocks, sections);

  // Each standardized visual renders exactly once, in the first matching section.
  const kpiSectionId = sections.find((s) => KPI_SECTIONS.has(s.id))?.id;
  const trendSectionId = sections.find((s) => TREND_SECTIONS.has(s.id))?.id;
  const pipelineSectionId = sections.find((s) => PIPELINE_SECTIONS.has(s.id))?.id;

  // Live data for the standardized visuals.
  const [snapshots, gtm] = await Promise.all([
    db
      .select()
      .from(financialSnapshots)
      .where(eq(financialSnapshots.organizationId, membership.organizationId))
      .orderBy(asc(financialSnapshots.period)),
    db
      .select()
      .from(gtmUpdates)
      .where(eq(gtmUpdates.organizationId, membership.organizationId))
      .orderBy(desc(gtmUpdates.period))
      .limit(8),
  ]);
  const latest = snapshots[snapshots.length - 1];
  const prior = snapshots[snapshots.length - 2];
  const trailing = snapshots.slice(-12);
  const pipeline = [...gtm].reverse().map((u) => ({
    label: new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(u.period)),
    value: u.pipelineValue,
  }));

  const asOf = row.meetingAt ? formatPeriod(new Date(row.meetingAt)) : formatPeriod(new Date(row.r.updatedAt));

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 print:max-w-none print:px-0 print:py-0">
      {/* Screen-only toolbar */}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href={`/reports/${row.r.id}`} className="text-sm text-primary hover:underline">
          ← Back to editor
        </Link>
        <PrintButton />
      </div>

      {/* Cover band */}
      <header className="rounded-t-lg bg-primary px-8 py-10 text-primary-foreground print:rounded-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandMark className="h-9 w-9" />
            <span className="text-lg font-semibold">{row.orgName}</span>
          </div>
          <span className="rounded border border-primary-foreground/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest">
            Confidential — Board use only
          </span>
        </div>
        <h1 className="mt-8 text-3xl font-bold leading-tight">{row.r.title}</h1>
        <p className="mt-2 text-sm text-primary-foreground/80">
          {row.tmpName ?? "Board report"} · {asOf}
          {row.meetingTitle ? ` · Prepared for ${row.meetingTitle}` : ""}
          {row.meetingAt ? ` (${formatDateOnly(row.meetingAt)})` : ""}
        </p>
        <p className="mt-1 text-xs text-primary-foreground/60">
          Author: {row.authorName ?? row.authorEmail} · Generated {formatDateOnly(new Date())}
        </p>
      </header>

      {/* Contents */}
      <nav className="border-x border-b bg-secondary/60 px-8 py-5 print:hidden">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Contents</p>
        <ol className="mt-2 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
          {sections.map((s, i) => (
            <li key={s.id} className="flex gap-2">
              <span className="w-6 shrink-0 font-semibold text-brand-teal">{String(i + 1).padStart(2, "0")}</span>
              <span>{s.title}</span>
            </li>
          ))}
        </ol>
      </nav>

      <main className="rounded-b-lg border-x border-b px-8 pb-10 print:rounded-none print:border-0 print:px-0">
        {preamble.length > 0 ? (
          <div className="pt-6">
            <Blocks blocks={preamble} />
          </div>
        ) : null}

        {sections.map((s, i) => {
          const sectionBlocks = bySection.get(s.id) ?? [];
          const hasContent = sectionBlocks.length > 0;
          return (
            <section key={s.id} className="pt-8" style={i > 0 ? { breakBefore: "page" } : undefined}>
              {/* Section header band — fixed BCG-style numbering */}
              <div className="flex items-baseline gap-3 border-b-2 border-primary pb-2">
                <span className="text-2xl font-bold text-brand-teal">{String(i + 1).padStart(2, "0")}</span>
                <h2 className="text-xl font-bold uppercase tracking-wide text-primary">{s.title}</h2>
              </div>

              {/* Standardized visuals — same every period */}
              {s.id === kpiSectionId && latest ? (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Kpi label="ARR" value={fmtUSD(latest.arr, { compact: true })} prev={prior?.arr} cur={latest.arr} />
                  <Kpi label="Revenue / mo" value={fmtUSD(latest.revenue, { compact: true })} prev={prior?.revenue} cur={latest.revenue} />
                  <Kpi label="Net burn / mo" value={fmtUSD(latest.burn, { compact: true })} prev={prior?.burn} cur={latest.burn} invert />
                  <Kpi label="Cash" value={fmtUSD(latest.cash, { compact: true })} prev={prior?.cash} cur={latest.cash} />
                  <Kpi
                    label="Runway"
                    value={latest.burn > 0 ? `${Math.floor(latest.cash / latest.burn)} mo` : "CF+"}
                  />
                  <Kpi label="Gross margin" value={`${latest.grossMargin}%`} prev={prior?.grossMargin} cur={latest.grossMargin} />
                  <Kpi label="Headcount" value={String(latest.headcount)} prev={prior?.headcount} cur={latest.headcount} />
                  <Kpi label="As of" value={formatPeriod(latest.period)} />
                </div>
              ) : null}
              {s.id === trendSectionId && trailing.length >= 2 ? (
                <figure className="mt-4">
                  <CashChart
                    curves={[
                      { name: "Cash", color: "#3FABBD", values: trailing.map((x) => x.cash) },
                      { name: "ARR", color: "#285FAF", values: trailing.map((x) => x.arr) },
                    ]}
                    height={190}
                  />
                  <figcaption className="mt-1 text-center text-xs text-muted-foreground">
                    Cash & ARR, trailing {trailing.length} months (source: monthly financial snapshots)
                  </figcaption>
                </figure>
              ) : null}
              {s.id === pipelineSectionId && pipeline.length >= 2 ? (
                <figure className="mt-4">
                  <TrendBars points={pipeline} height={150} />
                  <figcaption className="mt-1 text-center text-xs text-muted-foreground">
                    Weighted pipeline by month (source: Sales & GTM updates)
                  </figcaption>
                </figure>
              ) : null}

              {hasContent ? (
                <div className="mt-3">
                  <Blocks blocks={sectionBlocks} />
                </div>
              ) : (
                <p className="mt-3 text-sm italic text-muted-foreground">No content provided for this section.</p>
              )}
            </section>
          );
        })}

        <footer className="mt-12 border-t pt-4 text-center text-xs text-muted-foreground">
          {row.orgName} — {row.r.title} · Confidential, prepared for the Board of Directors · {asOf}
        </footer>
      </main>
    </div>
  );
}

function Kpi({
  label,
  value,
  prev,
  cur,
  invert,
}: {
  label: string;
  value: string;
  prev?: number | null;
  cur?: number | null;
  invert?: boolean;
}) {
  let deltaEl: React.ReactNode = null;
  if (prev != null && cur != null && prev !== cur) {
    const up = cur > prev;
    const good = invert ? !up : up;
    deltaEl = (
      <span className={`ml-1 text-[10px] font-semibold ${good ? "text-emerald-600" : "text-red-600"}`}>
        {up ? "▲" : "▼"}
      </span>
    );
  }
  return (
    <div className="rounded-md border-t-4 border-t-brand-teal bg-secondary/50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-primary">
        {value}
        {deltaEl}
      </p>
    </div>
  );
}

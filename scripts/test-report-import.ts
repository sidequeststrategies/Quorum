// Integration test: run the real monthly-report import (the same code the
// server action calls) against the local PGlite DB using the generated test
// pack, then read the data back through the report-page assembly functions.
// Usage: npx tsx scripts/test-report-import.ts <pack.xlsx>
// NOTE: stop the dev server first — PGlite is single-process.

import fs from "node:fs";
import { asc, eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { organizations, users, financialReports, financialForecastValues, funnelSnapshots } from "../src/db/schema";
import { parseFinancialWorkbook, parseFunnelWorkbook } from "../src/lib/xlsx-import";
import { applyMonthlyReportImport } from "../src/lib/financial-report-import";
import { getMonthlyReportData, getFinancialOverview } from "../src/lib/financial-report";

async function main() {
  const packPath = process.argv[2];
  if (!packPath) throw new Error("pass the xlsx path");
  const buf = fs.readFileSync(packPath);

  const [org] = await db.select().from(organizations).where(eq(organizations.slug, "acme-robotics")).limit(1);
  const [user] = await db.select().from(users).orderBy(asc(users.createdAt)).limit(1);
  if (!org || !user) throw new Error("seed the DB first (npm run db:seed)");
  console.log(`Org: ${org.name} · user: ${user.email}`);

  const metrics = parseFinancialWorkbook(buf);
  const funnel = parseFunnelWorkbook(buf);
  const reportMonth = "2026-06";

  // Build the same form fields the review step would submit.
  const fields = new Map<string, string>();
  fields.set("reportMonth", reportMonth);
  fields.set("months", metrics.months.join(","));
  fields.set("funnelMonths", (funnel?.months ?? []).join(","));
  fields.set("storedUrl", "/uploads/test/board-pack.xlsx");
  fields.set("storedFilename", "assetcool-board-pack-jun-2026.xlsx");
  fields.set("storedMime", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  fields.set("storedSize", String(buf.length));
  for (const m of metrics.months) fields.set(`use__${m}`, "on");
  for (const row of metrics.rows) {
    row.values.forEach((v, i) => {
      if (v != null) fields.set(`val__${metrics.months[i]}__${row.field}`, String(v));
    });
  }
  for (const row of funnel?.rows ?? []) {
    row.values.forEach((v, i) => {
      if (v != null) fields.set(`fcount__${funnel!.months[i]}__${row.stage}`, String(v));
    });
  }

  const written = await applyMonthlyReportImport({
    orgId: org.id,
    userId: user.id,
    get: (name) => fields.get(name) ?? null,
  });
  console.log(`\n✓ import applied for ${written}`);

  // Verify DB state
  const reports = await db.select().from(financialReports).where(eq(financialReports.organizationId, org.id));
  const forecasts = await db.select().from(financialForecastValues).where(eq(financialForecastValues.organizationId, org.id));
  const funnelRows = await db.select().from(funnelSnapshots).where(eq(funnelSnapshots.organizationId, org.id));
  console.log(`  reports: ${reports.length} · forecast rows: ${forecasts.length} · funnel rows: ${funnelRows.length}`);

  // Read back through the page assembly
  const data = await getMonthlyReportData(org.id, reportMonth);
  if (!data) throw new Error("report page data came back null");
  console.log(`\n✓ report page data for ${reportMonth}:`);
  console.log(`  snapshot cash=${data.snapshot?.cash} revenue=${data.snapshot?.revenue} gm=${data.snapshot?.grossMargin}% hc=${data.snapshot?.headcount}`);
  console.log(`  deltas: ${data.deltas.map((d) => `${d.key}:${d.delta}`).join(" ")}`);
  console.log(`  callouts:\n    ${data.callouts.join("\n    ")}`);
  console.log(`  forecast months: ${data.forecast.months.join(",")} (actuals: ${data.forecast.actualCount})`);
  console.log(`  forecast revenue curve: ${data.forecast.byField.get("revenue")?.join(",")}`);
  console.log(`  funnel months: ${data.funnel.months.join(",")}`);
  console.log(
    `  velocity steps:\n    ${data.funnel.velocity.map((s) => `${s.from}→${s.to}: ${s.rates.join(",")}`).join("\n    ")}`
  );
  console.log(`  key customers: ${data.keyCustomers.length} · plans: ${data.plans.length}`);
  console.log(`  prev report: ${data.prevReportPeriod} · next: ${data.nextReportPeriod}`);

  const overview = await getFinancialOverview(org.id);
  console.log(`\n✓ overview: ${overview.reports.length} reports · latest=${overview.latest?.period.toISOString().slice(0, 7)}`);
  console.log(`  deltas: ${overview.deltas.map((d) => `${d.key}:${d.current}`).join(" ")}`);
  console.log(`  callouts:\n    ${overview.callouts.join("\n    ")}`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});

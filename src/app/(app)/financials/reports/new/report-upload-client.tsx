"use client";
// Two-step wizard: (1) upload + parse the board financial pack, (2) review
// the detected metrics/forecast/funnel grids, pick the report month, create.

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  parseReportPackAction,
  createMonthlyReportAction,
  type ReportPackPreviewState,
} from "@/lib/actions/financial-reports";
import { SNAPSHOT_FIELDS, SNAPSHOT_FIELD_LABELS, type SnapshotField } from "@/lib/snapshot-fields";
import { FUNNEL_STAGES, FUNNEL_STAGE_LABELS } from "@/lib/funnel";

export function ReportUploadClient() {
  const [state, parseAction, parsing] = useActionState<ReportPackPreviewState, FormData>(parseReportPackAction, {
    status: "idle",
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1 · Upload the board financial pack</CardTitle>
          <CardDescription>
            One Excel workbook per calendar month. We detect months and metrics (cash, revenue, MRR, ARR, gross margin,
            burn, headcount, AR/AP) plus any funnel/pipeline sheet. Columns after the report month are treated as the
            forward forecast.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={parseAction} className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="file">Workbook (.xlsx, .xls, .csv)</Label>
              <Input id="file" name="file" type="file" accept=".xlsx,.xls,.csv" required className="max-w-sm" />
            </div>
            <Button type="submit" disabled={parsing}>
              {parsing ? "Reading…" : "Parse pack"}
            </Button>
          </form>
          {state.status === "error" ? <p className="mt-3 text-sm text-destructive">{state.message}</p> : null}
        </CardContent>
      </Card>

      {state.status === "parsed" ? <ReviewStep state={state} /> : null}
    </div>
  );
}

function ReviewStep({ state }: { state: Extract<ReportPackPreviewState, { status: "parsed" }> }) {
  const { stored, metrics, funnel, suggestedMonth } = state;
  const [reportMonth, setReportMonth] = useState(suggestedMonth);
  const byField = useMemo(() => new Map(metrics.rows.map((r) => [r.field, r])), [metrics.rows]);
  const funnelByStage = useMemo(() => new Map((funnel?.rows ?? []).map((r) => [r.stage, r])), [funnel]);

  const actualMonths = metrics.months.filter((m) => m <= reportMonth);
  const forecastMonths = metrics.months.filter((m) => m > reportMonth);

  return (
    <form action={createMonthlyReportAction} className="space-y-6">
      <input type="hidden" name="storedUrl" value={stored.url} />
      <input type="hidden" name="storedFilename" value={stored.filename} />
      <input type="hidden" name="storedMime" value={stored.mimeType} />
      <input type="hidden" name="storedSize" value={stored.sizeBytes} />
      <input type="hidden" name="months" value={metrics.months.join(",")} />
      <input type="hidden" name="funnelMonths" value={funnel ? funnel.months.join(",") : reportMonth} />

      <Card>
        <CardHeader>
          <CardTitle>2 · Which month does this report cover?</CardTitle>
          <CardDescription>
            Months up to and including this one are saved as actuals; later columns become this report's forecast.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <div className="space-y-2">
            <Label htmlFor="reportMonth">Report month</Label>
            <Input
              id="reportMonth"
              name="reportMonth"
              type="month"
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
              required
              className="w-44"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {actualMonths.length} month{actualMonths.length === 1 ? "" : "s"} of actuals ·{" "}
            {forecastMonths.length} forecast month{forecastMonths.length === 1 ? "" : "s"} detected in{" "}
            <span className="font-medium">{stored.filename}</span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Metrics <span className="font-normal text-muted-foreground">(sheet “{metrics.sheet}”)</span>
          </CardTitle>
          <CardDescription>
            Edit any cell before saving. Unchecked months are skipped; blank cells never overwrite existing data.
            Shaded columns are the forward forecast.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.warnings.map((w, i) => (
            <p key={i} className="mb-2 text-sm text-amber-700">
              {w}
            </p>
          ))}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Metric</th>
                  {metrics.months.map((m) => (
                    <th key={m} className={`py-2 pr-3 ${m > reportMonth ? "bg-secondary/60" : ""}`}>
                      <label className="flex items-center gap-1.5 font-medium">
                        <input type="checkbox" name={`use__${m}`} defaultChecked className="accent-current" />
                        {m}
                        {m > reportMonth ? <span className="font-normal normal-case text-muted-foreground">(fcst)</span> : null}
                      </label>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SNAPSHOT_FIELDS.map((field) => {
                  const row = byField.get(field);
                  return (
                    <tr key={field} className="border-b last:border-0">
                      <td className="py-1.5 pr-3">
                        <span className="font-medium">{SNAPSHOT_FIELD_LABELS[field as SnapshotField]}</span>
                        {row ? (
                          <span className="block text-xs text-muted-foreground">from “{row.sourceLabel}”</span>
                        ) : (
                          <span className="block text-xs text-muted-foreground">not found — optional</span>
                        )}
                      </td>
                      {metrics.months.map((m, i) => (
                        <td key={m} className={`py-1.5 pr-3 ${m > reportMonth ? "bg-secondary/60" : ""}`}>
                          <Input
                            name={`val__${m}__${field}`}
                            type="number"
                            step="any"
                            defaultValue={row?.values[i] ?? ""}
                            className="h-8 w-28 text-right tabular-nums"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {metrics.unmatchedLabels.length > 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Rows not imported (no matching metric): {metrics.unmatchedLabels.join(" · ")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Customer funnel{" "}
            {funnel ? <span className="font-normal text-muted-foreground">(sheet “{funnel.sheet}”)</span> : null}
          </CardTitle>
          <CardDescription>
            {funnel
              ? "Stage counts per month. Months after the report month are ignored — the funnel snapshot is always actuals."
              : "No funnel/pipeline sheet detected in this pack. You can leave this empty, or enter stage counts by hand below."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Stage</th>
                  {(funnel?.months ?? [reportMonth]).map((m) => (
                    <th key={m} className={`py-2 pr-3 ${m > reportMonth ? "bg-secondary/60 line-through" : ""}`}>
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FUNNEL_STAGES.map((stage) => {
                  const row = funnelByStage.get(stage);
                  return (
                    <tr key={stage} className="border-b last:border-0">
                      <td className="py-1.5 pr-3">
                        <span className="font-medium">{FUNNEL_STAGE_LABELS[stage]}</span>
                        {row ? <span className="block text-xs text-muted-foreground">from “{row.sourceLabel}”</span> : null}
                      </td>
                      {(funnel?.months ?? [reportMonth]).map((m, i) => (
                        <td key={m} className={`py-1.5 pr-3 ${m > reportMonth ? "bg-secondary/60" : ""}`}>
                          <Input
                            name={`fcount__${m}__${stage}`}
                            type="number"
                            step="1"
                            defaultValue={row?.values[i] ?? ""}
                            className="h-8 w-24 text-right tabular-nums"
                            placeholder="#"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Counts only for now — pipeline value per stage can be added later or edited in a future pack.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" size="lg">
          Create {reportMonth} report
        </Button>
      </div>
    </form>
  );
}

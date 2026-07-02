"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  parseExcelAction,
  importSnapshotsAction,
  type ImportPreviewState,
} from "@/lib/actions/financials-import";
import { SNAPSHOT_FIELDS, SNAPSHOT_FIELD_LABELS, type SnapshotField } from "@/lib/snapshot-fields";

export function ImportClient() {
  const [state, parseAction, parsing] = useActionState<ImportPreviewState, FormData>(parseExcelAction, {
    status: "idle",
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Import financials from Excel</CardTitle>
          <CardDescription>
            Upload the monthly model or actuals workbook. We detect months and metrics (Cash, Revenue, MRR, ARR,
            Gross margin, Burn, Headcount, AR, AP), show a preview you can correct, and only then import.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={parseAction} className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="file">Workbook (.xlsx, .xls, .csv)</Label>
              <Input id="file" name="file" type="file" accept=".xlsx,.xls,.csv" required className="max-w-sm" />
            </div>
            <Button type="submit" disabled={parsing}>
              {parsing ? "Reading…" : "Parse workbook"}
            </Button>
          </form>
          {state.status === "error" ? <p className="mt-3 text-sm text-destructive">{state.message}</p> : null}
        </CardContent>
      </Card>

      {state.status === "parsed" ? <PreviewGrid fileName={state.fileName} preview={state.preview} /> : null}
    </div>
  );
}

function PreviewGrid({
  fileName,
  preview,
}: {
  fileName: string;
  preview: Extract<ImportPreviewState, { status: "parsed" }>["preview"];
}) {
  const byField = new Map(preview.rows.map((r) => [r.field, r]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Preview — {fileName} <span className="font-normal text-muted-foreground">(sheet “{preview.sheet}”)</span>
        </CardTitle>
        <CardDescription>
          {preview.rows.length} metrics across {preview.months.length} months. Edit any cell before importing —
          unchecked months are skipped, blank cells never overwrite existing data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {preview.warnings.map((w, i) => (
          <p key={i} className="mb-2 text-sm text-amber-700">
            {w}
          </p>
        ))}
        <form action={importSnapshotsAction}>
          <input type="hidden" name="months" value={preview.months.join(",")} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Metric</th>
                  {preview.months.map((m) => (
                    <th key={m} className="py-2 pr-3">
                      <label className="flex items-center gap-1.5 font-medium">
                        <input type="checkbox" name={`use__${m}`} defaultChecked className="accent-current" />
                        {m}
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
                      {preview.months.map((m, i) => (
                        <td key={m} className="py-1.5 pr-3">
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
          {preview.unmatchedLabels.length > 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Rows not imported (no matching metric): {preview.unmatchedLabels.join(" · ")}
            </p>
          ) : null}
          <div className="mt-4 flex justify-end">
            <Button type="submit">Import into monthly snapshots</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

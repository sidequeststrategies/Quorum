"use client";
// Upload → parse-and-validate preview → save as the current model vintage.

import { useActionState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { parseProFormaAction, createProFormaModelAction, type ProFormaParseState } from "@/lib/actions/proforma";
import { currentPeriodString } from "@/lib/utils";

const fmtM = (v: number) => `£${(v / 1e6).toFixed(1)}M`;

export function ProFormaUploadClient() {
  const [state, parseAction, parsing] = useActionState<ProFormaParseState, FormData>(parseProFormaAction, {
    status: "idle",
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1 · Upload the model workbook</CardTitle>
          <CardDescription>
            Sheets are matched by their content (quarterly columns like &ldquo;Q1 FY27&rdquo; plus REVENUE / COST OF
            SALES / OVERHEADS sections), so the model can evolve between vintages without breaking the import.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={parseAction} className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="file">Workbook (.xlsx)</Label>
              <Input id="file" name="file" type="file" accept=".xlsx,.xls" required className="max-w-sm" />
            </div>
            <Button type="submit" disabled={parsing}>
              {parsing ? "Parsing…" : "Parse model"}
            </Button>
          </form>
          {state.status === "error" ? <p className="mt-3 text-sm text-destructive">{state.message}</p> : null}
        </CardContent>
      </Card>

      {state.status === "parsed" ? (
        <form action={createProFormaModelAction}>
          <input type="hidden" name="baselineJson" value={JSON.stringify(state.baseline)} />
          <input type="hidden" name="storedUrl" value={state.stored.url} />
          <input type="hidden" name="storedFilename" value={state.stored.filename} />
          <input type="hidden" name="storedMime" value={state.stored.mimeType} />
          <input type="hidden" name="storedSize" value={state.stored.sizeBytes} />

          <Card>
            <CardHeader>
              <CardTitle>2 · Review &amp; save</CardTitle>
              <CardDescription>What the parser understood — check it matches the model before saving.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="grid gap-2 text-sm sm:grid-cols-2">
                <li>
                  <span className="text-muted-foreground">Horizon:</span> {state.summary.quarters} quarters (
                  {state.summary.fiscalYears[0]}–{state.summary.fiscalYears[state.summary.fiscalYears.length - 1]})
                </li>
                <li>
                  <span className="text-muted-foreground">Product lines:</span> {state.summary.lines.length}
                </li>
                <li>
                  <span className="text-muted-foreground">Revenue:</span> {fmtM(state.summary.firstFyRevenue)} →{" "}
                  {fmtM(state.summary.finalFyRevenue)}
                </li>
                <li>
                  <span className="text-muted-foreground">EBITDA breakeven:</span>{" "}
                  {state.summary.breakeven ?? "not within horizon"}
                </li>
                <li>
                  <span className="text-muted-foreground">Cash trough:</span> {fmtM(state.summary.minCash)}
                </li>
                <li className="flex items-center gap-1.5">
                  {state.summary.matchesWorkbook === false ? (
                    <>
                      <XCircle className="h-4 w-4 text-destructive" />
                      <span className="text-destructive">Engine does NOT reproduce the workbook — don&rsquo;t trust sliders yet</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>
                        {state.summary.matchesWorkbook === true
                          ? "Engine reproduces the workbook's EBITDA exactly"
                          : "Parsed (workbook has no EBITDA row to validate against)"}
                      </span>
                    </>
                  )}
                </li>
              </ul>
              <p className="text-xs text-muted-foreground">
                Lines: {state.summary.lines.join(" · ")} · from <span className="font-medium">{state.stored.filename}</span>
              </p>

              <div className="flex flex-wrap items-end gap-3 border-t pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Model name</Label>
                  <Input id="name" name="name" defaultValue="Financial model" className="w-64" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vintage">Vintage (month issued)</Label>
                  <Input id="vintage" name="vintage" type="month" defaultValue={currentPeriodString()} required className="w-44" />
                </div>
                <Button type="submit" size="lg">
                  Save as current model
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      ) : null}
    </div>
  );
}

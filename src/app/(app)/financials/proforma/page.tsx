// Pro forma & scenario modeling: the interactive counterpart to the monthly
// financial reports. Loads the org's latest parsed model vintage and hands
// the baseline to the client, which recomputes P&L and cash live as
// assumption sliders move, plus tornado and two-driver sensitivity analysis.

import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ArrowLeft, Download, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/db";
import { financialDocuments, proFormaModels } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { deleteProFormaModelAction } from "@/lib/actions/proforma";
import { formatDateOnly, formatPeriod } from "@/lib/utils";
import type { ProFormaBaseline } from "@/lib/proforma";
import { ProFormaClient } from "./proforma-client";

export default async function ProFormaPage() {
  const { membership } = await requireMembership();
  const isManager = canManage(membership.role);

  const models = await db
    .select()
    .from(proFormaModels)
    .where(eq(proFormaModels.organizationId, membership.organizationId))
    .orderBy(desc(proFormaModels.createdAt))
    .limit(12);
  const model = models[0] ?? null;

  const sourceDoc = model?.sourceDocumentId
    ? (await db.select().from(financialDocuments).where(eq(financialDocuments.id, model.sourceDocumentId)).limit(1))[0]
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/financials" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Financials
          </Link>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Pro forma &amp; scenario modeling</h1>
          {model ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {model.name} · vintage {formatPeriod(model.vintage)} · uploaded {formatDateOnly(model.createdAt)}
              {sourceDoc ? (
                <>
                  {" · "}
                  <a href={sourceDoc.storagePath} download={sourceDoc.filename} className="underline underline-offset-2 hover:text-foreground">
                    {sourceDoc.filename}
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {sourceDoc ? (
            <Button asChild variant="outline" size="sm">
              <a href={sourceDoc.storagePath} download={sourceDoc.filename}>
                <Download className="mr-1 h-4 w-4" /> Model
              </a>
            </Button>
          ) : null}
          {isManager ? (
            <Button asChild size="sm">
              <Link href="/financials/proforma/new">
                <Upload className="mr-1 h-4 w-4" /> Upload new vintage
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {!model ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              No financial model uploaded yet.
              {isManager ? (
                <>
                  {" "}
                  <Link href="/financials/proforma/new" className="underline underline-offset-2">
                    Upload the pro forma workbook
                  </Link>{" "}
                  to start modeling — sliders, live P&amp;L, and sensitivity analysis run on top of it.
                </>
              ) : (
                " Once one is uploaded, interactive modeling appears here."
              )}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ProFormaClient baseline={JSON.parse(model.baselineJson) as ProFormaBaseline} />
      )}

      {model && models.length > 1 ? (
        <p className="text-xs text-muted-foreground">
          Earlier vintages: {models.slice(1).map((m) => `${m.name} (${formatPeriod(m.vintage)})`).join(" · ")}
        </p>
      ) : null}

      {model && isManager ? (
        <form action={deleteProFormaModelAction} className="flex justify-end">
          <input type="hidden" name="id" value={model.id} />
          <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
            <Trash2 className="mr-1 h-4 w-4" /> Delete this vintage
          </Button>
        </form>
      ) : null}
    </div>
  );
}

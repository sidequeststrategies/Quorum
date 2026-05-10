import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { retreats } from "@/db/schema";
import { formatDate } from "@/lib/utils";
import { IntakeFormClient } from "./intake-form-client";
import { submitIntakeResponse } from "@/lib/actions/retreats";

export const dynamic = "force-dynamic";

type IntakeField = {
  id: string;
  label: string;
  kind: "short" | "long" | "likert" | "select" | "multiselect" | "tracks";
  options?: string[];
  anchors?: [string, string];
  placeholder?: string;
  required?: boolean;
};

// We don't have a reusable schema bound to a retreat yet — for v1, every retreat that has
// an intakeToken uses the LEADERSHIP_DAY_INTAKE schema (the same schema used by the seeded template).
// Future: store per-retreat intake schema on the retreat row.
import { LEADERSHIP_DAY_INTAKE } from "@/db/seed-content";

export default async function RetreatIntakePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rows = await db.select().from(retreats).where(eq(retreats.intakeToken, token)).limit(1);
  const retreat = rows[0];
  if (!retreat) notFound();

  const fields = LEADERSHIP_DAY_INTAKE as IntakeField[];

  return (
    <div className="min-h-screen bg-muted/20 py-12">
      <div className="container max-w-3xl">
        <div className="mb-6">
          <Badge variant="outline" className="mb-3">
            Pre-retreat intake
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight">{retreat.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(retreat.startDate)}
            {retreat.location ? ` · ${retreat.location}` : ""}
          </p>
          <p className="mt-3 text-sm">
            This form shapes the day. Your honest answers populate the Braintrust queue, the
            hackathon team formation, and the working-lunch pre-mortem. The more candid you are
            here, the better the retreat. ~12 minutes.
          </p>
        </div>

        {!retreat.intakeOpen ? (
          <Card>
            <CardHeader>
              <CardTitle>Intake is closed</CardTitle>
              <CardDescription>The organizer has paused new submissions for this retreat.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <IntakeFormClient token={token} fields={fields} action={submitIntakeResponse} />
        )}
      </div>
    </div>
  );
}

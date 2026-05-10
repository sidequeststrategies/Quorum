"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveReport, updateReportStatus } from "@/lib/actions/reports";

export type ReportSection = {
  id: string;
  title: string;
  kind: "text" | "rich" | "metric" | "checklist";
  prompt?: string;
  placeholder?: string;
};

type Props = {
  reportId: string;
  status: string;
  sections: ReportSection[];
  initialValues: Record<string, string>;
};

export function ReportEditor({ reportId, status, sections, initialValues }: Props) {
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  function handleSave() {
    const fd = new FormData();
    fd.set("id", reportId);
    fd.set("valuesJson", JSON.stringify(values));
    startTransition(async () => {
      await saveReport(fd);
      setSavedAt(new Date());
    });
  }

  function handleStatus(next: string) {
    const fd = new FormData();
    fd.set("id", reportId);
    fd.set("status", next);
    fd.set("valuesJson", JSON.stringify(values));
    startTransition(async () => {
      // save first, then transition
      const fdSave = new FormData();
      fdSave.set("id", reportId);
      fdSave.set("valuesJson", JSON.stringify(values));
      await saveReport(fdSave);
      await updateReportStatus(fd);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-4 py-2 text-sm">
        <span className="text-muted-foreground">
          {pending ? "Saving…" : savedAt ? `Saved at ${savedAt.toLocaleTimeString()}` : "Edit any section, then save."}
        </span>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={handleSave}>
            Save draft
          </Button>
          {status === "DRAFT" ? (
            <Button type="button" size="sm" disabled={pending} onClick={() => handleStatus("PUBLISHED")}>
              Publish
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => handleStatus("DRAFT")}>
              Move back to draft
            </Button>
          )}
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="space-y-2">
          <Label>Body</Label>
          <Textarea
            rows={20}
            value={values["_body"] ?? ""}
            onChange={(e) => setValues({ ...values, _body: e.target.value })}
            placeholder="Blank report — write whatever you'd like…"
          />
        </div>
      ) : (
        sections.map((s) => (
          <div key={s.id} className="space-y-2">
            <div>
              <Label className="text-base font-semibold">{s.title}</Label>
              {s.prompt ? <p className="mt-1 text-xs text-muted-foreground">{s.prompt}</p> : null}
            </div>
            {s.kind === "metric" ? (
              <Input
                value={values[s.id] ?? ""}
                onChange={(e) => setValues({ ...values, [s.id]: e.target.value })}
                placeholder={s.placeholder ?? "ARR: $4.0M · Growth: +28% QoQ · Burn: $480k/mo"}
              />
            ) : (
              <Textarea
                rows={s.kind === "rich" ? 8 : 5}
                value={values[s.id] ?? ""}
                onChange={(e) => setValues({ ...values, [s.id]: e.target.value })}
                placeholder={s.placeholder ?? ""}
              />
            )}
          </div>
        ))
      )}
    </div>
  );
}

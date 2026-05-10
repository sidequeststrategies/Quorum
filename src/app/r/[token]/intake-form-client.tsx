"use client";
import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type IntakeField = {
  id: string;
  label: string;
  kind: "short" | "long" | "likert" | "select" | "multiselect" | "tracks";
  options?: string[];
  anchors?: [string, string];
  placeholder?: string;
  required?: boolean;
};

type Props = {
  token: string;
  fields: IntakeField[];
  action: (formData: FormData) => void;
};

export function IntakeFormClient({ token, fields, action }: Props) {
  const [values, setValues] = useState<Record<string, string | string[] | number>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");

  const totalFields = fields.length + 1; // +1 for name
  const filled = useMemo(() => {
    let count = 0;
    if (name.trim()) count++;
    for (const f of fields) {
      const v = values[f.id];
      if (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== "") count++;
    }
    return count;
  }, [values, name, fields]);
  const pct = Math.round((filled / totalFields) * 100);

  function setField(id: string, val: string | string[] | number) {
    setValues((s) => ({ ...s, [id]: val }));
  }

  function toggleMulti(id: string, opt: string) {
    const cur = (values[id] as string[]) ?? [];
    const next = cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt];
    setField(id, next);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    // form posts via the server action; we just package values into a JSON field
    const fd = new FormData(e.currentTarget);
    fd.set("answersJson", JSON.stringify(values));
  }

  return (
    <>
      <div className="sticky top-0 z-10 -mx-4 mb-4 bg-muted/40 px-4 py-2 backdrop-blur">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{pct}% complete</div>
      </div>

      <form action={action} onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="answersJson" value={JSON.stringify(values)} />

        <Card>
          <CardHeader>
            <CardTitle>About you</CardTitle>
            <CardDescription>The basics — skip nothing here.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="role">Your role</Label>
              <Input id="role" name="role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. CEO, VP Engineering, Head of Commercial" />
            </div>
          </CardContent>
        </Card>

        {fields.map((f) => (
          <Card key={f.id}>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                {f.label}
                {f.required ? <span className="ml-1 text-destructive">*</span> : null}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {f.kind === "short" ? (
                <Input
                  required={f.required}
                  placeholder={f.placeholder}
                  value={(values[f.id] as string) ?? ""}
                  onChange={(e) => setField(f.id, e.target.value)}
                />
              ) : f.kind === "long" ? (
                <Textarea
                  required={f.required}
                  placeholder={f.placeholder}
                  rows={4}
                  value={(values[f.id] as string) ?? ""}
                  onChange={(e) => setField(f.id, e.target.value)}
                />
              ) : f.kind === "select" ? (
                <Select value={(values[f.id] as string) ?? ""} onValueChange={(v) => setField(f.id, v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(f.options ?? []).map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : f.kind === "likert" ? (
                <div>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((v) => {
                      const selected = values[f.id] === v;
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setField(f.id, v)}
                          className={cn(
                            "flex-1 rounded-md border py-2 text-sm font-medium transition-colors",
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input bg-background hover:bg-accent"
                          )}
                        >
                          {v}
                        </button>
                      );
                    })}
                  </div>
                  {f.anchors ? (
                    <div className="mt-1 flex justify-between text-xs uppercase tracking-wider text-muted-foreground">
                      <span>{f.anchors[0]}</span>
                      <span>{f.anchors[1]}</span>
                    </div>
                  ) : null}
                </div>
              ) : f.kind === "multiselect" ? (
                <div className="flex flex-wrap gap-2">
                  {(f.options ?? []).map((opt) => {
                    const selected = ((values[f.id] as string[]) ?? []).includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleMulti(f.id, opt)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background hover:bg-accent"
                        )}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}

        <Card className="bg-primary text-primary-foreground">
          <CardHeader>
            <CardTitle>Ready to send</CardTitle>
            <CardDescription className="text-primary-foreground/70">
              Submitting will deliver your responses to the retreat organizer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="submit" variant="secondary" size="lg">
              Submit responses
            </Button>
          </CardContent>
        </Card>
      </form>
    </>
  );
}
